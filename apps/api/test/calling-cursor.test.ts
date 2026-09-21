import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { decodeCallingCursor, encodeCallingCursor } from '../src/calling/calling-cursor.js';

describe('Calling cursor', () => {
  it('round-trips the timestamp and document ID', () => {
    const cursor = { createdAtMs: 1_789_000_000_000, id: 'call-id' };
    assert.deepEqual(decodeCallingCursor(encodeCallingCursor(cursor)), cursor);
  });

  it('rejects malformed cursors without exposing parser details', () => {
    assert.throws(
      () => decodeCallingCursor('not-a-cursor'),
      (error: unknown) => error instanceof Error && 'code' in error && error.code === 'INVALID_CURSOR',
    );
  });
});
