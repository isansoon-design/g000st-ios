import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AuthStore } from '../src/auth/auth-store.js';
import type { ContactsStore } from '../src/contacts/contacts-store.js';
import type { SocialStore } from '../src/social/social-store.js';
import { SocialService } from '../src/social/social-service.js';

function fixture({ owner = 'publisher' as string | null, active = true, blocked = false } = {}) {
  const following = new Set<string>();
  const store = {
    async findPostOwner(viewerId: string, postId: string) {
      assert.equal(viewerId, 'viewer');
      assert.equal(postId, 'anonymous-post');
      return owner;
    },
    async toggleCamp(viewerId: string, targetId: string, nowMs: number) {
      assert.equal(viewerId, 'viewer');
      assert.equal(targetId, 'publisher');
      assert.equal(nowMs, 123);
      if (following.has(targetId)) following.delete(targetId);
      else following.add(targetId);
      return { camped: following.has(targetId) };
    },
  } as unknown as SocialStore;
  const auth = { async isUserActive() { return active; } } as unknown as AuthStore;
  const contacts = { async getPeerPreferences() { return { blocked }; } } as unknown as ContactsStore;
  return { following, service: new SocialService(store, auth, () => 123, undefined, contacts) };
}

describe('Following a post publisher', () => {
  it('follows and unfollows the actual owner without returning their identity', async () => {
    const { service, following } = fixture();
    assert.deepEqual(await service.togglePostCamp('viewer', 'anonymous-post'), { camped: true });
    assert.deepEqual([...following], ['publisher']);
    assert.deepEqual(await service.togglePostCamp('viewer', 'anonymous-post'), { camped: false });
    assert.equal(following.size, 0);
  });

  for (const [name, options, code] of [
    ['missing or invisible post', { owner: null }, 'POST_NOT_FOUND'],
    ['own post', { owner: 'viewer' }, 'INVALID_CAMP_TARGET'],
    ['inactive publisher', { active: false }, 'USER_NOT_FOUND'],
    ['blocked publisher', { blocked: true }, 'USER_NOT_FOUND'],
  ] as const) {
    it(`rejects a ${name}`, async () => {
      const { service, following } = fixture(options);
      await assert.rejects(service.togglePostCamp('viewer', 'anonymous-post'), { code });
      assert.equal(following.size, 0);
    });
  }
});
