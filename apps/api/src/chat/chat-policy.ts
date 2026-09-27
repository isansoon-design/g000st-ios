export const CHAT_PRIVATE_MESSAGE_MOBILE_VISIBILITY_MS = 2 * 60 * 60 * 1_000;
export const MARKET_CHAT_MESSAGE_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;
export const CHAT_BURN_AFTER_READ_SECONDS = 60 as const;
export const CHAT_EXPIRATION_SWEEP_INTERVAL_MS = 2_000;
export const CHAT_EXPIRATION_SWEEP_BATCH_SIZE = 200;

export function isLegacyTwoHourMessage(message: Readonly<{
  burnAfterReadSeconds?: number;
  burnStartedAtMs?: number;
  createdAtMs: number;
  expiresAtMs?: number;
}>): boolean {
  return message.burnStartedAtMs === undefined &&
    message.expiresAtMs === message.createdAtMs + CHAT_PRIVATE_MESSAGE_MOBILE_VISIBILITY_MS;
}
