import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Firestore } from 'firebase-admin/firestore';

import { SocialService } from '../src/social/social-service.js';
import type { AuthStore } from '../src/auth/auth-store.js';
import type { SocialStore } from '../src/social/social-store.js';
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

  it('shows only public posts in the owner\'s visitor preview', async () => {
    const { filters, store } = queryStore();
    await store.listPosts('owner', 10, undefined, 'owner', true);
    assert.deepEqual(filters, [
      ['ownerPublicId', '==', 'owner'],
      ['visibility', '==', 'public'],
    ]);
  });
});

describe('Profile-only posts', () => {
  function feedStore(ownerId?: string) {
    const doc = (id: string, sharedToSocial?: boolean) => ({ id, data: () => ({ ownerPublicId: 'owner', content: id, visibility: 'public', createdAtMs: 1, updatedAtMs: 1, likeCount: 0, commentCount: 0, ...(sharedToSocial === undefined ? {} : { sharedToSocial }) }) });
    const docs = [doc('shared', true), doc('profile-only', false), doc('legacy')];
    const query = {
      orderBy() { return this; },
      where() { return this; },
      limit() { return this; },
      async get() { return { docs, size: docs.length, empty: false }; },
      doc() { return { async get() { return { exists: false, data: () => undefined }; }, collection() { return query; } }; },
      collection() { return query; },
    };
    const db = { collection() { return query; } } as unknown as Firestore;
    return new FirestoreSocialStore(db, 'test');
  }

  it('keeps profile-only posts out of the global Social feed but keeps legacy posts', async () => {
    const page = await feedStore().listPosts('viewer', 10);
    assert.deepEqual(page.items.map((post) => post.id), ['shared', 'legacy']);
  });

  it('shows profile-only posts on the owner profile', async () => {
    const page = await feedStore().listPosts('viewer', 10, undefined, 'owner');
    assert.deepEqual(page.items.map((post) => post.id), ['shared', 'profile-only', 'legacy']);
  });

  it('forces anonymous posts into Social and honours the flag for public posts', async () => {
    const created: boolean[] = [];
    const store = {
      async createPost(_owner: string, id: string, input: { sharedToSocial?: boolean }) { created.push(input.sharedToSocial === true); return { id, author: { displayName: 'x' } }; },
    } as unknown as SocialStore;
    const service = new SocialService(store, {} as AuthStore, () => 1);
    await service.createPost('A'.repeat(50), { content: 'a', visibility: 'anonymous', sharedToSocial: false }, '11111111-1111-4111-8111-111111111111');
    await service.createPost('A'.repeat(50), { content: 'b', visibility: 'public', sharedToSocial: false }, '22222222-2222-4222-8222-222222222222');
    await service.createPost('A'.repeat(50), { content: 'c', visibility: 'public' }, '33333333-3333-4333-8333-333333333333');
    assert.deepEqual(created, [true, false, true]);
  });
});
