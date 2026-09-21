import Stripe from 'stripe';

import { ApiError } from '../http/api-error.js';
import type { CheckoutClient } from './billing-service.js';
import type { CheckoutSessionResult } from './billing-types.js';

export class StripeCheckoutClient implements CheckoutClient {
  private readonly stripe: Stripe;

  constructor(secretKey: string) {
    this.stripe = new Stripe(secretKey);
  }

  async createCheckoutSession(
    input: Readonly<{
      skuId: string;
      publicId: string;
      label: string;
      priceCents: number;
      currency: string;
      successUrl: string;
      cancelUrl: string;
    }>,
  ): Promise<CheckoutSessionResult> {
    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency,
            unit_amount: input.priceCents,
            product_data: { name: input.label },
          },
        },
      ],
      metadata: { publicId: input.publicId, skuId: input.skuId },
    });

    if (!session.url) {
      throw new ApiError(503, 'BILLING_UNAVAILABLE', 'Could not start checkout. Try again.');
    }

    return { checkoutUrl: session.url, checkoutSessionId: session.id };
  }

  /** Verifies the raw webhook body against the account's Stripe webhook signing secret. */
  constructEvent(rawBody: Buffer, signatureHeader: string, webhookSecret: string): Stripe.Event {
    try {
      return this.stripe.webhooks.constructEvent(rawBody, signatureHeader, webhookSecret);
    } catch {
      throw new ApiError(400, 'INVALID_SIGNATURE', 'The webhook signature is invalid.');
    }
  }
}
