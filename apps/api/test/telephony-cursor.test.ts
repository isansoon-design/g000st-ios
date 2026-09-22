import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { decodeTelephonyCursor, encodeTelephonyCursor } from '../src/telephony/telephony-cursor.js';

describe('Telephony cursor', () => {
  it('round-trips the timestamp and document ID', () => {
    const cursor = { createdAtMs: 1_789_000_000_000, id: 'call-control-id' };
    assert.deepEqual(decodeTelephonyCursor(encodeTelephonyCursor(cursor)), cursor);
  });

  it('rejects malformed cursors without exposing parser details', () => {
    assert.throws(
      () => decodeTelephonyCursor('not-a-cursor'),
      (error: unknown) => error instanceof Error && 'code' in error && error.code === 'INVALID_CURSOR',
    );
  });
});
