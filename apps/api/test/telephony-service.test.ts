import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ApplyLedgerEntryInput, ApplyLedgerEntryResult, BillingStore } from '../src/billing/billing-store.js';
import { BillingService, type CheckoutClient } from '../src/billing/billing-service.js';
import type { Balance, BillingPage, LedgerEvent } from '../src/billing/billing-types.js';
import type { TelephonyCursor } from '../src/telephony/telephony-cursor.js';
import type { TelephonyStore } from '../src/telephony/telephony-store.js';
import type { ExternalCall, OutboundSms, OutboundSmsStatus, TelephonyPage } from '../src/telephony/telephony-types.js';
import { TelephonyService, type TelnyxGateway } from '../src/telephony/telephony-service.js';

class MemoryBillingStore implements BillingStore {
  private readonly balances = new Map<string, Balance>();
  private readonly ledgerByPublicId = new Map<string, LedgerEvent[]>();

  async getBalance(publicId: string): Promise<Balance> {
    return this.balances.get(publicId) ?? { voiceSecondsRemaining: 0, smsRemaining: 0, updatedAtMs: 0 };
  }

  async applyLedgerEntry(input: ApplyLedgerEntryInput): Promise<ApplyLedgerEntryResult> {
    const existingLedger = this.ledgerByPublicId.get(input.publicId) ?? [];
    const current = await this.getBalance(input.publicId);
    if (existingLedger.some((entry) => entry.reference === input.idempotencyKey)) {
      return { status: 'already_applied', balance: current };
    }

    const isUnconditional = input.kind !== 'sms_consumption';
    const nextVoiceSeconds = current.voiceSecondsRemaining + input.voiceSecondsDelta;
    const nextSms = current.smsRemaining + input.smsDelta;
    if (!isUnconditional && (nextVoiceSeconds < 0 || nextSms < 0)) return { status: 'insufficient' };

    const next: Balance = { voiceSecondsRemaining: nextVoiceSeconds, smsRemaining: nextSms, updatedAtMs: input.nowMs };
    this.balances.set(input.publicId, next);
    this.ledgerByPublicId.set(input.publicId, [
      ...existingLedger,
      { id: input.idempotencyKey, kind: input.kind, voiceSecondsDelta: input.voiceSecondsDelta, smsDelta: input.smsDelta, reference: input.idempotencyKey, createdAtMs: input.nowMs },
    ]);
    return { status: 'applied', balance: next };
  }

  async listLedger(publicId: string): Promise<BillingPage<LedgerEvent>> {
    return { items: this.ledgerByPublicId.get(publicId) ?? [] };
  }
}

class UnusedCheckoutClient implements CheckoutClient {
  async createCheckoutSession(): Promise<never> {
    throw new Error('Not used by telephony tests.');
  }
}

class FakeTelephonyStore implements TelephonyStore {
  readonly calls = new Map<string, { publicId: string } & Omit<ExternalCall, 'id'>>();
  readonly sms = new Map<string, { publicId: string } & Omit<OutboundSms, 'id'>>();

  private key(publicId: string, callControlId: string): string {
    return `${publicId}:${callControlId}`;
  }

  async createCall(entry: { id: string; publicId: string; toE164: string; startedAtMs: number }): Promise<void> {
    const key = this.key(entry.publicId, entry.id);
    if (this.calls.has(key)) return;
    this.calls.set(key, { publicId: entry.publicId, toE164: entry.toE164, status: 'initiated', startedAtMs: entry.startedAtMs });
  }

  async markCallAnswered(publicId: string, callControlId: string, answeredAtMs: number): Promise<void> {
    const existing = this.calls.get(this.key(publicId, callControlId));
    if (!existing || existing.status !== 'initiated') return;
    this.calls.set(this.key(publicId, callControlId), { ...existing, status: 'answered', answeredAtMs });
  }

  async getCall(publicId: string, callControlId: string): Promise<ExternalCall | undefined> {
    const existing = this.calls.get(this.key(publicId, callControlId));
    return existing ? { id: callControlId, ...existing } : undefined;
  }

  async markCallEnded(publicId: string, callControlId: string, endedAtMs: number, billedSeconds: number) {
    const key = this.key(publicId, callControlId);
    const existing = this.calls.get(key);
    if (!existing || existing.status === 'ended') return { alreadyEnded: true };
    this.calls.set(key, { ...existing, status: 'ended', endedAtMs, billedSeconds });
    return { alreadyEnded: false };
  }

