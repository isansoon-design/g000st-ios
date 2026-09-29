import { Router, type Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';

import { AuthService } from '../auth/auth-service.js';
import { G000ST_ID_LENGTH } from '../core/identity.js';
import { asyncRoute } from '../http/async-route.js';
import { ApiError } from '../http/api-error.js';
import { SocialService } from './social-service.js';
import { MAX_AVATAR_BYTES, MAX_SOCIAL_IMAGES, MAX_SOCIAL_MEDIA_BYTES } from './social-policy.js';
import { normalizeLandlineNumber, normalizePageSocialUrl, normalizeWhatsAppNumber, type PageSocialPlatform } from './page-contact-policy.js';

const uuid = z.string().uuid();
const publicId = z.string().length(G000ST_ID_LENGTH).regex(/^[A-Za-z0-9]+$/);
const visibility = z.enum(['anonymous', 'public']);
const cursorQuery = z.object({ cursor: z.string().min(1).max(256).optional(), limit: z.coerce.number().int().min(1).max(50).default(20) });
const socialContentType = z.enum(['image/gif', 'image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']);
const pendingMedia = z.object({ byteSize: z.number().int().positive().max(MAX_SOCIAL_MEDIA_BYTES), contentType: socialContentType, fileName: z.string().min(1).max(255), id: uuid, objectKey: z.string().min(1).max(600) }).strict();
const createPostBody = z.object({ clientPostId: uuid, content: z.string().trim().max(4_000), sharedPostId: uuid.optional(), media: z.array(pendingMedia).max(MAX_SOCIAL_IMAGES).optional(), visibility: visibility.default('anonymous'), shareToSocial: z.boolean().default(true) }).strict().superRefine((value, context) => {
  if (!value.content && !value.sharedPostId) context.addIssue({ code: 'custom', message: 'A post must contain text or share another post.', path: ['content'] });
  if (value.sharedPostId && value.media?.length) context.addIssue({ code: 'custom', message: 'A shared post cannot include new media.', path: ['media'] });
  const videoCount = value.media?.filter((item) => item.contentType.startsWith('video/')).length ?? 0;
  if (videoCount > 0 && (videoCount !== 1 || value.media?.length !== 1)) context.addIssue({ code: 'custom', message: 'A post can contain up to two images or one video.', path: ['media'] });
});
const uploadBody = z.object({ byteSize: z.number().int().positive().max(MAX_SOCIAL_MEDIA_BYTES), clientPostId: uuid, contentType: socialContentType, fileName: z.string().min(1).max(255) }).strict();
const updatePostBody = z.object({ content: z.string().trim().min(1).max(4_000) }).strict();
const createCommentBody = z.object({ content: z.string().trim().min(1).max(1_000), visibility: visibility.default('anonymous') }).strict();
const avatarContentType = z.enum(['image/gif', 'image/jpeg', 'image/png', 'image/webp']);
const avatarUploadBody = z.object({ byteSize: z.number().int().positive().max(MAX_AVATAR_BYTES), contentType: avatarContentType, fileName: z.string().min(1).max(255) }).strict();
const pendingAvatarMedia = z.object({ byteSize: z.number().int().positive().max(MAX_AVATAR_BYTES), contentType: avatarContentType, fileName: z.string().min(1).max(255), id: uuid, objectKey: z.string().min(1).max(600) }).strict();
const socialLink = (platform: PageSocialPlatform) => z.string().trim().max(300).refine((value) => !value || !!normalizePageSocialUrl(value, platform), 'Enter a valid HTTPS profile link.').transform((value) => value ? normalizePageSocialUrl(value, platform)! : '');
const whatsappNumber = z.string().trim().max(32).refine((value) => !value || !!normalizeWhatsAppNumber(value), 'Enter a number with + or 00 and its country code.').transform((value) => value ? normalizeWhatsAppNumber(value)! : '');
const landlineNumber = z.string().trim().max(32).refine((value) => !value || !!normalizeLandlineNumber(value), 'Enter a valid landline number.').transform((value) => value ? normalizeLandlineNumber(value)! : '');
const profileBody = z.object({ displayName: z.string().trim().min(1).max(60).optional(), showDisplayName: z.boolean().optional(), avatarMedia: pendingAvatarMedia.optional(), coverMedia: pendingAvatarMedia.optional(), country: z.string().trim().min(1).max(80).optional(), age: z.number().int().min(13).max(120).optional(), sex: z.enum(['male', 'female']).optional(), hobby: z.string().trim().min(1).max(100).optional(), bio: z.string().trim().max(500).optional(), whatsappNumber: whatsappNumber.optional(), landlineNumber: landlineNumber.optional(), contactEmail: z.union([z.string().trim().email().max(254), z.literal('')]).optional(), facebookUrl: socialLink('facebook').optional(), instagramUrl: socialLink('instagram').optional(), tiktokUrl: socialLink('tiktok').optional(), linkedinUrl: socialLink('linkedin').optional() }).strict();
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
    request.authenticatedPublicId = (await authService.getActor(bearerToken(request), request.header('x-acting-public-id') ?? undefined)).publicId;
    next();
  }));

  router.get('/posts', asyncRoute(async (request, response) => {
    const query = cursorQuery.extend({ ownerId: publicId.optional(), publicOnly: z.enum(['true', 'false']).optional() }).parse(request.query);
    response.json(await service.listPosts(request.authenticatedPublicId, query.limit, query.cursor, query.ownerId, query.publicOnly === 'true'));
  }));
  router.get('/suggestions', limiter(30), asyncRoute(async (request, response) => {
    response.json(await service.listSuggestions(request.authenticatedPublicId));
  }));
  router.post('/profiles/:publicId/follow', limiter(60), asyncRoute(async (request, response) => {
    await service.follow(request.authenticatedPublicId, publicId.parse(request.params.publicId));
    response.json({ following: true });
  }));
  router.post('/posts', limiter(12), asyncRoute(async (request, response) => {
    const { clientPostId, shareToSocial, ...body } = createPostBody.parse(request.body);
    response.status(201).json({ post: await service.createPost(request.authenticatedPublicId, { ...body, sharedToSocial: shareToSocial }, clientPostId) });
  }));
  router.post('/uploads', limiter(20), asyncRoute(async (request, response) => { response.status(201).json({ upload: await service.createUpload(request.authenticatedPublicId, uploadBody.parse(request.body)) }); }));
  router.get('/posts/:postId', asyncRoute(async (request, response) => { response.json({ post: await service.getPost(request.authenticatedPublicId, uuid.parse(request.params.postId)) }); }));
  router.patch('/posts/:postId', limiter(30), asyncRoute(async (request, response) => { response.json({ post: await service.updatePost(request.authenticatedPublicId, uuid.parse(request.params.postId), updatePostBody.parse(request.body).content) }); }));
  router.post('/posts/:postId/share-to-social', limiter(30), asyncRoute(async (request, response) => { response.json({ post: await service.shareToSocial(request.authenticatedPublicId, uuid.parse(request.params.postId)) }); }));
  router.delete('/posts/:postId', limiter(30), asyncRoute(async (request, response) => { await service.deletePost(request.authenticatedPublicId, uuid.parse(request.params.postId)); response.status(204).send(); }));
  router.post('/posts/:postId/like', limiter(120), asyncRoute(async (request, response) => { response.json(await service.toggleLike(request.authenticatedPublicId, uuid.parse(request.params.postId))); }));
  router.get('/posts/:postId/comments', asyncRoute(async (request, response) => { const query = cursorQuery.parse(request.query); response.json(await service.listComments(request.authenticatedPublicId, uuid.parse(request.params.postId), query.limit, query.cursor)); }));
  router.post('/posts/:postId/comments', limiter(60), asyncRoute(async (request, response) => {
    const body = createCommentBody.parse(request.body);
    response.status(201).json({ comment: await service.createComment(request.authenticatedPublicId, uuid.parse(request.params.postId), body) });
  }));
  router.delete('/posts/:postId/comments/:commentId', limiter(60), asyncRoute(async (request, response) => { await service.deleteComment(request.authenticatedPublicId, uuid.parse(request.params.postId), uuid.parse(request.params.commentId)); response.status(204).send(); }));
  router.post('/profiles/:publicId/camp', limiter(60), asyncRoute(async (request, response) => { response.json(await service.toggleCamp(request.authenticatedPublicId, publicId.parse(request.params.publicId))); }));
  router.get('/profiles/:publicId', asyncRoute(async (request, response) => { response.json({ profile: await service.getProfile(request.authenticatedPublicId, publicId.parse(request.params.publicId)) }); }));
  router.put('/profile', limiter(20), asyncRoute(async (request, response) => {
    const body = profileBody.parse(request.body);
    if (await authService.isPage(request.authenticatedPublicId)) {
      if (body.showDisplayName === false || body.displayName === '') throw new ApiError(400, 'PAGE_NAME_REQUIRED', 'A page must show its name.');
      body.showDisplayName = true;
    }
    response.json({ profile: await service.updateProfile(request.authenticatedPublicId, body) });
  }));
  router.post('/avatar-uploads', limiter(20), asyncRoute(async (request, response) => { response.status(201).json({ upload: await service.createAvatarUpload(request.authenticatedPublicId, avatarUploadBody.parse(request.body)) }); }));
  router.post('/cover-uploads', limiter(20), asyncRoute(async (request, response) => { response.status(201).json({ upload: await service.createCoverUpload(request.authenticatedPublicId, avatarUploadBody.parse(request.body)) }); }));
  router.get('/alerts', asyncRoute(async (request, response) => { const query = cursorQuery.parse(request.query); response.json(await service.listAlerts(request.authenticatedPublicId, query.limit, query.cursor)); }));
  router.post('/alerts/read', limiter(30), asyncRoute(async (request, response) => { await service.markAlertsRead(request.authenticatedPublicId); response.status(204).send(); }));
  router.post('/reports', limiter(10), asyncRoute(async (request, response) => { await service.report(request.authenticatedPublicId, reportBody.parse(request.body)); response.status(201).json({ ok: true }); }));
  return router;
}
