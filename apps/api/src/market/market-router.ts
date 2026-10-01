import { Router, type Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';

import { AuthService } from '../auth/auth-service.js';
import { G000ST_ID_LENGTH } from '../core/identity.js';
import { asyncRoute } from '../http/async-route.js';
import { MAX_SOCIAL_IMAGES, MAX_SOCIAL_MEDIA_BYTES } from '../social/social-policy.js';
import { MarketService } from './market-service.js';

const uuid = z.string().uuid();
const publicId = z.string().length(G000ST_ID_LENGTH).regex(/^[A-Za-z0-9]+$/);
const cursorQuery = z.object({ cursor: z.string().min(1).max(256).optional(), limit: z.coerce.number().int().min(1).max(50).default(20) });
const mediaType = z.enum(['image/gif', 'image/jpeg', 'image/png', 'image/webp']);
const pendingMedia = z.object({ byteSize: z.number().int().positive().max(MAX_SOCIAL_MEDIA_BYTES), contentType: mediaType, fileName: z.string().min(1).max(255), id: uuid, objectKey: z.string().min(1).max(600) }).strict();
const fields = { content: z.string().trim().min(1).max(4_000), price: z.number().finite().nonnegative().max(1_000_000_000), currency: z.string().trim().length(3).regex(/^[A-Za-z]{3}$/).default('GBP'), quantity: z.number().int().positive().max(1_000_000), city: z.string().trim().min(1).max(100), allowCalls: z.boolean().default(false), allowVideoCalls: z.boolean().default(false) };
const createBody = z.object({ clientPostId: uuid, ...fields, media: z.array(pendingMedia).max(MAX_SOCIAL_IMAGES).optional() }).strict();
const updateBody = z.object({ ...fields, allowCalls: z.boolean().optional(), allowVideoCalls: z.boolean().optional() }).strict();
const uploadBody = z.object({ byteSize: z.number().int().positive().max(MAX_SOCIAL_MEDIA_BYTES), clientPostId: uuid, contentType: mediaType, fileName: z.string().min(1).max(255) }).strict();
const commentBody = z.object({ content: z.string().trim().min(1).max(1_000) }).strict();
const reportBody = z.object({ postId: uuid, reason: z.enum(['spam', 'harassment', 'violence', 'sexual', 'privacy', 'other']), details: z.string().trim().max(1_000).optional() }).strict();
function bearerToken(request: Request) { const [scheme, token] = (request.header('authorization') ?? '').split(' ', 2); return scheme?.toLowerCase() === 'bearer' ? token ?? '' : ''; }
function limiter(limit: number) { return rateLimit({ legacyHeaders: false, limit, standardHeaders: 'draft-8', windowMs: 60_000 }); }

export function createMarketRouter(authService: AuthService, service: MarketService): Router {
  const router = Router();
  router.use(asyncRoute(async (request, _response, next) => { request.authenticatedPublicId = (await authService.getActor(bearerToken(request), request.header('x-acting-public-id') ?? undefined)).publicId; next(); }));
  router.get('/posts', asyncRoute(async (request, response) => { const query = cursorQuery.extend({ ownerId: publicId.optional() }).parse(request.query); response.json(await service.listPosts(request.authenticatedPublicId, query.limit, query.cursor, query.ownerId)); }));
  router.post('/posts', limiter(12), asyncRoute(async (request, response) => { const { clientPostId, ...body } = createBody.parse(request.body); await authService.assertPageCanPublish(request.authenticatedPublicId); response.status(201).json({ post: await service.createPost(request.authenticatedPublicId, body, clientPostId) }); }));
  router.post('/uploads', limiter(20), asyncRoute(async (request, response) => { response.status(201).json({ upload: await service.createUpload(request.authenticatedPublicId, uploadBody.parse(request.body)) }); }));
  router.get('/posts/:postId', asyncRoute(async (request, response) => { response.json({ post: await service.getPost(request.authenticatedPublicId, uuid.parse(request.params.postId)) }); }));
  router.patch('/posts/:postId', limiter(30), asyncRoute(async (request, response) => { response.json({ post: await service.updatePost(request.authenticatedPublicId, uuid.parse(request.params.postId), updateBody.parse(request.body)) }); }));
  router.delete('/posts/:postId', limiter(30), asyncRoute(async (request, response) => { await service.deletePost(request.authenticatedPublicId, uuid.parse(request.params.postId)); response.status(204).send(); }));
  router.post('/posts/:postId/like', limiter(120), asyncRoute(async (request, response) => { response.json(await service.toggleLike(request.authenticatedPublicId, uuid.parse(request.params.postId))); }));
  router.get('/posts/:postId/comments', asyncRoute(async (request, response) => { const query = cursorQuery.parse(request.query); response.json(await service.listComments(request.authenticatedPublicId, uuid.parse(request.params.postId), query.limit, query.cursor)); }));
  router.post('/posts/:postId/comments', limiter(60), asyncRoute(async (request, response) => { const content = commentBody.parse(request.body).content; await authService.assertPageCanPublish(request.authenticatedPublicId); response.status(201).json({ comment: await service.createComment(request.authenticatedPublicId, uuid.parse(request.params.postId), content) }); }));
  router.delete('/posts/:postId/comments/:commentId', limiter(60), asyncRoute(async (request, response) => { await service.deleteComment(request.authenticatedPublicId, uuid.parse(request.params.postId), uuid.parse(request.params.commentId)); response.status(204).send(); }));
  router.post('/reports', limiter(10), asyncRoute(async (request, response) => { await service.report(request.authenticatedPublicId, reportBody.parse(request.body)); response.status(201).json({ ok: true }); }));
  return router;
}
