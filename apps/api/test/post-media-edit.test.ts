import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AuthStore } from '../src/auth/auth-store.js';
import { ApiError } from '../src/http/api-error.js';
import { MarketService } from '../src/market/market-service.js';
import type { MarketStore } from '../src/market/market-store.js';
import type { MarketPost } from '../src/market/market-types.js';
import type { MediaService } from '../src/media/media-service.js';
import { SocialService } from '../src/social/social-service.js';
import type { SocialStore } from '../src/social/social-store.js';
import type { SocialMedia, SocialPost } from '../src/social/social-types.js';

const ownerId = 'A'.repeat(50);
const postId = '11111111-1111-4111-8111-111111111111';
const image = (id: string): SocialMedia => ({ byteSize: 12, contentType: 'image/png', fileName: `${id}.png`, id, kind: 'image', objectKey: `social/${postId}/${id}` });
const keepId = '22222222-2222-4222-8222-222222222222';
const dropId = '33333333-3333-4333-8333-333333333333';
const newId = '44444444-4444-4444-8444-444444444444';
const pending = (id: string) => ({ byteSize: 12, contentType: 'image/png', fileName: `${id}.png`, id, objectKey: `pending-social/${ownerId}/${postId}/${id}` });

function mediaFixture() {
  const deleted: string[] = [];
  const promoted: string[] = [];
  const media = {
    async promoteSocialMedia({ media: item, postId: id }: { media: ReturnType<typeof pending>; postId: string }) { promoted.push(item.id); return { ...item, kind: 'image' as const, objectKey: `social/${id}/${item.id}` }; },
    async deleteAttachments(items: readonly SocialMedia[]) { deleted.push(...items.map((item) => item.objectKey)); },
    async getDownloadUrl({ objectKey }: { objectKey: string }) { return { downloadUrl: `https://cdn/${objectKey}` }; },
  } as unknown as MediaService;
  return { deleted, media, promoted };
}

const marketBase: MarketPost = { id: postId, ownerPublicId: ownerId, author: { publicId: ownerId, displayName: 'Seller' }, content: 'Desk', price: 25, currency: 'GBP', quantity: 1, city: 'Leeds', allowCalls: false, allowVideoCalls: false, media: [image(keepId), image(dropId)], createdAtMs: 1, updatedAtMs: 1, likeCount: 0, commentCount: 0, likedByViewer: false, campedByViewer: false, ownedByViewer: true };
const listing = { content: 'Desk', price: 25, currency: 'gbp', quantity: 1, city: 'Leeds' };

function marketFixture(overrides: Partial<MarketStore> = {}) {
  const writes: unknown[] = [];
  const store = {
    findPost: async () => marketBase,
    updatePost: async (_viewer: string, id: string, input: { media?: readonly SocialMedia[] }) => { writes.push(input); return { ...marketBase, ...input, id }; },
    ...overrides,
  } as unknown as MarketStore;
  const fx = mediaFixture();
  return { ...fx, writes, service: new MarketService(store, () => 5, fx.media) };
}

const code = (expected: string) => (error: unknown) => error instanceof ApiError && error.code === expected;

