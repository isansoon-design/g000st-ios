import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Firestore } from 'firebase-admin/firestore';

import { FirestoreSocialStore } from '../src/social/firestore-social-store.js';
import { FirestoreMarketStore } from '../src/market/firestore-market-store.js';

function database(isPage: boolean, anonymous = false): Firestore {
  const post = {
    ownerPublicId: 'publisher', content: 'Hello', visibility: anonymous ? 'anonymous' : 'public',
    createdAtMs: 1, updatedAtMs: 1, likeCount: 0, commentCount: 0,
  };
  function collection(name: string) {
    return {
      doc(id: string) {
        const data = name === 'test_users'
          ? { status: 'active', ...(isPage ? { ownerPublicId: 'page-owner' } : {}) }
          : name === 'test_social_profiles'
            ? { displayName: 'Publisher', showDisplayName: true }
            : name === 'test_social_posts' || name === 'test_market_posts' ? post : undefined;
        return {
          get: async () => ({ id, exists: data !== undefined, data: () => data }),
          collection,
        };
      },
    };
  }
  return { collection } as unknown as Firestore;
}

describe('Post publisher identity', () => {
  for (const isPage of [false, true]) {
    it(`identifies ${isPage ? 'page' : 'user'} publishers in Social and Market posts`, async () => {
      const db = database(isPage);
      const social = await new FirestoreSocialStore(db, 'test').findPost('viewer', 'post');
      const market = await new FirestoreMarketStore(db, 'test').findPost('viewer', 'post');
      assert.equal(social?.author.isPage, isPage);
      assert.equal(market?.author.isPage, isPage);
    });
  }

  it('keeps anonymous publisher details hidden', async () => {
    const post = await new FirestoreSocialStore(database(true, true), 'test').findPost('viewer', 'post');
    assert.deepEqual(post?.author, { displayName: 'Anonymous' });
  });
});
