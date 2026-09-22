import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, it } from 'node:test';

import { verifyTelnyxWebhook } from '../src/telephony/telnyx-webhook-verify.js';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
// What Telnyx actually hands out: base64 of the raw 32-byte Ed25519 public key.
const PUBLIC_KEY_BASE64 = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('base64');
const NOW_MS = 1_700_000_000_000;

function signedRequest(timestampSeconds: number, body: string) {
  const rawBody = Buffer.from(body, 'utf8');
  const timestampHeader = String(timestampSeconds);
  const signature = sign(null, Buffer.concat([Buffer.from(`${timestampHeader}|`, 'utf8'), rawBody]), privateKey);
  return { rawBody, timestampHeader, signatureHeader: signature.toString('base64') };
}

describe('verifyTelnyxWebhook', () => {
  it('accepts a validly signed, fresh webhook', () => {
    const { rawBody, timestampHeader, signatureHeader } = signedRequest(NOW_MS / 1000, '{"ok":true}');
    assert.doesNotThrow(() =>
      verifyTelnyxWebhook(rawBody, signatureHeader, timestampHeader, PUBLIC_KEY_BASE64, NOW_MS),
    );
  });

  it('rejects a tampered body', () => {
    const { timestampHeader, signatureHeader } = signedRequest(NOW_MS / 1000, '{"ok":true}');
    const tamperedBody = Buffer.from('{"ok":false}', 'utf8');
    assert.throws(
      () => verifyTelnyxWebhook(tamperedBody, signatureHeader, timestampHeader, PUBLIC_KEY_BASE64, NOW_MS),
      (error: unknown) => error instanceof Error && 'code' in error && error.code === 'INVALID_SIGNATURE',
    );
  });

  it('rejects a tampered signature', () => {
    const { rawBody, timestampHeader } = signedRequest(NOW_MS / 1000, '{"ok":true}');
    assert.throws(
      () => verifyTelnyxWebhook(rawBody, 'not-a-real-signature', timestampHeader, PUBLIC_KEY_BASE64, NOW_MS),
      (error: unknown) => error instanceof Error && 'code' in error && error.code === 'INVALID_SIGNATURE',
    );
  });

  it('rejects a stale timestamp outside the replay window', () => {
    const staleTimestampSeconds = NOW_MS / 1000 - 600;
    const { rawBody, timestampHeader, signatureHeader } = signedRequest(staleTimestampSeconds, '{"ok":true}');
    assert.throws(
      () => verifyTelnyxWebhook(rawBody, signatureHeader, timestampHeader, PUBLIC_KEY_BASE64, NOW_MS),
      (error: unknown) => error instanceof Error && 'code' in error && error.code === 'INVALID_SIGNATURE',
    );
  });

  it('rejects a missing signature header', () => {
    const { rawBody, timestampHeader } = signedRequest(NOW_MS / 1000, '{"ok":true}');
    assert.throws(
      () => verifyTelnyxWebhook(rawBody, undefined, timestampHeader, PUBLIC_KEY_BASE64, NOW_MS),
      (error: unknown) => error instanceof Error && 'code' in error && error.code === 'INVALID_SIGNATURE',
    );
  });
});
