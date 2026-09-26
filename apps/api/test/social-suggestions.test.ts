import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AuthStore } from '../src/auth/auth-store.js';
import type { ContactsStore } from '../src/contacts/contacts-store.js';
import { SocialService } from '../src/social/social-service.js';
import type { SocialStore } from '../src/social/social-store.js';

const viewer = 'V'.repeat(50);
const friendA = 'A'.repeat(50);
const friendB = 'B'.repeat(50);
const id = (prefix: string, number: number) => `${prefix}${String(number).padStart(2, '0')}${'x'.repeat(47)}`;
const graph = Array.from({ length: 10 }, (_, index) => id('G', index));
const discovery = Array.from({ length: 30 }, (_, index) => id('D', index));

function fixture() {
  let now = Date.UTC(2026, 8, 27);
  const following = new Map([
    [viewer, [friendA, friendB]],
    [friendA, [...graph, viewer]],
    [friendB, [...graph.slice(0, 5), friendA]],
  ]);
  const store = {
    async listFollowing(publicId: string, limit?: number) {
      return (following.get(publicId) ?? []).slice(0, limit).map((candidate) => ({ publicId: candidate, followedAtMs: 1 }));
    },
    async listDiscoveryCandidates() { return [viewer, friendA, graph[0], ...discovery]; },
    async getProfile(_viewerId: string, publicId: string) {
      return { publicId, displayName: 'Private name', showDisplayName: false, updatedAtMs: 0, campedByViewer: false };
    },
  } as unknown as SocialStore;
  const authStore = {
    async isUserActive(publicId: string) { return publicId !== graph[9]; },
  } as unknown as AuthStore;
  const contactsStore = {
    async getPeerPreferences(owner: string, peer: string) {
      return { blocked: owner === graph[8] && peer === viewer, allowAudioCalls: true, allowVideoCalls: true };
    },
  } as unknown as ContactsStore;
  return {
    service: new SocialService(store, authStore, () => now, undefined, contactsStore),
    nextDay() { now += 86_400_000; },
  };
}

describe('Social people suggestions', () => {
  it('prefers friends of followed people, fills the list, and excludes followed, blocked and deleted accounts', async () => {
    const { service } = fixture();
    const result = await service.listSuggestions(viewer);
    const ids = result.items.map((item) => item.publicId);
    assert.equal(result.day, '2026-09-27');
    assert.equal(result.items.length, 10);
    assert.equal(new Set(ids).size, 10);
    for (const excluded of [viewer, friendA, friendB, graph[8]!, graph[9]!]) assert.ok(!ids.includes(excluded));
    assert.equal(result.items.filter((item) => item.reason === 'friends_of_friends').length, 7);
    assert.equal(result.items.filter((item) => item.reason === 'discover').length, 3);
    assert.equal(result.items[0]?.displayName, result.items[0]?.publicId?.slice(0, 8));
    assert.equal(result.items[0]?.mutualCount, 2);
  });

  it('is stable during a day and refreshes its ordering the next day', async () => {
    const { service, nextDay } = fixture();
    const first = await service.listSuggestions(viewer);
    assert.deepEqual(await service.listSuggestions(viewer), first);
    nextDay();
    const second = await service.listSuggestions(viewer);
    assert.equal(second.day, '2026-09-28');
    assert.notDeepEqual(second.items.map((item) => item.publicId), first.items.map((item) => item.publicId));
  });
});
