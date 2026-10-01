import { Router, type Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';

import { AuthService } from '../auth/auth-service.js';
import { asyncRoute } from '../http/async-route.js';
import { AdminDeskService } from './admin-desk.js';

function bearerToken(request: Request): string {
  const [scheme, token] = (request.header('authorization') ?? '').split(' ', 2);
  return scheme?.toLowerCase() === 'bearer' ? token ?? '' : '';
}

export function createCommunicationRouter(auth: AuthService, desk: AdminDeskService): Router {
  const router = Router();
  router.get('/experience', asyncRoute(async (_request, response) => {
    response.json(await desk.getExperienceConfig());
  }));
  router.use(asyncRoute(async (request, _response, next) => {
    request.authenticatedPublicId = (await auth.getUser(bearerToken(request))).publicId;
    next();
  }));
  router.get('/notices', asyncRoute(async (request, response) => {
    const actor = await auth.getActor(bearerToken(request), request.header('x-acting-public-id') ?? undefined);
    response.json({ notices: await desk.listNotices(actor.publicId) });
  }));
  router.get('/notices/:noticeId', asyncRoute(async (request, response) => {
    const actor = await auth.getActor(bearerToken(request), request.header('x-acting-public-id') ?? undefined);
    response.json({ version: 1, notice: await desk.getNotice(actor.publicId, z.string().uuid().parse(request.params.noticeId)) });
  }));
  router.post('/contact', rateLimit({ legacyHeaders: false, limit: 5, standardHeaders: 'draft-8', windowMs: 60 * 60_000 }), asyncRoute(async (request, response) => {
    const { text } = z.object({ text: z.string().trim().min(1).max(2_000) }).strict().parse(request.body);
    await desk.createSupportMessage(request.authenticatedPublicId, text);
    response.status(201).json({ ok: true });
  }));
  return router;
}
