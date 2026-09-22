import { Router, type Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';

import { AuthService } from '../auth/auth-service.js';
import { asyncRoute } from '../http/async-route.js';
import { TelephonyService } from './telephony-service.js';

const e164 = z.string().regex(/^\+[1-9]\d{1,14}$/, 'Must be a valid E.164 phone number');
const cursorQuery = z.object({
  cursor: z.string().min(1).max(256).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
const dialBody = z.object({ toE164: e164 }).strict();
const smsBody = z.object({ toE164: e164, body: z.string().trim().min(1).max(1_600) }).strict();

function bearerToken(request: Request): string {
  const [scheme, token] = (request.header('authorization') ?? '').split(' ', 2);
  return scheme?.toLowerCase() === 'bearer' ? token ?? '' : '';
}

function limiter(limit: number) {
  return rateLimit({ legacyHeaders: false, limit, standardHeaders: 'draft-8', windowMs: 60_000 });
}

export function createTelephonyRouter(authService: AuthService, service: TelephonyService): Router {
  const router = Router();

  router.use(
    asyncRoute(async (request, _response, next) => {
      request.authenticatedPublicId = (await authService.getUser(bearerToken(request))).publicId;
      next();
    }),
  );

  router.post(
    '/webrtc-credential',
    limiter(30),
    asyncRoute(async (request, response) => {
      response.json({ credential: await service.issueWebrtcCredential(request.authenticatedPublicId) });
    }),
  );

  router.post(
    '/calls',
    limiter(20),
    asyncRoute(async (request, response) => {
      dialBody.parse(request.body);
      await service.authorizeExternalCall(request.authenticatedPublicId);
      response.status(201).json({ authorized: true });
    }),
  );

  router.get(
    '/calls',
    asyncRoute(async (request, response) => {
      const query = cursorQuery.parse(request.query);
      response.json(await service.listCalls(request.authenticatedPublicId, query.limit, query.cursor));
    }),
  );

  router.post(
    '/sms',
    limiter(20),
    asyncRoute(async (request, response) => {
      const body = smsBody.parse(request.body);
      const message = await service.sendSms(request.authenticatedPublicId, body.toE164, body.body);
      response.status(201).json({ message });
    }),
  );

  router.get(
    '/sms',
    asyncRoute(async (request, response) => {
      const query = cursorQuery.parse(request.query);
      response.json(await service.listSms(request.authenticatedPublicId, query.limit, query.cursor));
    }),
  );

  return router;
}
