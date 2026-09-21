import { Router, type Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';

import { AuthService } from '../auth/auth-service.js';
import { requireAdminRole } from '../auth/require-admin-role.js';
import { G000ST_ID_LENGTH } from '../core/identity.js';
import { asyncRoute } from '../http/async-route.js';
import { BillingService } from './billing-service.js';

const publicId = z.string().length(G000ST_ID_LENGTH).regex(/^[A-Za-z0-9]+$/);
const cursorQuery = z.object({
  cursor: z.string().min(1).max(256).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
const checkoutSessionBody = z
  .object({ skuId: z.string().min(1).max(64), returnTo: z.enum(['mobile', 'web']) })
  .strict();
const adjustBody = z
  .object({
    voiceSecondsDelta: z.number().int(),
    smsDelta: z.number().int(),
    reason: z.string().trim().min(1).max(500),
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

export function createBillingRouter(authService: AuthService, service: BillingService): Router {
  const router = Router();

  router.use(
    asyncRoute(async (request, _response, next) => {
      const user = await authService.getUser(bearerToken(request));
      request.authenticatedPublicId = user.publicId;
      request.authenticatedRole = user.role;
      next();
    }),
  );

  router.get(
    '/skus',
    asyncRoute(async (_request, response) => {
      response.json({ skus: service.listSkus() });
    }),
  );

  router.post(
    '/checkout-sessions',
    limiter(20),
    asyncRoute(async (request, response) => {
      const body = checkoutSessionBody.parse(request.body);
      const session = await service.createCheckoutSession(
        request.authenticatedPublicId,
        body.skuId,
        body.returnTo,
      );
      response.status(201).json(session);
    }),
  );

  router.get(
    '/balance',
    asyncRoute(async (request, response) => {
      response.json({ balance: await service.getBalance(request.authenticatedPublicId) });
    }),
  );

  router.get(
    '/ledger',
    asyncRoute(async (request, response) => {
      const query = cursorQuery.parse(request.query);
      response.json(await service.listLedger(request.authenticatedPublicId, query.limit, query.cursor));
    }),
  );

  router.get(
    '/admin/users/:publicId',
    requireAdminRole,
    asyncRoute(async (request, response) => {
      const targetPublicId = publicId.parse(request.params.publicId);
      response.json({ balance: await service.getBalance(targetPublicId) });
    }),
  );

  router.get(
    '/admin/users/:publicId/ledger',
    requireAdminRole,
    asyncRoute(async (request, response) => {
      const targetPublicId = publicId.parse(request.params.publicId);
      const query = cursorQuery.parse(request.query);
      response.json(await service.listLedger(targetPublicId, query.limit, query.cursor));
    }),
  );

  router.post(
    '/admin/users/:publicId/adjust',
    requireAdminRole,
    limiter(30),
    asyncRoute(async (request, response) => {
      const targetPublicId = publicId.parse(request.params.publicId);
      const body = adjustBody.parse(request.body);
      const balance = await service.adminAdjustBalance(
        targetPublicId,
        request.authenticatedPublicId,
        body.voiceSecondsDelta,
        body.smsDelta,
        body.reason,
      );
      response.json({ balance });
    }),
  );

  return router;
}
