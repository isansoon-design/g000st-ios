import { z } from 'zod';

export const billingSkuSchema = z.object({
  id: z.string(),
  kind: z.enum(['sms', 'voice_minutes']),
  quantity: z.number(),
  priceCents: z.number(),
  currency: z.string(),
  label: z.string(),
});

export const balanceSchema = z.object({
  voiceSecondsRemaining: z.number(),
  smsRemaining: z.number(),
  updatedAtMs: z.number(),
});

export const ledgerEventSchema = z.object({
  id: z.string(),
  kind: z.enum(['purchase', 'call_consumption', 'sms_consumption', 'admin_adjustment']),
  voiceSecondsDelta: z.number(),
  smsDelta: z.number(),
  reference: z.string(),
  reason: z.string().optional(),
  actorPublicId: z.string().optional(),
  createdAtMs: z.number(),
});

export const ledgerPageSchema = z.object({
  items: z.array(ledgerEventSchema),
  nextCursor: z.string().optional(),
});

export const checkoutSessionSchema = z.object({
  checkoutUrl: z.string(),
  checkoutSessionId: z.string(),
});

export const externalCallSchema = z.object({
  id: z.string(),
  toE164: z.string(),
  status: z.enum(['initiated', 'answered', 'ended']),
  startedAtMs: z.number(),
  answeredAtMs: z.number().optional(),
  endedAtMs: z.number().optional(),
  billedSeconds: z.number().optional(),
});

export const externalCallPageSchema = z.object({
  items: z.array(externalCallSchema),
  nextCursor: z.string().optional(),
});

export const outboundSmsSchema = z.object({
  id: z.string(),
  toE164: z.string(),
  body: z.string(),
  status: z.enum([
    'queued',
    'sending',
    'sent',
    'delivered',
    'delivery_unconfirmed',
    'delivery_failed',
    'sending_failed',
    'expired',
  ]),
  createdAtMs: z.number(),
});

export const outboundSmsPageSchema = z.object({
  items: z.array(outboundSmsSchema),
  nextCursor: z.string().optional(),
});

/** `clientState` is server-HMAC-signed — pass verbatim to the Telnyx SDK, never construct it. */
export const webrtcCredentialSchema = z.object({
  sipUsername: z.string(),
  sipPassword: z.string(),
  loginToken: z.string(),
  expiresAtMs: z.number(),
  clientState: z.string(),
});

export type BillingSku = z.infer<typeof billingSkuSchema>;
export type Balance = z.infer<typeof balanceSchema>;
export type LedgerEvent = z.infer<typeof ledgerEventSchema>;
export type LedgerPage = z.infer<typeof ledgerPageSchema>;
export type CheckoutSession = z.infer<typeof checkoutSessionSchema>;
export type ExternalCall = z.infer<typeof externalCallSchema>;
export type ExternalCallPage = z.infer<typeof externalCallPageSchema>;
export type OutboundSms = z.infer<typeof outboundSmsSchema>;
export type OutboundSmsPage = z.infer<typeof outboundSmsPageSchema>;
export type WebrtcCredential = z.infer<typeof webrtcCredentialSchema>;
