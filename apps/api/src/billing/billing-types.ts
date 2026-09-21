export type BillingSkuKind = 'sms' | 'voice_minutes';

export type BillingSku = Readonly<{
  id: string;
  kind: BillingSkuKind;
  quantity: number;
  priceCents: number;
  currency: string;
  label: string;
}>;

export type Balance = Readonly<{
  voiceSecondsRemaining: number;
  smsRemaining: number;
  updatedAtMs: number;
}>;

export type LedgerEventKind = 'purchase' | 'call_consumption' | 'sms_consumption' | 'admin_adjustment';

export type LedgerEvent = Readonly<{
  id: string;
  kind: LedgerEventKind;
  voiceSecondsDelta: number;
  smsDelta: number;
  reference: string;
  reason?: string;
  actorPublicId?: string;
  createdAtMs: number;
}>;

export type BillingPage<T> = Readonly<{ items: readonly T[]; nextCursor?: string }>;

export type CheckoutReturnTarget = 'mobile' | 'web';

export type CheckoutSessionResult = Readonly<{
  checkoutUrl: string;
  checkoutSessionId: string;
}>;
