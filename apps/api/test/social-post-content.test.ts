import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AuthStore } from '../src/auth/auth-store.js';
import { ApiError } from '../src/http/api-error.js';
import type { MediaService } from '../src/media/media-service.js';
import { SocialService } from '../src/social/social-service.js';
import type { SocialStore } from '../src/social/social-store.js';
import type { CreateSocialPostInput, SocialMedia, SocialPost } from '../src/social/social-types.js';

const ownerId = 'A'.repeat(50);
const pendingImage = {
  byteSize: 12,
  contentType: 'image/png',
  fileName: 'photo.png',
  id: '11111111-1111-4111-8111-111111111111',
  objectKey: 'pending/photo.png',
};

function fixture() {
  const created: SocialPost[] = [];
  const store = {
    async createPost(owner: string, id: string, input: Omit<CreateSocialPostInput, 'media'> & { media?: readonly SocialMedia[] }, nowMs: number) {
      const post: SocialPost = {
        ...input,
        id,
        ownerPublicId: owner,
        author: { publicId: owner, displayName: 'Owner' },
        sharedToSocial: input.sharedToSocial !== false,
        createdAtMs: nowMs,
        updatedAtMs: nowMs,
        likeCount: 0,
        commentCount: 0,
        likedByViewer: false,
        campedByViewer: false,
        ownedByViewer: true,
      };
      created.push(post);
      return post;
    },
  } as unknown as SocialStore;
  const media = {
    async promoteSocialMedia({ media }: { media: typeof pendingImage }) {
      return { ...media, kind: 'image' as const, objectKey: 'posts/photo.png' };
    },
    async getDownloadUrl() {
      return { downloadUrl: 'https://example.com/photo.png' };
    },
  } as unknown as MediaService;
  return { created, service: new SocialService(store, {} as AuthStore, () => 1, media) };
}

describe('social post content', () => {
  it('publishes an image without text', async () => {
    const { created, service } = fixture();
    const post = await service.createPost(ownerId, {
      content: '  ',
      media: [pendingImage],
      visibility: 'public',
    }, '22222222-2222-4222-8222-222222222222');

    assert.equal(created[0]?.content, '');
    assert.equal(post.content, '');
    assert.equal(post.media?.[0]?.url, 'https://example.com/photo.png');
  });

  it('still rejects a post with no text, media, or shared post', async () => {
    const { created, service } = fixture();
    await assert.rejects(
      () => service.createPost(ownerId, { content: '  ', media: [], visibility: 'public' }, '33333333-3333-4333-8333-333333333333'),
      (error: unknown) => error instanceof ApiError && error.code === 'INVALID_POST',
    );
    assert.equal(created.length, 0);
  });
});
