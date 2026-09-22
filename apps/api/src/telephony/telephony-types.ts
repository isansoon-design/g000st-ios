export type ExternalCallStatus = 'initiated' | 'answered' | 'ended';

export type ExternalCall = Readonly<{
  id: string;
  toE164: string;
  status: ExternalCallStatus;
  startedAtMs: number;
  answeredAtMs?: number;
  endedAtMs?: number;
  billedSeconds?: number;
}>;

export type OutboundSmsStatus =
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'delivery_unconfirmed'
  | 'delivery_failed'
  | 'sending_failed'
  | 'expired';

export type OutboundSms = Readonly<{
  id: string;
  toE164: string;
  body: string;
  status: OutboundSmsStatus;
  createdAtMs: number;
}>;

export type TelephonyPage<T> = Readonly<{ items: readonly T[]; nextCursor?: string }>;

export type WebrtcCredential = Readonly<{
  sipUsername: string;
  sipPassword: string;
  loginToken: string;
  expiresAtMs: number;
  /** Server-signed — pass verbatim as `clientState` when placing the call. Never construct this client-side. */
  clientState: string;
}>;
