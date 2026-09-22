import { createHmac, timingSafeEqual } from 'node:crypto';

import { billableSecondsForCall, hasSufficientSms, hasSufficientVoiceSeconds } from '../billing/billing-policy.js';
import type { BillingService } from '../billing/billing-service.js';
import { ApiError } from '../http/api-error.js';
import { decodeTelephonyCursor } from './telephony-cursor.js';
import type { TelephonyStore } from './telephony-store.js';
import type { ExternalCall, OutboundSms, OutboundSmsStatus, TelephonyPage, WebrtcCredential } from './telephony-types.js';

/** A call shorter than this floor is never billed less than one minute — see billableSecondsForCall. */
const MIN_BILLABLE_CALL_SECONDS = 60;

export interface TelnyxGateway {
  sendSms(toE164: string, text: string): Promise<Readonly<{ messageId: string; status: string }>>;
  /** Telnyx-issued credential only — `clientState` is layered on top by `TelephonyService`, not Telnyx. */
  issueWebrtcCredential(publicId: string): Promise<Omit<WebrtcCredential, 'clientState'>>;
}

export type TelnyxCallWebhookEvent = Readonly<{
  data: Readonly<{
    event_type: string;
    occurred_at: string;
    payload: Readonly<{ call_control_id: string; client_state?: string; to?: string }>;
  }>;
}>;

export type TelnyxSmsWebhookEvent = Readonly<{
  data: Readonly<{
    event_type: string;
    payload: Readonly<{ id: string; to?: readonly Readonly<{ status?: string }>[] }>;
  }>;
}>;

