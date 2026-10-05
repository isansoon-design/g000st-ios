import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { DocumentData, Firestore } from 'firebase-admin/firestore';

import type { AuthStore } from '../src/auth/auth-store.js';
import { FirestoreCallingStore } from '../src/calling/firestore-calling-store.js';
import { FirestoreChatStore } from '../src/chat/firestore-chat-store.js';
import { FirestoreContactsStore } from '../src/contacts/firestore-contacts-store.js';
import { FirestoreMarketStore } from '../src/market/firestore-market-store.js';
import { NotificationCenter } from '../src/notifications/notification-center.js';
import { contentVisibility } from '../src/social/content-visibility.js';
import { FirestoreSocialStore } from '../src/social/firestore-social-store.js';
import { SocialService } from '../src/social/social-service.js';

const viewer = 'A'.repeat(50);
const peer = 'B'.repeat(50);
const other = 'C'.repeat(50);

/** Read fixture supports Firestore page lookahead and mutable contact preferences. */
function fixture() {
  const records = new Map<string, DocumentData>();
  function doc(path: string) {
    return {
      path, id: path.split('/').at(-1)!,
      collection: (name: string) => query(`${path}/${name}`),
      get: async () => snapshot(path),
      set: async (data: DocumentData, options?: { merge: boolean }) => {
        records.set(path, options?.merge ? { ...records.get(path), ...data } : data);
      },
    };
  }
  function snapshot(path: string) {
    return { id: path.split('/').at(-1)!, ref: { path }, exists: records.has(path), data: () => records.get(path)! };
  }
  function query(path: string, filters: Array<[string, string, unknown]> = [], orders: Array<[string, string]> = [], limit = Infinity, after?: unknown[]) {
    return {
      doc: (id: string) => doc(`${path}/${id}`),
      where: (field: string, operation: string, value: unknown) => query(path, [...filters, [field, operation, value]], orders, limit, after),
      orderBy: (field: unknown, direction = 'asc') => query(path, filters, [...orders, [typeof field === 'string' ? field : '__id', direction]], limit, after),
      limit: (size: number) => query(path, filters, orders, size, after),
      startAfter: (...values: unknown[]) => query(path, filters, orders, limit, values),
      get: async (): Promise<{ docs: ReturnType<typeof snapshot>[]; size: number; empty: boolean }> => {
        const compare = (left: ReturnType<typeof snapshot>, right: ReturnType<typeof snapshot>) => {
          for (const [field, direction] of orders) {
            const a = field === '__id' ? left.id : left.data()[field];
            const b = field === '__id' ? right.id : right.data()[field];
            if (a !== b) return (a < b ? -1 : 1) * (direction === 'desc' ? -1 : 1);
          }
          return 0;
        };
        const ordered = [...records.keys()].filter((key) => key.startsWith(`${path}/`) && !key.slice(path.length + 1).includes('/'))
          .map(snapshot).filter((item) => filters.every(([key, operation, value]) => operation === 'array-contains'
            ? item.data()[key]?.includes(value) : item.data()[key] === value)).sort(compare);
        let docs = ordered;
        if (after) {
          if (after.length === 1) docs = docs.slice(docs.findIndex((item) => item.id === (after[0] as { id: string }).id) + 1);
          else {
            const cursorData = Object.fromEntries(orders.map(([key], index) => [key, after[index]]));
            const cursor = { id: cursorData.__id, data: () => cursorData } as ReturnType<typeof snapshot>;
            docs = docs.filter((item) => compare(item, cursor) > 0);
          }
        }
        docs = docs.slice(0, limit);
        return { docs, size: docs.length, empty: docs.length === 0 };
      },
    };
  }
  const db = { collection: query } as unknown as Firestore;
  for (const id of [viewer, peer, other]) {
    records.set(`test_users/${id}`, { status: 'active' });
    records.set(`test_social_profiles/${id}`, { displayName: id[0], showDisplayName: true });
  }
  const contacts = new FirestoreContactsStore(db, 'test');
  const social = new FirestoreSocialStore(db, 'test');
  const market = new FirestoreMarketStore(db, 'test');
  const auth = { async isUserActive() { return true; } } as unknown as AuthStore;
  const service = new SocialService(social, auth, Date.now, undefined, contacts);
  const block = (owner = viewer, target = peer, blocked = true) => contacts.updatePeerPreferences(owner, target, { blocked });
  const post = (id: string, ownerPublicId: string, createdAtMs: number, extra: DocumentData = {}) => {
    records.set(`test_social_posts/${id}`, { ownerPublicId, createdAtMs, updatedAtMs: createdAtMs, content: id, visibility: 'public', likeCount: 0, commentCount: 0, ...extra });
  };
  return { db, records, contacts, social, market, service, block, post };
}

test('either direction hides profiles, anonymous posts and reposts; unblock restores visibility', async () => {
  for (const reverse of [false, true]) {
    const { db, service, social, block, post } = fixture();
    post('anonymous', peer, 1, { visibility: 'anonymous' });
    post('repost', other, 2, { sharedPostId: 'anonymous' });
    post('mine', viewer, 3);
    assert.equal((await social.listPosts(viewer, 10)).items.length, 3);
    const owner = reverse ? peer : viewer;
    const target = reverse ? viewer : peer;
    await block(owner, target);
    assert.equal(await contentVisibility(db, 'test', viewer).account(peer), false);
    assert.equal(await social.getProfile(viewer, peer), null);
    await assert.rejects(service.getProfile(viewer, peer), { code: 'USER_NOT_FOUND' });
    await assert.rejects(service.follow(viewer, peer), { code: 'USER_NOT_FOUND' });
    await assert.rejects(service.toggleCamp(viewer, peer), { code: 'USER_NOT_FOUND' });
    assert.deepEqual((await social.listPosts(viewer, 10)).items.map((item) => item.id), ['mine']);
    assert.equal(await social.findPost(viewer, 'anonymous'), null);
    assert.equal(await social.findPost(viewer, 'repost'), null);
    assert.equal((await service.getProfile(viewer, viewer)).publicId, viewer);
    assert.equal((await social.listPosts(other, 10)).items.length, 3);
    await block(owner, target, false);
    assert.equal((await social.listPosts(viewer, 10)).items.length, 3);
    assert.equal((await service.getProfile(viewer, peer)).publicId, peer);
  }
});

