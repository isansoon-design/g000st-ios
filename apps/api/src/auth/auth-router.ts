import { Router, type Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';

import { AuthService } from './auth-service.js';
import { G000ST_ID_LENGTH } from '../core/identity.js';
import { asyncRoute } from '../http/async-route.js';

const exactId = z.string().length(G000ST_ID_LENGTH).regex(/^[A-Za-z0-9]+$/);
const registerBody = z.object({ requestedPublicId: exactId.optional() }).strict();
const restoreBody = z.object({ recoveryId: exactId }).strict();
const refreshBody = z.object({ refreshToken: z.string().min(1).max(512) }).strict();

function authRateLimit(max: number) {
  return rateLimit({
    handler: (_request, response) => {
      response.status(429).json({ code: 'RATE_LIMITED', message: 'Too many attempts. Try later.' });
    },
    legacyHeaders: false,
    limit: max,
    standardHeaders: 'draft-8',
    windowMs: 15 * 60 * 1_000,
  });
}

function bearerToken(request: Request): string {
  const authorization = request.header('authorization') ?? '';
  const [scheme, token] = authorization.split(' ', 2);
  return scheme?.toLowerCase() === 'bearer' ? token ?? '' : '';
}

export function createAuthRouter(authService: AuthService): Router {
  const router = Router();

  router.post(
    '/register',
    authRateLimit(10),
    asyncRoute(async (request, response) => {
      const body = registerBody.parse(request.body);
      const result = await authService.register(body.requestedPublicId);
      response.status(201).json(result);
    }),
  );

  router.post(
    '/sessions',
    authRateLimit(10),
    asyncRoute(async (request, response) => {
      const body = restoreBody.parse(request.body);
      response.status(200).json(await authService.restore(body.recoveryId));
    }),
  );

  router.post(
    '/token/refresh',
    authRateLimit(60),
    asyncRoute(async (request, response) => {
      const body = refreshBody.parse(request.body);
      response.status(200).json({ session: await authService.refresh(body.refreshToken) });
    }),
  );

  router.get(
    '/me',
    asyncRoute(async (request, response) => {
      response.status(200).json({ user: await authService.getUser(bearerToken(request)) });
    }),
  );

  router.delete(
    '/me',
    authRateLimit(5),
    asyncRoute(async (request, response) => {
      await authService.deleteAccount(bearerToken(request));
      response.status(204).send();
    }),
  );

  return router;
}
