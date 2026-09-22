import type { TelephonyCursor } from './telephony-cursor.js';
import type { ExternalCall, OutboundSms, OutboundSmsStatus, TelephonyPage } from './telephony-types.js';

export interface TelephonyStore {
  /** No-ops if a call with this id already exists (defends against a duplicated Telnyx response). */
  createCall(
    entry: Readonly<{ id: string; publicId: string; toE164: string; startedAtMs: number }>,
  ): Promise<void>;

  /** No-ops unless the call is still in its initial `dialing` state. */
  markCallAnswered(publicId: string, callControlId: string, answeredAtMs: number): Promise<void>;

  getCall(publicId: string, callControlId: string): Promise<ExternalCall | undefined>;

  /**
   * No-ops (`alreadyEnded: true`) if the call was already marked ended or is unknown — defends
   * against a duplicated `call.hangup` webhook delivery.
   */
  markCallEnded(
    publicId: string,
    callControlId: string,
    endedAtMs: number,
    billedSeconds: number,
  ): Promise<Readonly<{ alreadyEnded: boolean }>>;

  listCalls(publicId: string, limit: number, cursor?: TelephonyCursor): Promise<TelephonyPage<ExternalCall>>;

  createSms(
    entry: Readonly<{
      id: string;
      publicId: string;
      toE164: string;
      body: string;
      status: OutboundSmsStatus;
      createdAtMs: number;
    }>,
  ): Promise<void>;

  /** Keyed only by the Telnyx message id — no-ops if the message is unknown. */
  updateSmsStatus(messageId: string, status: OutboundSmsStatus): Promise<void>;

  listSms(publicId: string, limit: number, cursor?: TelephonyCursor): Promise<TelephonyPage<OutboundSms>>;
}