test('visible pages fill across blocked batches and retain working cursors', async () => {
  const { social, post, block } = fixture();
  for (let index = 0; index < 40; index++) post(`blocked-${index}`, peer, 100 + index);
  for (let index = 0; index < 5; index++) post(`visible-${index}`, other, index);
  await block();
  const first = await social.listPosts(viewer, 2);
  assert.deepEqual(first.items.map((item) => item.id), ['visible-4', 'visible-3']);
  assert.ok(first.nextCursor);
  // Service decodes the public cursor before asking the store for the next page.
  const { decodeSocialCursor } = await import('../src/social/social-cursor.js');
  const next = await social.listPosts(viewer, 2, decodeSocialCursor(first.nextCursor));
  assert.deepEqual(next.items.map((item) => item.id), ['visible-2', 'visible-1']);
});

test('hides blocked comments, market listings, contacts and existing notifications', async () => {
  const { db, records, social, market, contacts, post, block } = fixture();
  post('public', other, 1);
  post('blocked', peer, 2);
  records.set('test_social_posts/public/comments/hidden', { ownerPublicId: peer, visibility: 'anonymous', content: 'hidden', createdAtMs: 1 });
  records.set('test_social_posts/public/comments/visible', { ownerPublicId: other, visibility: 'public', content: 'visible', createdAtMs: 2 });
  records.set('test_market_posts/listing', { ownerPublicId: peer, content: 'listing', createdAtMs: 1 });
  records.set('test_market_posts/other', { ownerPublicId: other, content: 'other', createdAtMs: 2 });
  records.set('test_market_posts/other/comments/hidden', { ownerPublicId: peer, content: 'hidden', createdAtMs: 1 });
  records.set(`test_social_camps/${viewer}/targets/${peer}`, { createdAtMs: 1 });
  records.set(`test_contacts/${viewer}/items/${peer}`, { nickname: 'Friend' });
  const inbox = `test_notification_inboxes/user_${viewer}/items/${'a'.repeat(64)}`;
  records.set(inbox, { scope: 'user', actorPublicId: peer, type: 'social.followed', readAtMs: null, createdAtMs: 1 });
  const center = new NotificationCenter(db, 'test');
  assert.equal((await center.list(viewer, 'user', 10)).unreadCount, 1);
  await block();
  assert.deepEqual((await social.listComments(viewer, 'public', 10))?.items.map((item) => item.id), ['visible']);
  assert.equal(await market.findPost(viewer, 'listing'), null);
  assert.deepEqual((await market.listPosts(viewer, 10)).items.map((item) => item.id), ['other']);
  assert.deepEqual((await market.listComments(viewer, 'other', 10))?.items, []);
  assert.deepEqual(await social.listFollowing(viewer), []);
  assert.deepEqual(await contacts.listContacts(viewer), []);
  const notifications = await center.list(viewer, 'user', 10);
  assert.deepEqual(notifications.items, []);
  assert.equal(notifications.unreadCount, 0);
  assert.equal(await social.toggleLike(viewer, 'blocked', 1), null);
  assert.equal(await social.createComment(viewer, 'blocked', { content: 'No', visibility: 'public' }, 1), null);
  assert.ok(records.has(inbox));
  assert.equal((await contacts.getPeerPreferences(viewer, peer)).blocked, true);
  await block(viewer, peer, false);
  assert.equal((await social.listFollowing(viewer)).length, 1);
  assert.equal((await contacts.listContacts(viewer))[0]?.nickname, 'Friend');
  assert.equal((await center.list(viewer, 'user', 10)).unreadCount, 1);
});

test('conversation lists fill past blocked peers and call history hides both block directions', async () => {
  const { db, records, block } = fixture();
  const chat = new FirestoreChatStore(db, 'test');
  const calls = new FirestoreCallingStore(db, 'test');
  for (let index = 0; index < 55; index++) {
    records.set(`test_chat_members/${viewer}/conversations/blocked-${index}`, {
      participantPublicId: peer, updatedAtMs: 100 + index, unreadCount: 0, lastMessagePreview: 'Message',
    });
  }
  records.set(`test_chat_members/${viewer}/conversations/visible`, {
    participantPublicId: other, updatedAtMs: 1, unreadCount: 0, lastMessagePreview: 'Message',
  });
  records.set('test_calling_calls/blocked', { callerPublicId: viewer, calleePublicId: peer, participantPublicIds: [viewer, peer], media: 'audio', startedAtMs: 2 });
  records.set('test_calling_calls/visible', { callerPublicId: other, calleePublicId: viewer, participantPublicIds: [viewer, other], media: 'audio', startedAtMs: 1 });
  await block();
  assert.deepEqual((await chat.listConversations(viewer, 1, 200)).map((item) => item.conversationId), ['visible']);
  assert.deepEqual((await calls.listHistory(viewer, 10)).items.map((item) => item.id), ['visible']);
  assert.deepEqual((await calls.listHistory(peer, 10)).items, []);
  await block(viewer, peer, false);
  assert.equal((await chat.listConversations(viewer, 1, 200))[0]?.participantPublicId, peer);
  assert.equal((await calls.listHistory(viewer, 10)).items.length, 2);
});
