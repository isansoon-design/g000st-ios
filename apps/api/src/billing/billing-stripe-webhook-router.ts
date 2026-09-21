import { Router } from 'express';
import type Stripe from 'stripe';

import { ApiError } from '../http/api-error.js';
import { asyncRoute } from '../http/async-route.js';
import type { BillingService } from './billing-service.js';
import type { StripeCheckoutClient } from './stripe-client.js';

export function createBillingStripeWebhookRouter(
  stripeClient: StripeCheckoutClient,
  webhookSecret: string,
  service: BillingService,
): Router {
  const router = Router();

  router.post(
    '/',
    asyncRoute(async (request, response) => {
      const signature = request.header('stripe-signature') ?? '';
      if (!request.rawBody) {
        throw new ApiError(400, 'INVALID_SIGNATURE', 'The webhook signature is invalid.');
      }

      // Verification happens before anything else touches the event payload. A thrown
      // ApiError here propagates straight to the error handler as 400 INVALID_SIGNATURE
      // without ever calling into BillingService — no ledger write on a bad signature.
      const event = stripeClient.constructEvent(request.rawBody, signature, webhookSecret);

      if (event.type === 'checkout.session.completed') {
        await applyCompletedCheckout(event, service);
      }

      response.status(200).json({ received: true });
    }),
  );

  return router;
}

async function applyCompletedCheckout(event: Stripe.CheckoutSessionCompletedEvent, service: BillingService): Promise<void> {
  const session = event.data.object;
  const publicId = session.metadata?.publicId;
  const skuId = session.metadata?.skuId;

  if (session.payment_status !== 'paid' || !publicId || !skuId) return;

  await service.applyCheckoutCompleted({ checkoutSessionId: session.id, publicId, skuId });
}
