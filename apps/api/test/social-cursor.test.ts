import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { decodeSocialCursor, encodeSocialCursor } from '../src/social/social-cursor.js';

describe('Social cursor', () => {
  it('round-trips the timestamp and document ID', () => {
    const cursor = { createdAtMs: 1_789_000_000_000, id: 'post-id' };
    assert.deepEqual(decodeSocialCursor(encodeSocialCursor(cursor)), cursor);
  });

  it('rejects malformed cursors without exposing parser details', () => {
    assert.throws(
      () => decodeSocialCursor('not-a-cursor'),
      (error: unknown) =>
        error instanceof Error &&
        'code' in error &&
        error.code === 'INVALID_CURSOR',
    );
  });
});
