import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';

import express, { type ErrorRequestHandler } from 'express';
import Stripe from 'stripe';

import type { CheckoutClient } from '../src/billing/billing-service.js';
import { BillingService } from '../src/billing/billing-service.js';
import { createBillingStripeWebhookRouter } from '../src/billing/billing-stripe-webhook-router.js';
import type { ApplyLedgerEntryInput, ApplyLedgerEntryResult, BillingStore } from '../src/billing/billing-store.js';
import type { Balance, BillingPage, LedgerEvent } from '../src/billing/billing-types.js';
import { StripeCheckoutClient } from '../src/billing/stripe-client.js';
import { ApiError } from '../src/http/api-error.js';

const WEBHOOK_SECRET = 'whsec_test_only_secret';
const USER = 'A'.repeat(50);

class SpyBillingStore implements BillingStore {
  readonly applyCalls: ApplyLedgerEntryInput[] = [];
  private balance: Balance = { voiceSecondsRemaining: 0, smsRemaining: 0, updatedAtMs: 0 };

  async getBalance(): Promise<Balance> {
    return this.balance;
  }

  async applyLedgerEntry(input: ApplyLedgerEntryInput): Promise<ApplyLedgerEntryResult> {
    if (this.applyCalls.some((call) => call.idempotencyKey === input.idempotencyKey)) {
      return { status: 'already_applied', balance: this.balance };
    }

    this.applyCalls.push(input);
    this.balance = {
      voiceSecondsRemaining: this.balance.voiceSecondsRemaining + input.voiceSecondsDelta,
      smsRemaining: this.balance.smsRemaining + input.smsDelta,
      updatedAtMs: input.nowMs,
    };
    return { status: 'applied', balance: this.balance };
  }

  async listLedger(): Promise<BillingPage<LedgerEvent>> {
    return { items: [] };
  }
}

class UnusedCheckoutClient implements CheckoutClient {
  async createCheckoutSession(): Promise<never> {
    throw new Error('Not used by webhook tests.');
  }
}

function checkoutCompletedPayload(checkoutSessionId: string): string {
  return JSON.stringify({
    id: `evt_${checkoutSessionId}`,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: checkoutSessionId,
        payment_status: 'paid',
        metadata: { publicId: USER, skuId: 'voice-10m' },
      },
    },
  });
}

describe('Billing Stripe webhook', () => {
  let server: ReturnType<express.Express['listen']>;
  let baseUrl: string;
  let store: SpyBillingStore;

  before(async () => {
    store = new SpyBillingStore();
    const service = new BillingService(store, new UnusedCheckoutClient(), {
      mobile: { successUrl: 'g000st://checkout/success', cancelUrl: 'g000st://checkout/cancel' },
      web: { successUrl: 'https://g000st.com/checkout/success', cancelUrl: 'https://g000st.com/checkout/cancel' },
    });
    const stripeClient = new StripeCheckoutClient('sk_test_unused');

    const app = express();
    app.use(
      express.json({
        verify: (request, _response, buffer) => {
          (request as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
        },
      }),
    );
    app.use('/webhook', createBillingStripeWebhookRouter(stripeClient, WEBHOOK_SECRET, service));

    // Mirrors app.ts's real error handler so an ApiError thrown in the router under test
    // serializes to the same {code, message} JSON shape it does in production, instead of
    // falling through to Express's default HTML error page.
    const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
      if (error instanceof ApiError) {
        response.status(error.status).json({ code: error.code, message: error.message });
        return;
      }
      response.status(500).json({ code: 'INTERNAL_ERROR', message: 'The request failed.' });
    };
    app.use(errorHandler);

    await new Promise<void>((resolve) => {
      server = app.listen(0, resolve);
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('rejects a tampered signature before touching the ledger', async () => {
    const payload = checkoutCompletedPayload('cs_tampered');

    const response = await fetch(`${baseUrl}/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'stripe-signature': 't=1700000000,v1=not-a-real-signature' },
      body: payload,
    });

    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, 'INVALID_SIGNATURE');
    assert.equal(store.applyCalls.length, 0);
  });

  it('rejects a request with no signature header at all', async () => {
    const response = await fetch(`${baseUrl}/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: checkoutCompletedPayload('cs_no_header'),
    });

    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, 'INVALID_SIGNATURE');
    assert.equal(store.applyCalls.length, 0);
  });

  it('accepts a validly signed event and credits the ledger exactly once, even if delivered twice', async () => {
    const payload = checkoutCompletedPayload('cs_valid_1');
    const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch(`${baseUrl}/webhook`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'stripe-signature': signature },
        body: payload,
      });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { received: true });
    }

    assert.equal(store.applyCalls.length, 1);
    assert.equal(store.applyCalls[0]?.publicId, USER);
    assert.equal(store.applyCalls[0]?.idempotencyKey, 'cs_valid_1');
  });
});
