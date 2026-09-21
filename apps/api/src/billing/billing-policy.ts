import type { Balance, BillingSku } from './billing-types.js';

const SECONDS_PER_MINUTE = 60;

export function secondsForSku(sku: BillingSku): number {
  return sku.kind === 'voice_minutes' ? sku.quantity * SECONDS_PER_MINUTE : 0;
}

export function smsForSku(sku: BillingSku): number {
  return sku.kind === 'sms' ? sku.quantity : 0;
}

export function hasSufficientVoiceSeconds(balance: Balance, seconds: number): boolean {
  return balance.voiceSecondsRemaining >= seconds;
}

export function hasSufficientSms(balance: Balance, count: number): boolean {
  return balance.smsRemaining >= count;
}

/**
 * Rounds up to the next full minute, with a one-minute floor for any call that was
 * actually answered — matches conventional telecom per-minute billing.
 */
export function billableSecondsForCall(answeredAtMs: number, endedAtMs: number): number {
  const rawSeconds = Math.max(0, endedAtMs - answeredAtMs) / 1000;
  const roundedUp = Math.ceil(rawSeconds / SECONDS_PER_MINUTE) * SECONDS_PER_MINUTE;
  return Math.max(SECONDS_PER_MINUTE, roundedUp);
}