  async listCalls(publicId: string, limit: number, _cursor?: TelephonyCursor): Promise<TelephonyPage<ExternalCall>> {
    const items = [...this.calls.entries()]
      .filter(([key]) => key.startsWith(`${publicId}:`))
      .map(([key, value]) => ({ id: key.slice(publicId.length + 1), ...value }));
    return { items: items.slice(0, limit) };
  }

  async createSms(entry: { id: string; publicId: string; toE164: string; body: string; status: OutboundSmsStatus; createdAtMs: number }): Promise<void> {
    if (this.sms.has(entry.id)) return;
    this.sms.set(entry.id, { publicId: entry.publicId, toE164: entry.toE164, body: entry.body, status: entry.status, createdAtMs: entry.createdAtMs });
  }

  async updateSmsStatus(messageId: string, status: OutboundSmsStatus): Promise<void> {
    const existing = this.sms.get(messageId);
    if (!existing) return;
    this.sms.set(messageId, { ...existing, status });
  }

  async listSms(publicId: string, limit: number): Promise<TelephonyPage<OutboundSms>> {
    const items = [...this.sms.entries()]
      .filter(([, value]) => value.publicId === publicId)
      .map(([id, value]) => ({ id, toE164: value.toE164, body: value.body, status: value.status, createdAtMs: value.createdAtMs }));
    return { items: items.slice(0, limit) };
  }
}

class FakeTelnyx implements TelnyxGateway {
  messageIdToReturn = 'message-1';
  smsCalls: Array<{ toE164: string; text: string }> = [];

  async sendSms(toE164: string, text: string) {
    this.smsCalls.push({ toE164, text });
    return { messageId: this.messageIdToReturn, status: 'queued' };
  }

  async issueWebrtcCredential() {
    return { sipUsername: 'gencred_test', sipPassword: 'secret', loginToken: 'jwt-token', expiresAtMs: 1_000 };
  }
}

const USER = 'A'.repeat(50);
const NOW = 1_789_560_000_000;
const CHECKOUT_URLS = {
  mobile: { successUrl: 'g000st://checkout/success', cancelUrl: 'g000st://checkout/cancel' },
  web: { successUrl: 'https://g000st.com/checkout/success', cancelUrl: 'https://g000st.com/checkout/cancel' },
};

const CALL_STATE_SECRET = 'test-only-call-state-secret-at-least-32-chars';

function buildService(billingStore = new MemoryBillingStore()) {
  const billing = new BillingService(billingStore, new UnusedCheckoutClient(), CHECKOUT_URLS, () => NOW);
  const store = new FakeTelephonyStore();
  const telnyx = new FakeTelnyx();
  const service = new TelephonyService(store, telnyx, billing, CALL_STATE_SECRET, () => NOW);
  return { billing, billingStore, store, telnyx, service };
}

const CALL_ID = 'call-control-1';

function callEvent(eventType: string, occurredAtMs: number, clientState: string, extra: Readonly<{ to?: string }> = {}) {
  return {
    data: {
      event_type: eventType,
      occurred_at: new Date(occurredAtMs).toISOString(),
      payload: { call_control_id: CALL_ID, client_state: clientState, ...extra },
    },
  };
}

