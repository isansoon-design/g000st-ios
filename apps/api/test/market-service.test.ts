import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { MarketStore } from '../src/market/market-store.js';
import { MarketService } from '../src/market/market-service.js';
import type { MarketPost } from '../src/market/market-types.js';

const basePost: MarketPost = {
  id: '5ec62ebf-953e-4d21-b1a3-0b6837f899a6',
  ownerPublicId: 'seller',
  author: { publicId: 'seller', displayName: 'seller' },
  content: 'Desk',
  price: 25,
  currency: 'USD',
  quantity: 1,
  city: 'Damascus',
  allowCalls: false,
  allowVideoCalls: false,
  createdAtMs: 100,
  updatedAtMs: 100,
  likeCount: 0,
  commentCount: 0,
  likedByViewer: false,
  campedByViewer: false,
  ownedByViewer: true,
};

function fakeStore(overrides: Partial<MarketStore> = {}): MarketStore {
  return {
    listPosts: async () => ({ items: [] }),
    findPost: async () => basePost,
    createPost: async (ownerPublicId, id, input, nowMs) => ({ ...basePost, ...input, id, ownerPublicId, createdAtMs: nowMs, updatedAtMs: nowMs }),
    updatePost: async (_viewerId, postId, input, nowMs) => ({ ...basePost, ...input, id: postId, editedAtMs: nowMs, updatedAtMs: nowMs }),
    deletePost: async () => true,
    toggleLike: async () => ({ liked: true, likeCount: 1 }),
    listComments: async () => ({ items: [] }),
    createComment: async () => null,
    deleteComment: async () => true,
    createReport: async () => {},
    ...overrides,
  };
}

describe('MarketService', () => {
  it('normalizes user-entered listing fields before persistence', async () => {
    const service = new MarketService(fakeStore(), () => 500);
    const post = await service.createPost('seller', {
      content: '  Vintage desk  ',
      price: 125.5,
      currency: 'usd',
      quantity: 2,
      city: '  Damascus  ',
      allowCalls: false,
      allowVideoCalls: false,
    }, basePost.id);

    assert.equal(post.content, 'Vintage desk');
    assert.equal(post.currency, 'USD');
    assert.equal(post.city, 'Damascus');
    assert.equal(post.price, 125.5);
    assert.equal(post.quantity, 2);
  });

  it('returns the stable not-found error when a listing disappears before commenting', async () => {
    const service = new MarketService(fakeStore());
    await assert.rejects(
      service.createComment('buyer', basePost.id, 'Is this available?'),
      (error: unknown) => error instanceof Error && 'code' in error && error.code === 'MARKET_POST_NOT_FOUND',
    );
  });

  it('records a report for an existing listing with the reporter and timestamp', async () => {
    let recorded: { reporterId: string; postId: string; reason: string; nowMs: number } | undefined;
    const service = new MarketService(fakeStore({
      createReport: async (reporterId, input, nowMs) => {
        recorded = { reporterId, postId: input.postId, reason: input.reason, nowMs };
      },
    }), () => 500);

    await service.report('buyer', { postId: basePost.id, reason: 'other' });
    assert.deepEqual(recorded, { reporterId: 'buyer', postId: basePost.id, reason: 'other', nowMs: 500 });
  });

  it('does not record a report when the listing does not exist', async () => {
    let writes = 0;
    const service = new MarketService(fakeStore({
      findPost: async () => null,
      createReport: async () => { writes += 1; },
    }));

    await assert.rejects(
      service.report('buyer', { postId: basePost.id, reason: 'other' }),
      (error: unknown) => error instanceof Error && 'code' in error && error.code === 'MARKET_POST_NOT_FOUND',
    );
    assert.equal(writes, 0);
  });

  it('rejects prohibited content before writing a new or edited listing', async () => {
    let writes = 0;
    const store = fakeStore({
      createPost: async () => { writes += 1; return basePost; },
      updatePost: async () => { writes += 1; return basePost; },
    });
    const service = new MarketService(store);

    await assert.rejects(
      service.createPost('seller', { content: 'Replica watch', price: 5, currency: 'USD', quantity: 1, city: 'London', allowCalls: false, allowVideoCalls: false }, basePost.id),
      (error: unknown) => error instanceof Error && 'code' in error && error.code === 'PROHIBITED_MARKET_CONTENT',
    );
    await assert.rejects(
      service.updatePost('seller', basePost.id, { content: 'Easy money', price: 5, currency: 'USD', quantity: 1, city: 'London' }),
      (error: unknown) => error instanceof Error && 'code' in error && error.code === 'PROHIBITED_MARKET_CONTENT',
    );
    assert.equal(writes, 0);
  });
});
