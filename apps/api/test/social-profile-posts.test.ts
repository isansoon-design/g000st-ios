import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Firestore } from 'firebase-admin/firestore';

import { FirestoreSocialStore } from '../src/social/firestore-social-store.js';

function queryStore() {
  const filters: Array<[string, string, unknown]> = [];
  const query = {
    orderBy() { return this; },
    where(field: string, operation: string, value: unknown) { filters.push([field, operation, value]); return this; },
    limit() { return this; },
    async get() { return { docs: [], size: 0 }; },
  };
  const db = { collection() { return query; } } as unknown as Firestore;
  return { filters, store: new FirestoreSocialStore(db, 'test') };
}

describe('Public profile social posts', () => {
  it('queries only identified posts for another viewer', async () => {
    const { filters, store } = queryStore();
    await store.listPosts('viewer', 10, undefined, 'owner');
    assert.deepEqual(filters, [
      ['ownerPublicId', '==', 'owner'],
      ['visibility', '==', 'public'],
    ]);
  });

  it('allows the owner to see their own anonymous posts', async () => {
    const { filters, store } = queryStore();
    await store.listPosts('owner', 10, undefined, 'owner');
    assert.deepEqual(filters, [['ownerPublicId', '==', 'owner']]);
  });
});
