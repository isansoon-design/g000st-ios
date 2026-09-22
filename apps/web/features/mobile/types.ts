export type BillingSkuKind = "sms" | "voice_minutes";

export type BillingSku = {
  id: string;
  kind: BillingSkuKind;
  quantity: number;
  priceCents: number;
  currency: string;
  label: string;
};

export type Balance = {
  voiceSecondsRemaining: number;
  smsRemaining: number;
  updatedAtMs: number;
};

export type LedgerEventKind = "purchase" | "call_consumption" | "sms_consumption" | "admin_adjustment";

export type LedgerEvent = {
  id: string;
  kind: LedgerEventKind;
  voiceSecondsDelta: number;
  smsDelta: number;
  reference: string;
  reason?: string;
  actorPublicId?: string;
  createdAtMs: number;
};

export type ExternalCallStatus = "initiated" | "answered" | "ended";

export type ExternalCall = {
  id: string;
  toE164: string;
  status: ExternalCallStatus;
  startedAtMs: number;
  answeredAtMs?: number;
  endedAtMs?: number;
  billedSeconds?: number;
};

export type OutboundSmsStatus =
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "delivery_unconfirmed"
  | "delivery_failed"
  | "sending_failed"
  | "expired";

export type OutboundSms = {
  id: string;
  toE164: string;
  body: string;
  status: OutboundSmsStatus;
  createdAtMs: number;
};

export type WebrtcCredential = {
  sipUsername: string;
  sipPassword: string;
  loginToken: string;
  expiresAtMs: number;
  /** Server-signed — pass verbatim as clientState when placing the call. Never construct this. */
  clientState: string;
};
