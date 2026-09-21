import { Router, type Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';

import { AuthService } from '../auth/auth-service.js';
import { asyncRoute } from '../http/async-route.js';
import { CallingService } from './calling-service.js';

const cursorQuery = z.object({
  cursor: z.string().min(1).max(256).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
const voipTokenBody = z
  .object({
    deviceId: z.string().min(1).max(200),
    tokenType: z.enum(['APNS_VOIP', 'FCM']),
    token: z.string().min(1).max(4_000),
  })
  .strict();

function bearerToken(request: Request): string {
  const [scheme, token] = (request.header('authorization') ?? '').split(' ', 2);
  return scheme?.toLowerCase() === 'bearer' ? token ?? '' : '';
}

function limiter(limit: number) {
  return rateLimit({ legacyHeaders: false, limit, standardHeaders: 'draft-8', windowMs: 60_000 });
}

declare global {
  namespace Express {
    interface Request {
      authenticatedPublicId: string;
    }
  }
}

export function createCallingRouter(authService: AuthService, service: CallingService): Router {
  const router = Router();

  router.use(
    asyncRoute(async (request, _response, next) => {
      request.authenticatedPublicId = (await authService.getUser(bearerToken(request))).publicId;
      next();
    }),
  );

  router.post(
    '/turn-credential',
    limiter(30),
    asyncRoute(async (request, response) => {
      response.json({ credential: await service.issueTurnCredential(request.authenticatedPublicId) });
    }),
  );

  router.get(
    '/history',
    asyncRoute(async (request, response) => {
      const query = cursorQuery.parse(request.query);
      response.json(await service.listHistory(request.authenticatedPublicId, query.limit, query.cursor));
    }),
  );

  router.post(
    '/voip-token',
    limiter(30),
    asyncRoute(async (request, response) => {
      const body = voipTokenBody.parse(request.body);
      await service.registerVoipDevice(request.authenticatedPublicId, body.deviceId, body.tokenType, body.token);
      response.status(204).send();
    }),
  );

  router.delete(
    '/voip-token/:deviceId',
    limiter(30),
    asyncRoute(async (request, response) => {
      const deviceId = z.string().min(1).max(200).parse(request.params.deviceId);
      await service.unregisterVoipDevice(request.authenticatedPublicId, deviceId);
      response.status(204).send();
    }),
  );

  return router;
}
