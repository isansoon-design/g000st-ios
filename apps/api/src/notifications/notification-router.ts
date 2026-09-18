import { Router, type Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';

import { AuthService } from '../auth/auth-service.js';
import { asyncRoute } from '../http/async-route.js';
import { NotificationService } from './notification-service.js';

const expoPushToken = z
  .string()
  .min(20)
  .max(256)
  .regex(/^(?:Exponent|Expo)PushToken\[[A-Za-z0-9_-]+\]$/);
const deviceId = z.string().uuid();
const registerBody = z
  .object({
    deviceId,
    expoPushToken,
    platform: z.enum(['android', 'ios']),
  })
  .strict();
const unregisterBody = z.object({ deviceId }).strict();

function bearerToken(request: Request): string {
  const [scheme, token] = (request.header('authorization') ?? '').split(' ', 2);
  return scheme?.toLowerCase() === 'bearer' ? token ?? '' : '';
}

export function createNotificationRouter(
  authService: AuthService,
  notificationService: NotificationService,
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
        await authService.getUser(bearerToken(request))
      ).publicId;
      next();
    }),
  );

  router.put(
    '/devices',
    asyncRoute(async (request, response) => {
      const body = registerBody.parse(request.body);
      await notificationService.registerDevice(request.authenticatedPublicId, body);
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

  return router;
}