describe('TelephonyService', () => {
  it('rejects authorizing a call when the caller has less than a minute of balance', async () => {
    const { service } = buildService();
    await assert.rejects(
      () => service.authorizeExternalCall(USER),
      (error: unknown) => error instanceof Error && 'code' in error && error.code === 'INSUFFICIENT_BALANCE',
    );
  });

  it('authorizes once balance is sufficient, without ever talking to Telnyx', async () => {
    const { service, billing } = buildService();
    await billing.adminAdjustBalance(USER, 'admin', 120, 0, 'seed');
    await assert.doesNotReject(() => service.authorizeExternalCall(USER));
  });

  it('creates the call history record from call.initiated, attributed via the signed client_state', async () => {
    const { service, store } = buildService();
    const { clientState } = await service.issueWebrtcCredential(USER);

    await service.handleCallWebhookEvent(callEvent('call.initiated', NOW, clientState, { to: '+15550001111' }));

    const call = await store.getCall(USER, CALL_ID);
    assert.equal(call?.toE164, '+15550001111');
    assert.equal(call?.status, 'initiated');
  });

  it('rejects a call.initiated whose client_state was forged for a different Public ID', async () => {
    const { service, store } = buildService();
    // Base64(JSON) that *looks* like a token but was never signed by the server for VICTIM —
    // e.g. an attacker copying the shape and swapping in someone else's Public ID.
    const victim = 'B'.repeat(50);
    const forged = Buffer.from(JSON.stringify({ p: victim, s: 'not-a-real-signature' }), 'utf8').toString('base64');

    await service.handleCallWebhookEvent(callEvent('call.initiated', NOW, forged, { to: '+15550001111' }));

    assert.equal(await store.getCall(victim, CALL_ID), undefined);
  });

  it('debits the ledger once, by the answered-to-hangup duration rounded up to a full minute', async () => {
    const { service, billing } = buildService();
    await billing.adminAdjustBalance(USER, 'admin', 300, 0, 'seed');
    const { clientState } = await service.issueWebrtcCredential(USER);

    await service.handleCallWebhookEvent(callEvent('call.initiated', NOW, clientState, { to: '+15550001111' }));
    await service.handleCallWebhookEvent(callEvent('call.answered', NOW, clientState));
    await service.handleCallWebhookEvent(callEvent('call.hangup', NOW + 65_000, clientState));

    const balance = await billing.getBalance(USER);
    assert.equal(balance.voiceSecondsRemaining, 300 - 120);
  });

  it('is idempotent on a duplicated call.hangup webhook delivery', async () => {
    const { service, billing } = buildService();
    await billing.adminAdjustBalance(USER, 'admin', 300, 0, 'seed');
    const { clientState } = await service.issueWebrtcCredential(USER);
    const hangupEvent = callEvent('call.hangup', NOW + 65_000, clientState);

    await service.handleCallWebhookEvent(callEvent('call.initiated', NOW, clientState, { to: '+15550001111' }));
    await service.handleCallWebhookEvent(callEvent('call.answered', NOW, clientState));
    await service.handleCallWebhookEvent(hangupEvent);
    await service.handleCallWebhookEvent(hangupEvent);

    const balance = await billing.getBalance(USER);
    assert.equal(balance.voiceSecondsRemaining, 300 - 120);
  });

  it('never bills a call that was never answered', async () => {
    const { service, billing } = buildService();
    await billing.adminAdjustBalance(USER, 'admin', 300, 0, 'seed');
    const { clientState } = await service.issueWebrtcCredential(USER);

    await service.handleCallWebhookEvent(callEvent('call.initiated', NOW, clientState, { to: '+15550001111' }));
    await service.handleCallWebhookEvent(callEvent('call.hangup', NOW + 5_000, clientState));

    const balance = await billing.getBalance(USER);
    assert.equal(balance.voiceSecondsRemaining, 300);
  });

  it('ignores a call.hangup for a call that was never initiated (unknown call_control_id)', async () => {
    const { service, billing } = buildService();
    await billing.adminAdjustBalance(USER, 'admin', 300, 0, 'seed');
    const { clientState } = await service.issueWebrtcCredential(USER);

    await service.handleCallWebhookEvent(callEvent('call.hangup', NOW + 5_000, clientState));

    const balance = await billing.getBalance(USER);
    assert.equal(balance.voiceSecondsRemaining, 300);
  });

  it('rejects sending SMS with no remaining balance, before ever calling Telnyx', async () => {
    const { service, telnyx } = buildService();
    await assert.rejects(
      () => service.sendSms(USER, '+15550001111', 'hi'),
      (error: unknown) => error instanceof Error && 'code' in error && error.code === 'INSUFFICIENT_BALANCE',
    );
    assert.equal(telnyx.smsCalls.length, 0);
  });

  it('sends SMS and debits exactly one SMS credit', async () => {
    const { service, billing } = buildService();
    await billing.adminAdjustBalance(USER, 'admin', 0, 5, 'seed');

    const message = await service.sendSms(USER, '+15550001111', 'hello');

    assert.equal(message.toE164, '+15550001111');
    const balance = await billing.getBalance(USER);
    assert.equal(balance.smsRemaining, 4);
  });

  it('updates SMS delivery status from the outbound delivery webhook', async () => {
    const { service, billing, store } = buildService();
    await billing.adminAdjustBalance(USER, 'admin', 0, 5, 'seed');
    const message = await service.sendSms(USER, '+15550001111', 'hello');

    await service.handleSmsWebhookEvent({
      data: { event_type: 'message.finalized', payload: { id: message.id, to: [{ status: 'delivered' }] } },
    });

    assert.equal(store.sms.get(message.id)?.status, 'delivered');
  });
});