describe('market listing media edit', () => {
  it('keeps one image, adds one, and deletes the removed object', async () => {
    const { deleted, promoted, service, writes } = marketFixture();
    const post = await service.updatePost(ownerId, postId, { ...listing, media: { keep: [keepId], add: [pending(newId)] } });
    assert.deepEqual(promoted, [newId]);
    assert.deepEqual(deleted, [`social/${postId}/${dropId}`]);
    assert.deepEqual(post.media?.map((item) => item.id), [keepId, newId]);
    assert.equal(post.media?.[0]?.url, `https://cdn/social/${postId}/${keepId}`);
    assert.equal((writes[0] as { media: SocialMedia[] }).media.length, 2);
  });

  it('removes every image when keep and add are empty', async () => {
    const { deleted, service } = marketFixture();
    const post = await service.updatePost(ownerId, postId, { ...listing, media: { keep: [], add: [] } });
    assert.equal(post.media?.length ?? 0, 0);
    assert.equal(deleted.length, 2);
  });

  it('leaves media untouched when the edit omits it', async () => {
    const { deleted, promoted, service, writes } = marketFixture();
    await service.updatePost(ownerId, postId, listing);
    assert.equal((writes[0] as { media?: unknown }).media, undefined);
    assert.equal(deleted.length + promoted.length, 0);
  });

  it('rejects ids that are not on the listing and more than two images', async () => {
    const { deleted, promoted, service, writes } = marketFixture();
    await assert.rejects(service.updatePost(ownerId, postId, { ...listing, media: { keep: [newId], add: [] } }), code('INVALID_SOCIAL_MEDIA'));
    await assert.rejects(service.updatePost(ownerId, postId, { ...listing, media: { keep: [keepId, dropId], add: [pending(newId)] } }), code('INVALID_SOCIAL_MEDIA_BATCH'));
    assert.equal(writes.length + deleted.length + promoted.length, 0);
  });

  it('does not promote or delete anything for someone else’s listing', async () => {
    const { deleted, promoted, service } = marketFixture({ findPost: async () => ({ ...marketBase, ownedByViewer: false }) });
    await assert.rejects(service.updatePost('B'.repeat(50), postId, { ...listing, media: { keep: [], add: [pending(newId)] } }), code('MARKET_POST_NOT_FOUND'));
    assert.equal(deleted.length + promoted.length, 0);
  });

  it('discards newly promoted images and keeps old ones when the save fails', async () => {
    const { deleted, service } = marketFixture({ updatePost: async () => { throw new Error('firestore down'); } });
    await assert.rejects(service.updatePost(ownerId, postId, { ...listing, media: { keep: [keepId], add: [pending(newId)] } }), /firestore down/);
    assert.deepEqual(deleted, [`social/${postId}/${newId}`]);
  });
});

const socialBase: SocialPost = { id: postId, ownerPublicId: ownerId, author: { publicId: ownerId, displayName: 'Owner' }, content: 'Hello', media: [image(keepId), image(dropId)], visibility: 'public', sharedToSocial: true, createdAtMs: 1, updatedAtMs: 1, likeCount: 0, commentCount: 0, likedByViewer: false, campedByViewer: false, ownedByViewer: true };

function socialFixture(base: SocialPost = socialBase) {
  const writes: { content: string; media?: readonly SocialMedia[] }[] = [];
  const store = {
    findPost: async () => base,
    updatePost: async (_viewer: string, id: string, input: { content: string; media?: readonly SocialMedia[] }) => { writes.push(input); return { ...base, ...input, id }; },
  } as unknown as SocialStore;
  const fx = mediaFixture();
  return { ...fx, writes, service: new SocialService(store, {} as AuthStore, () => 5, fx.media) };
}

describe('social post media edit', () => {
  it('swaps images and cleans up storage', async () => {
    const { deleted, service, writes } = socialFixture();
    const post = await service.updatePost(ownerId, postId, { content: ' Hello again ', media: { keep: [keepId], add: [pending(newId)] } });
    assert.equal(writes[0]?.content, 'Hello again');
    assert.deepEqual(post.media?.map((item) => item.id), [keepId, newId]);
    assert.deepEqual(deleted, [`social/${postId}/${dropId}`]);
  });

  it('allows clearing the text when images remain', async () => {
    const { service, writes } = socialFixture();
    await service.updatePost(ownerId, postId, { content: '  ', media: { keep: [keepId], add: [] } });
    assert.equal(writes[0]?.content, '');
  });

  it('rejects an edit that would leave the post empty and leaves storage untouched', async () => {
    const { deleted, promoted, service, writes } = socialFixture();
    await assert.rejects(service.updatePost(ownerId, postId, { content: '', media: { keep: [], add: [] } }), code('INVALID_POST'));
    assert.equal(writes.length + deleted.length + promoted.length, 0);
  });

  it('accepts a media-only post when a new image replaces all the old ones', async () => {
    const { deleted, service } = socialFixture();
    const post = await service.updatePost(ownerId, postId, { content: '', media: { keep: [], add: [pending(newId)] } });
    assert.deepEqual(post.media?.map((item) => item.id), [newId]);
    assert.equal(deleted.length, 2);
  });

  it('still rejects empty text when a text-only edit would blank a text-only post', async () => {
    const { service } = socialFixture({ ...socialBase, media: undefined });
    await assert.rejects(service.updatePost(ownerId, postId, { content: ' ' }), code('INVALID_POST'));
  });

  it('refuses to attach new images to a shared post', async () => {
    const { promoted, service } = socialFixture({ ...socialBase, media: undefined, sharedPostId: '55555555-5555-4555-8555-555555555555' });
    await assert.rejects(service.updatePost(ownerId, postId, { content: 'x', media: { keep: [], add: [pending(newId)] } }), code('INVALID_SHARED_POST'));
    assert.equal(promoted.length, 0);
  });
});
