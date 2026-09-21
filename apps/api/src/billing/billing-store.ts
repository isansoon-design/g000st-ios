import type { BillingCursor } from './billing-cursor.js';
import type { Balance, BillingPage, LedgerEvent, LedgerEventKind } from './billing-types.js';

export type ApplyLedgerEntryInput = Readonly<{
  publicId: string;
  idempotencyKey: string;
  kind: LedgerEventKind;
  voiceSecondsDelta: number;
  smsDelta: number;
  reason?: string;
  actorPublicId?: string;
  nowMs: number;
}>;

export type ApplyLedgerEntryResult =
  | Readonly<{ status: 'applied'; balance: Balance }>
  | Readonly<{ status: 'already_applied'; balance: Balance }>
  | Readonly<{ status: 'insufficient' }>;

export interface BillingStore {
  getBalance(publicId: string): Promise<Balance>;

  /**
   * One atomic read-check-write per credit-affecting operation. `idempotencyKey` is used as
   * the ledger entry's own document id, so replaying the same key (a retried webhook, a
   * duplicate delivery) is a safe no-op reported as `already_applied` rather than double-counted.
   * `purchase` and `admin_adjustment` are never rejected for insufficiency; `call_consumption`
   * and `sms_consumption` are rejected with `insufficient` if the resulting balance would go
   * negative.
   */
  applyLedgerEntry(input: ApplyLedgerEntryInput): Promise<ApplyLedgerEntryResult>;

  listLedger(
    publicId: string,
    limit: number,
    cursor?: BillingCursor,
  ): Promise<BillingPage<LedgerEvent>>;
}
