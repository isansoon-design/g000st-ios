import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AuthStore } from '../src/auth/auth-store.js';
import { SocialService } from '../src/social/social-service.js';
import type { SocialStore } from '../src/social/social-store.js';
import type { SocialPost } from '../src/social/social-types.js';

const originalId = '11111111-1111-4111-8111-111111111111';
const shareId = '22222222-2222-4222-8222-222222222222';
const anotherShareId = '33333333-3333-4333-8333-333333333333';
const ownerId = 'A'.repeat(50);
const viewerId = 'B'.repeat(50);

function fixture() {
  const posts = new Map<string, SocialPost>();
  const original: SocialPost = {
    id: originalId, ownerPublicId: ownerId, author: { publicId: ownerId, displayName: 'Owner' },
    content: 'Original content', visibility: 'anonymous', createdAtMs: 1, updatedAtMs: 1,
    likeCount: 0, commentCount: 0, likedByViewer: false, campedByViewer: false, ownedByViewer: false,
  };
  posts.set(originalId, original);
  const project = (post: SocialPost, viewer: string): SocialPost => post.visibility === 'anonymous' && post.ownerPublicId !== viewer
    ? { ...post, ownerPublicId: undefined, author: { displayName: 'Anonymous' } }
    : post;
  const store = {
    async findPost(viewer: string, id: string) { const post = posts.get(id); return post ? project(post, viewer) : null; },
    async listPosts(viewer: string) { return { items: [...posts.values()].map((post) => project(post, viewer)) }; },
    async createPost(owner: string, id: string, input: { content: string; visibility: 'anonymous' | 'public'; sharedPostId?: string }, nowMs: number) {
      const post: SocialPost = { ...input, id, ownerPublicId: owner, author: { publicId: owner, displayName: 'Sharer' }, createdAtMs: nowMs, updatedAtMs: nowMs, likeCount: 0, commentCount: 0, likedByViewer: false, campedByViewer: false, ownedByViewer: true };
      posts.set(id, post);
      return post;
    },
  } as unknown as SocialStore;
  return { posts, service: new SocialService(store, {} as AuthStore, () => 10) };
}

describe('Social in-app sharing', () => {
  it('shows the original without exposing an anonymous author', async () => {
    const { service } = fixture();
    await service.createPost(viewerId, { content: '', sharedPostId: originalId, visibility: 'public' }, shareId);
    const page = await service.listPosts('C'.repeat(50), 20);
    const share = page.items.find((post) => post.id === shareId);
    assert.equal(share?.sharedPostId, originalId);
    assert.equal(share?.sharedPost?.author.displayName, 'Anonymous');
    assert.equal(share?.sharedPost?.author.publicId, undefined);
    assert.equal(share?.sharedPost?.content, 'Original content');
  });

  it('resolves shares of shares and handles deleted originals', async () => {
    const { service, posts } = fixture();
    await service.createPost(viewerId, { content: 'First share', sharedPostId: originalId, visibility: 'public' }, shareId);
    const sharedAgain = await service.createPost(viewerId, { content: '', sharedPostId: shareId, visibility: 'public' }, anotherShareId);
    assert.equal(sharedAgain.sharedPostId, originalId);
    posts.delete(originalId);
    const afterDeletion = await service.getPost(viewerId, anotherShareId);
    assert.equal(afterDeletion.sharedPostId, originalId);
    assert.equal(afterDeletion.sharedPost, undefined);
    await assert.rejects(() => service.createPost(viewerId, { content: '', sharedPostId: originalId, visibility: 'public' }, '44444444-4444-4444-8444-444444444444'));
  });
});
