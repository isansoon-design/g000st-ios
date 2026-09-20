import { Router, type Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';

import { AuthService } from '../auth/auth-service.js';
import { G000ST_ID_LENGTH } from '../core/identity.js';
import { asyncRoute } from '../http/async-route.js';
import { SocialService } from './social-service.js';
import { MAX_AVATAR_BYTES, MAX_SOCIAL_IMAGES, MAX_SOCIAL_MEDIA_BYTES } from './social-policy.js';

const uuid = z.string().uuid();
const publicId = z.string().length(G000ST_ID_LENGTH).regex(/^[A-Za-z0-9]+$/);
const visibility = z.enum(['anonymous', 'public']);
const cursorQuery = z.object({ cursor: z.string().min(1).max(256).optional(), limit: z.coerce.number().int().min(1).max(50).default(20) });
const socialContentType = z.enum(['image/gif', 'image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']);
const pendingMedia = z.object({ byteSize: z.number().int().positive().max(MAX_SOCIAL_MEDIA_BYTES), contentType: socialContentType, fileName: z.string().min(1).max(255), id: uuid, objectKey: z.string().min(1).max(600) }).strict();
const createPostBody = z.object({ clientPostId: uuid, content: z.string().trim().min(1).max(4_000), media: z.array(pendingMedia).max(MAX_SOCIAL_IMAGES).optional(), visibility: visibility.default('anonymous') }).strict().superRefine((value, context) => {
  const videoCount = value.media?.filter((item) => item.contentType.startsWith('video/')).length ?? 0;
  if (videoCount > 0 && (videoCount !== 1 || value.media?.length !== 1)) context.addIssue({ code: 'custom', message: 'A post can contain up to two images or one video.', path: ['media'] });
});
const uploadBody = z.object({ byteSize: z.number().int().positive().max(MAX_SOCIAL_MEDIA_BYTES), clientPostId: uuid, contentType: socialContentType, fileName: z.string().min(1).max(255) }).strict();
const updatePostBody = z.object({ content: z.string().trim().min(1).max(4_000) }).strict();
const createCommentBody = z.object({ content: z.string().trim().min(1).max(1_000), visibility: visibility.default('anonymous') }).strict();
const avatarContentType = z.enum(['image/gif', 'image/jpeg', 'image/png', 'image/webp']);
const avatarUploadBody = z.object({ byteSize: z.number().int().positive().max(MAX_AVATAR_BYTES), contentType: avatarContentType, fileName: z.string().min(1).max(255) }).strict();
const pendingAvatarMedia = z.object({ byteSize: z.number().int().positive().max(MAX_AVATAR_BYTES), contentType: avatarContentType, fileName: z.string().min(1).max(255), id: uuid, objectKey: z.string().min(1).max(600) }).strict();
const profileBody = z.object({ displayName: z.string().trim().min(1).max(60).optional(), avatarMedia: pendingAvatarMedia.optional(), country: z.string().trim().min(1).max(80).optional(), age: z.number().int().min(13).max(120).optional(), sex: z.enum(['male', 'female']).optional(), hobby: z.string().trim().min(1).max(100).optional(), bio: z.string().trim().min(1).max(500).optional() }).strict();
const reportBody = z.object({ postId: uuid, commentId: uuid.optional(), reason: z.enum(['spam', 'harassment', 'violence', 'sexual', 'privacy', 'other']), details: z.string().trim().max(1_000).optional() }).strict();

function bearerToken(request: Request): string {
  const [scheme, token] = (request.header('authorization') ?? '').split(' ', 2);
  return scheme?.toLowerCase() === 'bearer' ? token ?? '' : '';
}

function limiter(limit: number) {
  return rateLimit({ legacyHeaders: false, limit, standardHeaders: 'draft-8', windowMs: 60_000 });
}

export function createSocialRouter(authService: AuthService, service: SocialService): Router {
  const router = Router();
  router.use(asyncRoute(async (request, _response, next) => {
    request.authenticatedPublicId = (await authService.getUser(bearerToken(request))).publicId;
    next();
  }));

  router.get('/posts', asyncRoute(async (request, response) => {
    const query = cursorQuery.extend({ ownerId: publicId.optional() }).parse(request.query);
    response.json(await service.listPosts(request.authenticatedPublicId, query.limit, query.cursor, query.ownerId));
  }));
  router.post('/posts', limiter(12), asyncRoute(async (request, response) => {
    const { clientPostId, ...body } = createPostBody.parse(request.body);
    response.status(201).json({ post: await service.createPost(request.authenticatedPublicId, body, clientPostId) });
  }));
  router.post('/uploads', limiter(20), asyncRoute(async (request, response) => { response.status(201).json({ upload: await service.createUpload(request.authenticatedPublicId, uploadBody.parse(request.body)) }); }));
  router.get('/posts/:postId', asyncRoute(async (request, response) => { response.json({ post: await service.getPost(request.authenticatedPublicId, uuid.parse(request.params.postId)) }); }));
  router.patch('/posts/:postId', limiter(30), asyncRoute(async (request, response) => { response.json({ post: await service.updatePost(request.authenticatedPublicId, uuid.parse(request.params.postId), updatePostBody.parse(request.body).content) }); }));
  router.delete('/posts/:postId', limiter(30), asyncRoute(async (request, response) => { await service.deletePost(request.authenticatedPublicId, uuid.parse(request.params.postId)); response.status(204).send(); }));
  router.post('/posts/:postId/like', limiter(120), asyncRoute(async (request, response) => { response.json(await service.toggleLike(request.authenticatedPublicId, uuid.parse(request.params.postId))); }));
  router.get('/posts/:postId/comments', asyncRoute(async (request, response) => { const query = cursorQuery.parse(request.query); response.json(await service.listComments(request.authenticatedPublicId, uuid.parse(request.params.postId), query.limit, query.cursor)); }));
  router.post('/posts/:postId/comments', limiter(60), asyncRoute(async (request, response) => { response.status(201).json({ comment: await service.createComment(request.authenticatedPublicId, uuid.parse(request.params.postId), createCommentBody.parse(request.body)) }); }));
  router.delete('/posts/:postId/comments/:commentId', limiter(60), asyncRoute(async (request, response) => { await service.deleteComment(request.authenticatedPublicId, uuid.parse(request.params.postId), uuid.parse(request.params.commentId)); response.status(204).send(); }));
  router.post('/profiles/:publicId/camp', limiter(60), asyncRoute(async (request, response) => { response.json(await service.toggleCamp(request.authenticatedPublicId, publicId.parse(request.params.publicId))); }));
  router.get('/profiles/:publicId', asyncRoute(async (request, response) => { response.json({ profile: await service.getProfile(request.authenticatedPublicId, publicId.parse(request.params.publicId)) }); }));
  router.put('/profile', limiter(20), asyncRoute(async (request, response) => { response.json({ profile: await service.updateProfile(request.authenticatedPublicId, profileBody.parse(request.body)) }); }));
  router.post('/avatar-uploads', limiter(20), asyncRoute(async (request, response) => { response.status(201).json({ upload: await service.createAvatarUpload(request.authenticatedPublicId, avatarUploadBody.parse(request.body)) }); }));
  router.get('/alerts', asyncRoute(async (request, response) => { const query = cursorQuery.parse(request.query); response.json(await service.listAlerts(request.authenticatedPublicId, query.limit, query.cursor)); }));
  router.post('/alerts/read', limiter(30), asyncRoute(async (request, response) => { await service.markAlertsRead(request.authenticatedPublicId); response.status(204).send(); }));
  router.post('/reports', limiter(10), asyncRoute(async (request, response) => { await service.report(request.authenticatedPublicId, reportBody.parse(request.body)); response.status(201).json({ ok: true }); }));
  return router;
}
