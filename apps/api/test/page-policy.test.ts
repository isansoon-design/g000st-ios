import assert from 'node:assert/strict';
import { it } from 'node:test';

import type { AuthStore } from '../src/auth/auth-store.js';
import { ApiError } from '../src/http/api-error.js';
import { SocialService } from '../src/social/social-service.js';
import type { SocialStore } from '../src/social/social-store.js';

it('requires the page name on social posts, shares, and comments', async () => {
  const ownerId = 'P'.repeat(50);
  const authStore = { async getPageOwner(id: string) { return id === ownerId ? 'O'.repeat(50) : null; } } as AuthStore;
  const store = { async getProfile() { return { displayName: '' }; } } as unknown as SocialStore;
  const service = new SocialService(store, authStore);
  const nameRequired = (error: unknown) => error instanceof ApiError && error.code === 'PAGE_NAME_REQUIRED';

  await assert.rejects(() => service.createPost(ownerId, { content: 'hello', visibility: 'anonymous' }, crypto.randomUUID()), nameRequired);
  await assert.rejects(() => service.createPost(ownerId, { content: '', sharedPostId: crypto.randomUUID(), visibility: 'anonymous' }, crypto.randomUUID()), nameRequired);
  await assert.rejects(() => service.createComment(ownerId, crypto.randomUUID(), { content: 'hello', visibility: 'anonymous' }), nameRequired);
  await assert.rejects(() => service.createPost(ownerId, { content: 'hello', visibility: 'public' }, crypto.randomUUID()), nameRequired);
  await assert.rejects(() => service.createComment(ownerId, crypto.randomUUID(), { content: 'hello', visibility: 'public' }), nameRequired);
  await assert.rejects(() => service.updateProfile(ownerId, { showDisplayName: false }), nameRequired);
});
