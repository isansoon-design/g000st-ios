import { ApiError } from '../http/api-error.js';
import { BILLING_SKUS, findBillingSku } from './billing-catalog.js';
import { decodeBillingCursor } from './billing-cursor.js';
import { secondsForSku, smsForSku } from './billing-policy.js';
import type { BillingStore } from './billing-store.js';
import type {
  Balance,
  BillingPage,
  BillingSku,
  CheckoutReturnTarget,
  CheckoutSessionResult,
  LedgerEvent,
} from './billing-types.js';

export interface CheckoutClient {
  createCheckoutSession(
    input: Readonly<{
      skuId: string;
      publicId: string;
      label: string;
      priceCents: number;
      currency: string;
      successUrl: string;
      cancelUrl: string;
    }>,
  ): Promise<CheckoutSessionResult>;
}

export type StripeCheckoutCompletedEvent = Readonly<{
  checkoutSessionId: string;
  publicId: string;
  skuId: string;
}>;

export type CheckoutUrls = Readonly<{ successUrl: string; cancelUrl: string }>;
export type CheckoutUrlsByTarget = Readonly<Record<CheckoutReturnTarget, CheckoutUrls>>;

export class BillingService {
  constructor(
    private readonly store: BillingStore,
    private readonly checkoutClient: CheckoutClient,
    private readonly checkoutUrls: CheckoutUrlsByTarget,
    private readonly now: () => number = Date.now,
  ) {}

  listSkus(): readonly BillingSku[] {
    return BILLING_SKUS;
  }

  async createCheckoutSession(
    publicId: string,
    skuId: string,
    returnTo: CheckoutReturnTarget,
  ): Promise<CheckoutSessionResult> {
    const sku = findBillingSku(skuId);
    if (!sku) throw new ApiError(400, 'UNKNOWN_SKU', 'That bundle does not exist.');

    const urls = this.checkoutUrls[returnTo];
    return this.checkoutClient.createCheckoutSession({
      skuId: sku.id,
      publicId,
      label: sku.label,
      priceCents: sku.priceCents,
      currency: sku.currency,
      successUrl: urls.successUrl,
      cancelUrl: urls.cancelUrl,
    });
  }

  async getBalance(publicId: string): Promise<Balance> {
    return this.store.getBalance(publicId);
  }

  async listLedger(
    publicId: string,
    limit: number,
    cursorValue?: string,
  ): Promise<BillingPage<LedgerEvent>> {
    return this.store.listLedger(publicId, limit, decodeBillingCursor(cursorValue));
  }

  /** Called only after the Stripe webhook signature has been verified by the caller. */
  async applyCheckoutCompleted(event: StripeCheckoutCompletedEvent): Promise<void> {
    const sku = findBillingSku(event.skuId);
    if (!sku) return;

    await this.store.applyLedgerEntry({
      publicId: event.publicId,
      idempotencyKey: event.checkoutSessionId,
      kind: 'purchase',
      voiceSecondsDelta: secondsForSku(sku),
      smsDelta: smsForSku(sku),
      nowMs: this.now(),
    });
  }

  /** Records real call usage. Never rejected for insufficiency — see firestore-billing-store.ts. */
  async debitForCall(publicId: string, callControlId: string, seconds: number): Promise<void> {
    await this.store.applyLedgerEntry({
      publicId,
      idempotencyKey: callControlId,
      kind: 'call_consumption',
      voiceSecondsDelta: -seconds,
      smsDelta: 0,
      nowMs: this.now(),
    });
  }

  /** Called only after Telnyx confirms the message was accepted for sending. */
  async debitForSms(publicId: string, messageId: string): Promise<'applied' | 'insufficient'> {
    const result = await this.store.applyLedgerEntry({
      publicId,
      idempotencyKey: messageId,
      kind: 'sms_consumption',
      voiceSecondsDelta: 0,
      smsDelta: -1,
      nowMs: this.now(),
    });
    return result.status === 'insufficient' ? 'insufficient' : 'applied';
  }

  async adminAdjustBalance(
    publicId: string,
    adminPublicId: string,
    voiceSecondsDelta: number,
    smsDelta: number,
    reason: string,
  ): Promise<Balance> {
    const nowMs = this.now();
    const result = await this.store.applyLedgerEntry({
      publicId,
      idempotencyKey: `admin-${adminPublicId}-${nowMs}`,
      kind: 'admin_adjustment',
      voiceSecondsDelta,
      smsDelta,
      reason,
      actorPublicId: adminPublicId,
      nowMs,
    });

    return result.status === 'insufficient' ? this.store.getBalance(publicId) : result.balance;
  }
}
