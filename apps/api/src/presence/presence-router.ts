import { Router, type Request } from 'express';
import { rateLimit } from 'express-rate-limit';

import { AuthService } from '../auth/auth-service.js';
import { asyncRoute } from '../http/async-route.js';
import { PresenceService } from './presence-service.js';

function bearerToken(request: Request): string {
  const [scheme, token] = (request.header('authorization') ?? '').split(' ', 2);
  return scheme?.toLowerCase() === 'bearer' ? token ?? '' : '';
}

function limiter(limit: number) {
  return rateLimit({ legacyHeaders: false, limit, standardHeaders: 'draft-8', windowMs: 60_000 });
}

export function createPresenceRouter(authService: AuthService, service: PresenceService): Router {
  const router = Router();
  router.use(asyncRoute(async (request, _response, next) => {
    request.authenticatedPublicId = (await authService.getUser(bearerToken(request))).publicId;
    next();
  }));

  router.post('/heartbeat', limiter(40), asyncRoute(async (request, response) => {
    await service.heartbeat(request.authenticatedPublicId);
    response.status(204).send();
  }));

  return router;
}
