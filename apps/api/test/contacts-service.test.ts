import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AuthStore } from '../src/auth/auth-store.js';
import { ContactsService } from '../src/contacts/contacts-service.js';
import type { ContactsStore } from '../src/contacts/contacts-store.js';
import type { PeerPreferences } from '../src/contacts/contacts-types.js';
import { PresenceService } from '../src/presence/presence-service.js';
import type { PresenceStore } from '../src/presence/presence-store.js';
import type { SocialService } from '../src/social/social-service.js';

const ALICE = 'A'.repeat(50);
const BOB = 'B'.repeat(50);
const NOW = 1_000_000;

describe('Friends follow direction and online status', () => {
  it('shows only accounts followed by the viewer and uses their presence', async () => {
    const following = new Map<string, Map<string, number>>();
    const socialService = {
      async follow(viewerId: string, targetId: string) {
        const targets = following.get(viewerId) ?? new Map<string, number>();
        targets.set(targetId, NOW);
        following.set(viewerId, targets);
      },
      async unfollow(viewerId: string, targetId: string) {
        return following.get(viewerId)?.delete(targetId) ?? false;
      },
      async listFollowing(viewerId: string) {
        return [...(following.get(viewerId) ?? new Map()).entries()].map(([publicId, followedAtMs]) => ({ publicId, followedAtMs }));
      },
      async getProfile(_viewerId: string, publicId: string) {
        return { publicId, displayName: publicId.slice(0, 8) };
      },
    } as unknown as SocialService;
    const store = {
      async listContacts(ownerId: string) {
        return ownerId === ALICE ? [{ addedAtMs: 0, contactPublicId: BOB, nickname: 'Private nickname' }] : [];
      },
    } as unknown as ContactsStore;
    const authStore = {
      async isUserActive() { return true; },
    } as unknown as AuthStore;
    const presenceStore = {
      async getLastActiveMany(publicIds: readonly string[]) {
        return new Map(publicIds.filter((id) => id === BOB).map((id) => [id, NOW - 1_000]));
      },
    } as unknown as PresenceStore;
    const service = new ContactsService(store, authStore, socialService, new PresenceService(presenceStore, () => NOW));

    assert.deepEqual(await service.listContacts(ALICE), []);
    assert.deepEqual(await service.listNicknames(ALICE), [{ publicId: BOB, nickname: 'Private nickname' }]);
    await service.followUser(ALICE, BOB);
    assert.deepEqual((await service.listContacts(ALICE)).map(({ publicId, online }) => ({ publicId, online })), [
      { publicId: BOB, online: true },
    ]);
    assert.deepEqual(await service.listContacts(BOB), []);

    await service.unfollowUser(ALICE, BOB);
    assert.deepEqual(await service.listContacts(ALICE), []);
  });

  it('marks a followed account offline after the presence window', async () => {
    const store = {
      async getLastActiveMany() { return new Map([[BOB, NOW - 121_000]]); },
    } as unknown as PresenceStore;
    const result = await new PresenceService(store, () => NOW).isOnlineMany([BOB]);
    assert.equal(result.get(BOB), false);
  });

  it('applies call switches only to incoming calls and blocks messages and calls both ways', async () => {
    const settings = new Map<string, PeerPreferences>();
    const defaults: PeerPreferences = { blocked: false, allowAudioCalls: true, allowVideoCalls: true };
    const store = {
      async getPeerPreferences(owner: string, peer: string) { return settings.get(`${owner}:${peer}`) ?? defaults; },
      async updatePeerPreferences(owner: string, peer: string, changes: Partial<PeerPreferences>) {
        const next = { ...(settings.get(`${owner}:${peer}`) ?? defaults), ...changes };
        settings.set(`${owner}:${peer}`, next);
        return next;
      },
    } as unknown as ContactsStore;
    const service = new ContactsService(store, {} as AuthStore, {} as SocialService, {} as PresenceService);

    assert.equal(await service.canCall(ALICE, BOB, 'audio'), true);
    await service.updatePeerPreferences(BOB, ALICE, { allowAudioCalls: false });
    assert.equal(await service.canCall(ALICE, BOB, 'audio'), false);
    assert.equal(await service.canCall(ALICE, BOB, 'video'), true);
    assert.equal(await service.canCall(BOB, ALICE, 'audio'), true);

    await service.updatePeerPreferences(BOB, ALICE, { blocked: true });
    assert.equal(await service.canMessage(ALICE, BOB), false);
    assert.equal(await service.canMessage(BOB, ALICE), false);
    assert.equal(await service.canCall(BOB, ALICE, 'video'), false);
    assert.equal(await service.canCall(ALICE, BOB, 'video'), false);

    await service.updatePeerPreferences(BOB, ALICE, { blocked: false });
    assert.equal(await service.canMessage(ALICE, BOB), true);
    assert.equal(await service.canCall(ALICE, BOB, 'audio'), false);
  });
});
