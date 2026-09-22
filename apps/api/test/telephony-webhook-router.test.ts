import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';

import express, { type ErrorRequestHandler } from 'express';

import type { BillingStore, ApplyLedgerEntryInput, ApplyLedgerEntryResult } from '../src/billing/billing-store.js';
import { BillingService, type CheckoutClient } from '../src/billing/billing-service.js';
import type { Balance, BillingPage, LedgerEvent } from '../src/billing/billing-types.js';
import { ApiError } from '../src/http/api-error.js';
import { createTelephonyWebhookRouter } from '../src/telephony/telephony-webhook-router.js';
import { TelephonyService, type TelnyxGateway } from '../src/telephony/telephony-service.js';
import type { TelephonyCursor } from '../src/telephony/telephony-cursor.js';
import type { TelephonyStore } from '../src/telephony/telephony-store.js';
import type { ExternalCall, OutboundSms, OutboundSmsStatus, TelephonyPage } from '../src/telephony/telephony-types.js';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const PUBLIC_KEY_BASE64 = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('base64');
const USER = 'A'.repeat(50);

class SpyBillingStore implements BillingStore {
  readonly applyCalls: ApplyLedgerEntryInput[] = [];
  private balance: Balance = { voiceSecondsRemaining: 300, smsRemaining: 0, updatedAtMs: 0 };

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

class StubTelephonyStore implements TelephonyStore {
  private call: (Omit<ExternalCall, 'id'> & { id: string }) | undefined;

  async createCall(): Promise<void> {}
  async markCallAnswered(): Promise<void> {}

  async getCall(_publicId: string, callControlId: string): Promise<ExternalCall | undefined> {
    return this.call && this.call.id === callControlId ? this.call : undefined;
  }

  seedCall(entry: ExternalCall): void {
    this.call = entry;
  }

  async markCallEnded() {
    return { alreadyEnded: false };
  }

  async listCalls(): Promise<TelephonyPage<ExternalCall>> {
    return { items: [] };
  }

  async createSms(): Promise<void> {}
  async updateSmsStatus(_messageId: string, _status: OutboundSmsStatus): Promise<void> {}
  async listSms(): Promise<TelephonyPage<OutboundSms>> {
    return { items: [] };
  }
}

class StubTelnyx implements TelnyxGateway {
  async sendSms(): Promise<never> {
    throw new Error('Not used by webhook tests.');
  }
  async issueWebrtcCredential() {
    return { sipUsername: 'gencred_test', sipPassword: 'secret', loginToken: 'jwt-token', expiresAtMs: 1_000 };
  }
}

const CALL_STATE_SECRET = 'test-only-call-state-secret-at-least-32-chars';

function signedHeaders(timestampSeconds: number, payload: string) {
  const timestampHeader = String(timestampSeconds);
  const signature = sign(null, Buffer.concat([Buffer.from(`${timestampHeader}|`, 'utf8'), Buffer.from(payload, 'utf8')]), privateKey);
  return { 'telnyx-timestamp': timestampHeader, 'telnyx-signature-ed25519': signature.toString('base64') };
}

function callHangupPayload(callControlId: string, occurredAt: string, clientState: string): string {
  return JSON.stringify({
    data: { event_type: 'call.hangup', occurred_at: occurredAt, payload: { call_control_id: callControlId, client_state: clientState } },
  });
}

describe('Telephony webhook router', () => {
  let server: ReturnType<express.Express['listen']>;
  let baseUrl: string;
  let billingStore: SpyBillingStore;
  let telephonyStore: StubTelephonyStore;
  let clientState: string;

  before(async () => {
    billingStore = new SpyBillingStore();
    telephonyStore = new StubTelephonyStore();
    const billing = new BillingService(billingStore, new UnusedCheckoutClient(), {
      mobile: { successUrl: 'g000st://checkout/success', cancelUrl: 'g000st://checkout/cancel' },
      web: { successUrl: 'https://g000st.com/checkout/success', cancelUrl: 'https://g000st.com/checkout/cancel' },
    });
    const service = new TelephonyService(telephonyStore, new StubTelnyx(), billing, CALL_STATE_SECRET);
    clientState = (await service.issueWebrtcCredential(USER)).clientState;

    const app = express();
    app.use(express.json({ verify: (request, _response, buffer) => { (request as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer); } }));
    app.use('/webhooks', createTelephonyWebhookRouter(service, PUBLIC_KEY_BASE64));

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
    const payload = callHangupPayload('call-tampered', new Date().toISOString(), clientState);

    const response = await fetch(`${baseUrl}/webhooks/calls`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'telnyx-signature-ed25519': 'not-a-real-signature', 'telnyx-timestamp': String(Math.floor(Date.now() / 1000)) },
      body: payload,
    });

    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, 'INVALID_SIGNATURE');
    assert.equal(billingStore.applyCalls.length, 0);
  });

  it('rejects a request with no signature headers at all', async () => {
    const response = await fetch(`${baseUrl}/webhooks/calls`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: callHangupPayload('call-no-header', new Date().toISOString(), clientState),
    });

    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, 'INVALID_SIGNATURE');
  });

  it('accepts a validly signed call.hangup and debits the ledger exactly once, even if delivered twice', async () => {
    const answeredAtMs = Date.now() - 65_000;
    telephonyStore.seedCall({ id: 'call-valid-1', toE164: '+15550001111', status: 'answered', startedAtMs: answeredAtMs, answeredAtMs });
    const occurredAt = new Date().toISOString();
    const payload = callHangupPayload('call-valid-1', occurredAt, clientState);
    const timestampSeconds = Math.floor(Date.now() / 1000);
    const headers = signedHeaders(timestampSeconds, payload);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch(`${baseUrl}/webhooks/calls`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: payload,
      });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { received: true });
    }

    assert.equal(billingStore.applyCalls.length, 1);
    assert.equal(billingStore.applyCalls[0]?.publicId, USER);
  });
});