export class TelephonyService {
  constructor(
    private readonly store: TelephonyStore,
    private readonly telnyx: TelnyxGateway,
    private readonly billing: BillingService,
    /**
     * Signs the `clientState` handed to the client for call billing attribution — see
     * `signClientState`/`verifyClientState` below for why this can't just be the raw Public ID.
     * Any app-wide server secret works here (this reuses `AUTH_RECOVERY_PEPPER` from
     * server.ts); the HMAC message is domain-separated so it's safe to share with recovery-ID
     * hashing.
     */
    private readonly callStateSecret: string,
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * `clientState` is bundled into the credential response rather than accepted from the client:
   * the client places its own WebRTC call directly against Telnyx (see `authorizeExternalCall`'s
   * doc comment), so nothing server-side ever gets to choose what `client_state` a given call
   * carries — except this HMAC-signed token, which is only ever issued for the *authenticated*
   * caller's own Public ID. Without this, a malicious client could pass an arbitrary
   * `clientState` on its own WebRTC call and have it billed against another user's balance.
   */
  async issueWebrtcCredential(publicId: string): Promise<WebrtcCredential> {
    const credential = await this.telnyx.issueWebrtcCredential(publicId);
    return { ...credential, clientState: signClientState(publicId, this.callStateSecret) };
  }

  /**
   * The browser places the actual call itself, directly against Telnyx's WebRTC gateway (via
   * the credential from `issueWebrtcCredential`), tagged with its own Public ID as `clientState`
   * — there is no server-triggered Call Control dial here. This only gates that call on the
   * caller's balance *before* the client is allowed to place it; the call record itself is
   * created reactively from the `call.initiated` webhook once Telnyx actually creates the call,
   * since no `call_control_id` exists yet at this point.
   */
  async authorizeExternalCall(publicId: string): Promise<void> {
    const balance = await this.billing.getBalance(publicId);
    if (!hasSufficientVoiceSeconds(balance, MIN_BILLABLE_CALL_SECONDS)) {
      throw new ApiError(402, 'INSUFFICIENT_BALANCE', 'Not enough call credit remaining.');
    }
  }

  /** Only ever called after the webhook signature has been verified by the caller. */
  async handleCallWebhookEvent(event: TelnyxCallWebhookEvent): Promise<void> {
    const { event_type: eventType, occurred_at: occurredAt, payload } = event.data ?? {};
    const publicId = payload?.client_state
      ? verifyClientState(payload.client_state, this.callStateSecret)
      : undefined;
    const occurredAtMs = occurredAt ? Date.parse(occurredAt) : Number.NaN;
    if (!publicId || !payload?.call_control_id || !Number.isFinite(occurredAtMs)) return;

    if (eventType === 'call.initiated') {
      await this.store.createCall({
        id: payload.call_control_id,
        publicId,
        toE164: payload.to ?? '',
        startedAtMs: occurredAtMs,
      });
      return;
    }

    if (eventType === 'call.answered') {
      await this.store.markCallAnswered(publicId, payload.call_control_id, occurredAtMs);
      return;
    }

    if (eventType === 'call.hangup') {
      const call = await this.store.getCall(publicId, payload.call_control_id);
      if (!call) return;

      const billedSeconds = call.answeredAtMs ? billableSecondsForCall(call.answeredAtMs, occurredAtMs) : 0;
      const result = await this.store.markCallEnded(publicId, payload.call_control_id, occurredAtMs, billedSeconds);
      if (result.alreadyEnded || billedSeconds === 0) return;

      await this.billing.debitForCall(publicId, payload.call_control_id, billedSeconds);
    }
  }

  async listCalls(publicId: string, limit: number, cursorValue?: string): Promise<TelephonyPage<ExternalCall>> {
    return this.store.listCalls(publicId, limit, decodeTelephonyCursor(cursorValue));
  }

  async sendSms(publicId: string, toE164: string, body: string): Promise<OutboundSms> {
    const balance = await this.billing.getBalance(publicId);
    if (!hasSufficientSms(balance, 1)) {
      throw new ApiError(402, 'INSUFFICIENT_BALANCE', 'Not enough SMS credit remaining.');
    }

    const sent = await this.telnyx.sendSms(toE164, body);
    const createdAtMs = this.now();
    const status = sent.status as OutboundSmsStatus;

    // The balance was already checked above; Telnyx has now sent (and billed us for) the
    // message regardless of what happens next, so a concurrent-send race that makes this
    // debit come back 'insufficient' is recorded as best-effort accounting, not re-checked —
    // same reasoning as debitForCall. See firestore-billing-store.ts.
    await this.billing.debitForSms(publicId, sent.messageId);
    await this.store.createSms({ id: sent.messageId, publicId, toE164, body, status, createdAtMs });

    return { id: sent.messageId, toE164, body, status, createdAtMs };
  }

  /** Only ever called after the webhook signature has been verified by the caller. */
  async handleSmsWebhookEvent(event: TelnyxSmsWebhookEvent): Promise<void> {
    const payload = event.data?.payload;
    const status = payload?.to?.[0]?.status;
    if (!payload?.id || !status) return;

    await this.store.updateSmsStatus(payload.id, status as OutboundSmsStatus);
  }

  async listSms(publicId: string, limit: number, cursorValue?: string): Promise<TelephonyPage<OutboundSms>> {
    return this.store.listSms(publicId, limit, decodeTelephonyCursor(cursorValue));
  }
}

function callStateSignature(publicId: string, secret: string): string {
  return createHmac('sha256', secret).update(`telephony-call:${publicId}`).digest('base64url').slice(0, 22);
}

function signClientState(publicId: string, secret: string): string {
  const token = { p: publicId, s: callStateSignature(publicId, secret) };
  return Buffer.from(JSON.stringify(token), 'utf8').toString('base64');
}

/** Returns the Public ID only if the token's HMAC signature actually verifies. */
function verifyClientState(clientState: string, secret: string): string | undefined {
  try {
    const token = JSON.parse(Buffer.from(clientState, 'base64').toString('utf8')) as
      | Readonly<{ p?: unknown; s?: unknown }>
      | undefined;
    if (typeof token?.p !== 'string' || typeof token.s !== 'string') return undefined;

    const expected = Buffer.from(callStateSignature(token.p, secret), 'utf8');
    const actual = Buffer.from(token.s, 'utf8');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return undefined;

    return token.p;
  } catch {
    return undefined;
  }
}
