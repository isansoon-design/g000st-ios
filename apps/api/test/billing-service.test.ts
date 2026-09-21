import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ApplyLedgerEntryInput, ApplyLedgerEntryResult, BillingStore } from '../src/billing/billing-store.js';
import { BillingService, type CheckoutClient } from '../src/billing/billing-service.js';
import type { Balance, BillingPage, LedgerEvent } from '../src/billing/billing-types.js';

class MemoryBillingStore implements BillingStore {
  private readonly balances = new Map<string, Balance>();
  private readonly ledgerByPublicId = new Map<string, LedgerEvent[]>();
  applyCallCount = 0;

  async getBalance(publicId: string): Promise<Balance> {
    return this.balances.get(publicId) ?? { voiceSecondsRemaining: 0, smsRemaining: 0, updatedAtMs: 0 };
  }

  async applyLedgerEntry(input: ApplyLedgerEntryInput): Promise<ApplyLedgerEntryResult> {
    this.applyCallCount += 1;
    const existingLedger = this.ledgerByPublicId.get(input.publicId) ?? [];
    const current = await this.getBalance(input.publicId);

    if (existingLedger.some((entry) => entry.reference === input.idempotencyKey)) {
      return { status: 'already_applied', balance: current };
    }

    const isUnconditional = input.kind !== 'sms_consumption';
    const nextVoiceSeconds = current.voiceSecondsRemaining + input.voiceSecondsDelta;
    const nextSms = current.smsRemaining + input.smsDelta;

    if (!isUnconditional && (nextVoiceSeconds < 0 || nextSms < 0)) {
      return { status: 'insufficient' };
    }

    const next: Balance = { voiceSecondsRemaining: nextVoiceSeconds, smsRemaining: nextSms, updatedAtMs: input.nowMs };
    this.balances.set(input.publicId, next);
    this.ledgerByPublicId.set(input.publicId, [
      ...existingLedger,
      {
        id: input.idempotencyKey,
        kind: input.kind,
        voiceSecondsDelta: input.voiceSecondsDelta,
        smsDelta: input.smsDelta,
        reference: input.idempotencyKey,
        ...(input.reason ? { reason: input.reason } : {}),
        ...(input.actorPublicId ? { actorPublicId: input.actorPublicId } : {}),
        createdAtMs: input.nowMs,
      },
    ]);

    return { status: 'applied', balance: next };
  }

  async listLedger(publicId: string): Promise<BillingPage<LedgerEvent>> {
    return { items: this.ledgerByPublicId.get(publicId) ?? [] };
  }
}

class FakeCheckoutClient implements CheckoutClient {
  async createCheckoutSession(input: {
    skuId: string;
    publicId: string;
    label: string;
    priceCents: number;
    currency: string;
    successUrl: string;
    cancelUrl: string;
  }) {
    return { checkoutUrl: `${input.successUrl}?sku=${input.skuId}`, checkoutSessionId: `cs_${input.publicId}_${input.skuId}` };
  }
}

const CHECKOUT_URLS = {
  mobile: { successUrl: 'g000st://checkout/success', cancelUrl: 'g000st://checkout/cancel' },
  web: { successUrl: 'https://g000st.com/checkout/success', cancelUrl: 'https://g000st.com/checkout/cancel' },
};

const USER = 'A'.repeat(50);
const NOW = 1_789_560_000_000;

describe('BillingService', () => {
  it('rejects an unknown SKU before creating a checkout session', async () => {
    const service = new BillingService(new MemoryBillingStore(), new FakeCheckoutClient(), CHECKOUT_URLS, () => NOW);
    await assert.rejects(
      () => service.createCheckoutSession(USER, 'not-a-real-sku', 'mobile'),
      (error: unknown) => error instanceof Error && 'code' in error && error.code === 'UNKNOWN_SKU',
    );
  });

  it('credits a purchase exactly once even if the webhook is delivered twice', async () => {
    const store = new MemoryBillingStore();
    const service = new BillingService(store, new FakeCheckoutClient(), CHECKOUT_URLS, () => NOW);
    const event = { checkoutSessionId: 'cs_test_123', publicId: USER, skuId: 'voice-10m' };

    await service.applyCheckoutCompleted(event);
    await service.applyCheckoutCompleted(event);

    const balance = await service.getBalance(USER);
    assert.equal(balance.voiceSecondsRemaining, 600);
    assert.equal(store.applyCallCount, 2);
  });

  it('rejects an SMS debit that would push the balance negative, without partially applying it', async () => {
    const store = new MemoryBillingStore();
    const service = new BillingService(store, new FakeCheckoutClient(), CHECKOUT_URLS, () => NOW);

    const result = await service.debitForSms(USER, 'message-1');
    assert.equal(result, 'insufficient');

    const balance = await service.getBalance(USER);
    assert.equal(balance.smsRemaining, 0);
  });

  it('records call consumption even when it exceeds the available balance', async () => {
    const store = new MemoryBillingStore();
    const service = new BillingService(store, new FakeCheckoutClient(), CHECKOUT_URLS, () => NOW);

    await service.debitForCall(USER, 'call-control-id-1', 600);

    const balance = await service.getBalance(USER);
    assert.equal(balance.voiceSecondsRemaining, -600);
  });

  it('is idempotent per call-control-id on webhook replay', async () => {
    const store = new MemoryBillingStore();
    const service = new BillingService(store, new FakeCheckoutClient(), CHECKOUT_URLS, () => NOW);

    await service.debitForCall(USER, 'call-control-id-2', 120);
    await service.debitForCall(USER, 'call-control-id-2', 120);

    const balance = await service.getBalance(USER);
    assert.equal(balance.voiceSecondsRemaining, -120);
  });

  it('records an admin adjustment tagged with the acting admin', async () => {
    const store = new MemoryBillingStore();
    const service = new BillingService(store, new FakeCheckoutClient(), CHECKOUT_URLS, () => NOW);
    const admin = 'B'.repeat(50);

    const balance = await service.adminAdjustBalance(USER, admin, 300, 2, 'goodwill credit');

    assert.equal(balance.voiceSecondsRemaining, 300);
    assert.equal(balance.smsRemaining, 2);
    const ledger = await service.listLedger(USER, 20);
    assert.equal(ledger.items[0]?.actorPublicId, admin);
    assert.equal(ledger.items[0]?.reason, 'goodwill credit');
  });
});
