import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { decodeBillingCursor, encodeBillingCursor } from '../src/billing/billing-cursor.js';

describe('Billing cursor', () => {
  it('round-trips the timestamp and document ID', () => {
    const cursor = { createdAtMs: 1_789_000_000_000, id: 'ledger-entry-id' };
    assert.deepEqual(decodeBillingCursor(encodeBillingCursor(cursor)), cursor);
  });

  it('rejects malformed cursors without exposing parser details', () => {
    assert.throws(
      () => decodeBillingCursor('not-a-cursor'),
      (error: unknown) => error instanceof Error && 'code' in error && error.code === 'INVALID_CURSOR',
    );
  });
});
