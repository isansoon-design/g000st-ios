import { Router, type Request } from 'express';

import { ApiError } from '../http/api-error.js';
import { asyncRoute } from '../http/async-route.js';
import type { TelephonyService } from './telephony-service.js';
import { verifyTelnyxWebhook } from './telnyx-webhook-verify.js';

export function createTelephonyWebhookRouter(service: TelephonyService, publicKeyBase64: string): Router {
  const router = Router();

  router.post(
    '/calls',
    asyncRoute(async (request, response) => {
      verifyRequest(request, publicKeyBase64);
      await service.handleCallWebhookEvent(request.body);
      response.status(200).json({ received: true });
    }),
  );

  router.post(
    '/sms',
    asyncRoute(async (request, response) => {
      verifyRequest(request, publicKeyBase64);
      await service.handleSmsWebhookEvent(request.body);
      response.status(200).json({ received: true });
    }),
  );

  return router;
}

function verifyRequest(request: Request, publicKeyBase64: string): void {
  if (!request.rawBody) {
    throw new ApiError(400, 'INVALID_SIGNATURE', 'The webhook signature is invalid.');
  }

  // Verification happens before anything else touches the payload — a thrown ApiError here
  // propagates straight to the error handler as 400 INVALID_SIGNATURE without ever calling
  // into TelephonyService, mirroring billing-stripe-webhook-router.ts.
  verifyTelnyxWebhook(
    request.rawBody,
    request.header('telnyx-signature-ed25519'),
    request.header('telnyx-timestamp'),
    publicKeyBase64,
  );
}
