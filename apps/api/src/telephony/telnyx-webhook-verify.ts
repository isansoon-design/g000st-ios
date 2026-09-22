import { createPublicKey, verify } from 'node:crypto';

import { ApiError } from '../http/api-error.js';

const REPLAY_TOLERANCE_SECONDS = 300;

/**
 * Verifies a Telnyx webhook's Ed25519 signature. The signed message is the exact byte string
 * `${timestamp}|${rawBody}` (confirmed against Telnyx's webhook docs); the public key from
 * Mission Control is base64-encoded raw 32 bytes. Node's `crypto` has no direct "raw Ed25519
 * key" import, so it's re-wrapped as a JWK OKP key, which it does support.
 * https://developers.telnyx.com/docs/development/api-fundamentals/webhooks/receiving-webhooks
 */
export function verifyTelnyxWebhook(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  timestampHeader: string | undefined,
  publicKeyBase64: string,
  nowMs: number = Date.now(),
): void {
  if (!signatureHeader || !timestampHeader) {
    throw new ApiError(400, 'INVALID_SIGNATURE', 'The webhook signature is invalid.');
  }

  const timestampSeconds = Number(timestampHeader);
  if (!Number.isFinite(timestampSeconds) || Math.abs(nowMs / 1000 - timestampSeconds) > REPLAY_TOLERANCE_SECONDS) {
    throw new ApiError(400, 'INVALID_SIGNATURE', 'The webhook signature is invalid.');
  }

  const publicKey = createPublicKey({
    key: { kty: 'OKP', crv: 'Ed25519', x: Buffer.from(publicKeyBase64, 'base64').toString('base64url') },
    format: 'jwk',
  });
  const signedMessage = Buffer.concat([Buffer.from(`${timestampHeader}|`, 'utf8'), rawBody]);

  let isValid = false;
  try {
    isValid = verify(null, signedMessage, publicKey, Buffer.from(signatureHeader, 'base64'));
  } catch {
    isValid = false;
  }

  if (!isValid) {
    throw new ApiError(400, 'INVALID_SIGNATURE', 'The webhook signature is invalid.');
  }
}
