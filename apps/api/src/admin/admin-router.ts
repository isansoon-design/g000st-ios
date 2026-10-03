import { Router, type Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';

import { AuthService } from '../auth/auth-service.js';
import { requireAdminRole } from '../auth/require-admin-role.js';
import { asyncRoute } from '../http/async-route.js';
import { AdminAnalyticsService } from './admin-analytics.js';
import { AdminDeskService } from './admin-desk.js';
import { RssService, rssInput } from '../rss/rss-service.js';

const exactId = z.string().length(50).regex(/^[A-Za-z0-9]+$/);
const uuid = z.string().uuid();
const section = z.enum(['social', 'market']);
const switchBody = z.object({ enabled: z.boolean() }).strict();
const nameBody = z.object({ displayName: z.string().trim().min(1).max(60) }).strict();
const contentBody = z.object({ content: z.string().trim().min(1).max(4_000) }).strict();
const messageBody = z.object({ to: z.union([exactId, z.literal('all')]), text: z.string().trim().min(1).max(2_000), type: z.enum(['msg', 'warning']) }).strict();
const replyBody = z.object({ text: z.string().trim().min(1).max(2_000) }).strict();

function bearerToken(request: Request): string {
  const [scheme, token] = (request.header('authorization') ?? '').split(' ', 2);
  return scheme?.toLowerCase() === 'bearer' ? token ?? '' : '';
}

const writeLimiter = rateLimit({ legacyHeaders: false, limit: 30, standardHeaders: 'draft-8', windowMs: 60_000 });

export function createAdminRouter(auth: AuthService, analytics: AdminAnalyticsService, desk: AdminDeskService, rss?: RssService): Router {
  const router = Router();
  router.use(asyncRoute(async (request, _response, next) => {
    const actor = await auth.getUser(bearerToken(request));
    request.authenticatedRole = actor.role;
    request.authenticatedPublicId = actor.publicId;
    next();
  }));
  router.use(requireAdminRole);

  if (rss) {
    router.get('/rss', asyncRoute(async (_request, response) => { response.json(await rss.list()); }));
    router.post('/rss', writeLimiter, asyncRoute(async (request, response) => {
      const id = await rss.save(undefined, rssInput.parse(request.body), request.authenticatedPublicId);
      response.status(201).json({ version: 1, id });
    }));
    router.put('/rss/:id', writeLimiter, asyncRoute(async (request, response) => {
      const id = await rss.save(uuid.parse(request.params.id), rssInput.parse(request.body), request.authenticatedPublicId);
      response.json({ version: 1, id });
    }));
    router.delete('/rss/:id', writeLimiter, asyncRoute(async (request, response) => {
      await rss.remove(uuid.parse(request.params.id));
      response.status(204).end();
    }));
  }

  router.get('/reports/:section', asyncRoute(async (request, response) => {
    const cursor = z.string().min(1).max(500).optional().parse(request.query.cursor);
    const reportId = uuid.optional().parse(request.query.reportId);
    response.json(await desk.listReports(section.parse(request.params.section), cursor, reportId));
  }));
  router.put('/reports/:section/:reportId', writeLimiter, asyncRoute(async (request, response) => {
    const { resolution } = z.object({ resolution: z.enum(['action_taken', 'no_violation']) }).strict().parse(request.body);
    await desk.resolveReport(section.parse(request.params.section), uuid.parse(request.params.reportId), resolution, request.authenticatedPublicId);
    response.status(204).end();
  }));
  router.get('/analytics', asyncRoute(async (_request, response) => { response.json(await analytics.get()); }));
  router.get('/desk', asyncRoute(async (_request, response) => { response.json(await desk.get()); }));
  router.get('/users', asyncRoute(async (request, response) => {
    const query = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50), cursor: z.string().min(1).max(256).optional(), q: z.string().trim().min(1).max(100).optional() }).parse(request.query);
    response.json(query.q ? await desk.listSearchedUsers(query.limit, query.q, query.cursor) : await desk.listUsers(query.limit, query.cursor));
  }));
  router.delete('/users/:publicId', writeLimiter, asyncRoute(async (request, response) => {
    await auth.deleteAccountByAdmin(bearerToken(request), exactId.parse(request.params.publicId));
    response.status(204).end();
  }));
  router.get('/desk/posts/:section', asyncRoute(async (request, response) => {
    const kind = section.parse(request.params.section);
    const query = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20), cursor: z.string().min(1).max(256).optional() }).parse(request.query);
    response.json(await desk.listPosts(kind, query.limit, query.cursor));
  }));
  router.get('/billing/recent', asyncRoute(async (_request, response) => { response.json(await desk.getRecentBillingBalances()); }));
  router.get('/desk/users', rateLimit({ legacyHeaders: false, limit: 30, standardHeaders: 'draft-8', windowMs: 60_000 }), asyncRoute(async (request, response) => {
    const query = z.object({ q: z.string().trim().min(1).max(100) }).parse(request.query);
    response.json({ users: await desk.searchUsers(query.q) });
  }));
  router.post('/desk/accounts', writeLimiter, asyncRoute(async (request, response) => {
    const body = z.object({ note: z.string().trim().max(300).default('') }).strict().parse(request.body);
    const account = await auth.register(undefined, true);
    let noteSaved = true;
    try { await desk.recordIssuedAccount(account.user.publicId, body.note, request.authenticatedPublicId); }
    catch { noteSaved = false; }
    response.status(201).json({ publicId: account.user.publicId, recoveryId: account.recoveryId, noteSaved });
  }));
  router.put('/desk/config/:kind/:key', writeLimiter, asyncRoute(async (request, response) => {
    const kind = z.enum(['pages', 'parts']).parse(request.params.kind);
    const key = z.string().regex(/^[a-z]+(?:\.[a-z]+)?$/).max(50).parse(request.params.key);
    const { enabled } = switchBody.parse(request.body);
    response.json({ enabled: await desk.setFlag(kind, key, enabled, request.authenticatedPublicId) });
  }));
  router.put('/desk/config/:kind/:key/label', writeLimiter, asyncRoute(async (request, response) => {
    const kind = z.enum(['pages', 'parts']).parse(request.params.kind);
    const key = z.string().regex(/^[a-z]+(?:\.[a-z]+)?$/).max(50).parse(request.params.key);
    const label = z.object({ label: z.string().trim().min(1).max(80) }).strict().parse(request.body).label;
    await desk.setLabel(kind, key, label, request.authenticatedPublicId);
    response.status(204).send();
  }));
  router.put('/desk/users/:publicId/status', writeLimiter, asyncRoute(async (request, response) => {
    const publicId = exactId.parse(request.params.publicId);
    const status = z.object({ status: z.enum(['active', 'suspended']) }).strict().parse(request.body).status;
    await desk.setUserStatus(publicId, status, request.authenticatedPublicId);
    response.json({ status });
  }));
  router.put('/desk/users/:publicId/name', writeLimiter, asyncRoute(async (request, response) => {
    await desk.setDisplayName(exactId.parse(request.params.publicId), nameBody.parse(request.body).displayName, request.authenticatedPublicId);
    response.status(204).send();
  }));
  router.put('/desk/posts/:section/:postId/visibility', writeLimiter, asyncRoute(async (request, response) => {
    await desk.setPostHidden(section.parse(request.params.section), uuid.parse(request.params.postId), !switchBody.parse(request.body).enabled, request.authenticatedPublicId);
    response.status(204).send();
  }));
  router.put('/desk/posts/:postId/content', writeLimiter, asyncRoute(async (request, response) => {
    await desk.setPostContent(uuid.parse(request.params.postId), contentBody.parse(request.body).content, request.authenticatedPublicId);
    response.status(204).send();
  }));
  router.delete('/desk/posts/:section/:postId', writeLimiter, asyncRoute(async (request, response) => {
    await desk.deletePost(section.parse(request.params.section), uuid.parse(request.params.postId), request.authenticatedPublicId);
    response.status(204).send();
  }));
  router.post('/desk/messages', writeLimiter, asyncRoute(async (request, response) => {
    const message = await desk.sendMessage(messageBody.parse(request.body), request.authenticatedPublicId);
    response.status(201).json({ message });
  }));
  router.delete('/desk/messages/:messageId', writeLimiter, asyncRoute(async (request, response) => {
    await desk.deleteMessage(uuid.parse(request.params.messageId), request.authenticatedPublicId);
    response.status(204).send();
  }));
  router.post('/desk/inbox/:messageId/reply', writeLimiter, asyncRoute(async (request, response) => {
    await desk.replyToInbox(uuid.parse(request.params.messageId), replyBody.parse(request.body).text, request.authenticatedPublicId);
    response.status(204).send();
  }));
  return router;
}
