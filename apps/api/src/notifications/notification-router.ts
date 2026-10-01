import { Router, type Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';

import { AuthService } from '../auth/auth-service.js';
import { asyncRoute } from '../http/async-route.js';
import { NotificationService } from './notification-service.js';
import { NotificationCenter } from './notification-center.js';
import { ApiError } from '../http/api-error.js';

const expoPushToken = z
  .string()
  .min(20)
  .max(256)
  .regex(/^(?:Exponent|Expo)PushToken\[[A-Za-z0-9_-]+\]$/);
const deviceId = z.string().uuid();
const legacyRegisterBody = z
  .object({
    deviceId,
    expoPushToken,
    platform: z.enum(['android', 'ios']),
  })
  .strict();
const unregisterBody = z.object({ deviceId }).strict();
const registerBody = z.union([legacyRegisterBody, z.object({ deviceId, fcmToken: z.string().min(20).max(4096), platform: z.enum(['android', 'ios', 'web']) }).strict()]);
const scopeSchema = z.enum(['user', 'admin']).default('user');
const categories = z.enum(['social', 'market', 'messages', 'administration', 'billing', 'reports', 'support']);

function bearerToken(request: Request): string {
  const [scheme, token] = (request.header('authorization') ?? '').split(' ', 2);
  return scheme?.toLowerCase() === 'bearer' ? token ?? '' : '';
}

export function createNotificationRouter(
  authService: AuthService,
  notificationService: NotificationService,
  center?: NotificationCenter,
): Router {
  const router = Router();

  router.use(
    rateLimit({
      legacyHeaders: false,
      limit: 60,
      standardHeaders: 'draft-8',
      windowMs: 60 * 1_000,
    }),
  );
  router.use(
    asyncRoute(async (request, _response, next) => {
      request.authenticatedPublicId = (
        await authService.getActor(bearerToken(request), request.header('x-acting-public-id') ?? undefined)
      ).publicId;
      next();
    }),
  );

  router.put(
    '/devices',
    asyncRoute(async (request, response) => {
      const body = registerBody.parse(request.body);
      const owner = await authService.getUser(bearerToken(request));
      await notificationService.registerDevice(request.authenticatedPublicId, { ...body, ownerPublicId: owner.publicId });
      response.status(204).end();
    }),
  );

  router.delete(
    '/devices',
    asyncRoute(async (request, response) => {
      const body = unregisterBody.parse(request.body);
      await notificationService.unregisterDevice(request.authenticatedPublicId, body.deviceId);
      response.status(204).end();
    }),
  );

  if (center) {
    const identity = async (request: Request, scope: 'user' | 'admin') => {
      if (scope === 'user') return request.authenticatedPublicId;
      const owner = await authService.getUser(bearerToken(request));
      if (owner.role !== 'admin') throw new ApiError(403, 'ADMIN_REQUIRED', 'Administrator access is required.');
      return owner.publicId;
    };
    router.get('/', asyncRoute(async (request, response) => {
      const query = z.object({ scope: scopeSchema, limit: z.coerce.number().int().min(1).max(50).default(20), cursor: z.string().max(500).optional() }).strict().parse(request.query);
      response.json(await center.list(await identity(request, query.scope), query.scope, query.limit, query.cursor));
    }));
    router.post('/read', asyncRoute(async (request, response) => {
      const body = z.object({ scope: scopeSchema, ids: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1).max(100) }).strict().parse(request.body);
      await center.markRead(await identity(request, body.scope), body.scope, body.ids, Date.now());
      response.status(204).end();
    }));
    router.get('/preferences', asyncRoute(async (request, response) => {
      const { scope } = z.object({ scope: scopeSchema }).strict().parse(request.query);
      response.json({ version: 1, preferences: await center.preferences(await identity(request, scope), scope) });
    }));
    router.put('/preferences', asyncRoute(async (request, response) => {
      const { scope, ...preferences } = z.object({ scope: scopeSchema, pushEnabled: z.boolean(), mutedCategories: z.array(categories).max(7) }).strict().parse(request.body);
      await center.setPreferences(await identity(request, scope), scope, preferences);
      response.status(204).end();
    }));
  }
  return router;
}
