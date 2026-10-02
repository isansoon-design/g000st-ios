import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Firestore } from 'firebase-admin/firestore';
import { FirestoreSocialStore } from '../src/social/firestore-social-store.js';
import { FirestoreMarketStore } from '../src/market/firestore-market-store.js';
import { FirestoreChatStore } from '../src/chat/firestore-chat-store.js';
import { FirestoreContactsStore } from '../src/contacts/firestore-contacts-store.js';
import { FirestoreCallingStore } from '../src/calling/firestore-calling-store.js';
import { NotificationCenter } from '../src/notifications/notification-center.js';
import { contentVisibility } from '../src/social/content-visibility.js';
import { decodeSocialCursor } from '../src/social/social-cursor.js';

type Data = Record<string, any>;
class MemoryDb {
  readonly data = new Map<string, Data>();
  doc(path: string) {
    const db = this;
    return { path, id: path.split('/').at(-1)!, collection: (name: string) => db.collection(`${path}/${name}`),
      get: async () => db.snapshot(path), set: async (data: Data) => { db.data.set(path, data); },
      create: async (data: Data) => { assert(!db.data.has(path)); db.data.set(path, data); } };
  }
  snapshot(path: string) { return { id: path.split('/').at(-1)!, ref: this.doc(path), exists: this.data.has(path), data: () => this.data.get(path) }; }
  collection(path: string, filters: ((data: Data) => boolean)[] = [], max = Infinity, orders: { key: string; direction: string }[] = []) {
    const db = this;
    const query = {
      doc: (id: string) => db.doc(`${path}/${id}`),
      where: (key: string, operator: string, value: any): any => db.collection(path, [...filters, (data) => operator === '==' ? data[key] === value : operator === 'array-contains' ? data[key]?.includes(value) : data[key] <= value], max, orders),
      orderBy: (key: any, direction = 'asc'): any => db.collection(path, filters, max, [...orders, { key: typeof key === 'string' ? key : '__id', direction }]),
      limit: (value: number): any => db.collection(path, filters, value, orders),
      startAfter: (...values: any[]): any => {
        const anchor = typeof values[0] === 'object' ? values[0] : { id: values[1], data: () => ({ [orders[0]!.key]: values[0] }) };
        return db.collection(path, [...filters, (data) => {
          for (const order of orders) {
            const a = data[order.key], b = order.key === '__id' ? anchor.id : anchor.data()[order.key];
            if (a !== b) return order.direction === 'desc' ? a < b : a > b;
          }
          return false;
        }], max, orders);
      },
      count: () => ({ get: async () => { const snapshot = await query.get(); return { data: () => ({ count: snapshot.size }) }; } }),
      get: async (): Promise<{ docs: ReturnType<MemoryDb['snapshot']>[]; size: number; empty: boolean }> => {
        const docs = [...db.data.keys()].filter((key) => key.startsWith(`${path}/`) && key.slice(path.length + 1).indexOf('/') === -1)
          .map((key) => db.snapshot(key)).filter((doc) => filters.every((filter) => filter({ ...doc.data()!, __id: doc.id })))
          .sort((left, right) => { for (const order of orders) { const a = order.key === '__id' ? left.id : left.data()![order.key]; const b = order.key === '__id' ? right.id : right.data()![order.key]; if (a !== b) return (a < b ? -1 : 1) * (order.direction === 'desc' ? -1 : 1); } return 0; }).slice(0, max);
        return { docs, size: docs.length, empty: docs.length === 0 };
      },
    };
    return query;
  }
  async runTransaction<T>(fn: (transaction: any) => Promise<T>): Promise<T> {
    return fn({ get: (ref: any) => ref.get(), getAll: (...refs: any[]) => Promise.all(refs.map((ref) => ref.get())),
      create: (ref: any, data: Data) => { assert(!this.data.has(ref.path)); this.data.set(ref.path, data); },
      update: (ref: any, data: Data) => { assert(this.data.has(ref.path)); this.data.set(ref.path, { ...this.data.get(ref.path), ...data }); },
      set: (ref: any, data: Data) => { this.data.set(ref.path, { ...this.data.get(ref.path), ...data }); } });
  }
  firestore() { return this as unknown as Firestore; }
}

function post(ownerPublicId: string, createdAtMs: number, extra: Data = {}) {
  return { ownerPublicId, createdAtMs, updatedAtMs: createdAtMs, content: 'content', visibility: 'public', likeCount: 0, commentCount: 0, ...extra };
}
function setup() {
  const db = new MemoryDb();
  db.data.set('test_users/deleted', { status: 'deleted' });
  db.data.set('test_social_profiles/legacy', { deletedAtMs: 0 });
  db.data.set('test_users/page', { status: 'deleted', ownerPublicId: 'deleted' });
  return db;
}
for (const kind of ['social', 'market']) {
  test(`${kind} hides old deleted owners, anonymous content and pages before paginating`, async () => {
    const db = setup();
    for (let i = 0; i < 65; i++) db.data.set(`test_${kind}_posts/hidden-${i}`, post(['deleted', 'legacy', 'page'][i % 3]!, 1000 - i, { visibility: 'anonymous' }));
    for (let i = 0; i < 3; i++) db.data.set(`test_${kind}_posts/live-${i}`, post('active', 3 - i));
    const store = kind === 'social' ? new FirestoreSocialStore(db.firestore(), 'test') : new FirestoreMarketStore(db.firestore(), 'test');
    const first = await store.listPosts('viewer', 2);
    assert.deepEqual(first.items.map((item) => item.id), ['live-0', 'live-1']);
    assert(first.nextCursor);
    const second = await store.listPosts('viewer', 2, decodeSocialCursor(first.nextCursor));
    assert.deepEqual(second.items.map((item) => item.id), ['live-2']);
    assert.equal(second.nextCursor, undefined);
    assert.equal(await store.findPost('viewer', 'hidden-0'), null);
    assert.equal(await store.listComments('viewer', 'hidden-0', 2), null);
    assert.equal(await store.toggleLike('viewer', 'hidden-0', 10), null);
    assert.equal((await store.listPosts('viewer', 2, undefined, 'deleted')).items.length, 0);
    // A new read observes deletion even if the owner appeared in a previous request.
    db.data.set('test_users/active', { status: 'deleted' });
    assert.equal((await store.listPosts('viewer', 2)).items.length, 0);
  });
  test(`${kind} skips deleted comments and fills the next page`, async () => {
    const db = setup();
    db.data.set(`test_${kind}_posts/post`, post('active', 1));
    for (let i = 0; i < 35; i++) db.data.set(`test_${kind}_posts/post/comments/hidden-${i}`, post('deleted', i));
    db.data.set(`test_${kind}_posts/post/comments/visible`, post('active', 40));
    const store = kind === 'social' ? new FirestoreSocialStore(db.firestore(), 'test') : new FirestoreMarketStore(db.firestore(), 'test');
    const result = await store.listComments('viewer', 'post', 1);
    assert.deepEqual(result?.items.map((item) => item.id), ['visible']);
    assert.equal(result?.nextCursor, undefined);
  });
}
test('social hides shares of deleted content, profiles, follows and alerts', async () => {
  const db = setup();
  db.data.set('test_social_posts/original', post('deleted', 1));
  db.data.set('test_social_posts/share', post('active', 2, { sharedPostId: 'original' }));
  db.data.set('test_social_camps/viewer/targets/deleted', { createdAtMs: 1 });
  db.data.set('test_social_camps/viewer/targets/active', { createdAtMs: 2 });
  db.data.set('test_social_alerts/viewer/items/deleted', { actorPublicId: 'deleted', createdAtMs: 1, kind: 'camp' });
  db.data.set('test_social_alerts/viewer/items/source', { actorPublicId: 'active', createdAtMs: 2, kind: 'like', postId: 'original' });
  const store = new FirestoreSocialStore(db.firestore(), 'test');
  assert.equal((await store.listPosts('viewer', 10)).items.length, 0);
  assert.equal(await store.findPost('viewer', 'share'), null);
  assert.equal(await store.getProfile('viewer', 'deleted'), null);
  assert.deepEqual((await store.listFollowing('viewer', 1)).map((item) => item.publicId), ['active']);
  assert.equal((await store.listAlerts('viewer', 10)).items.length, 0);
});
test('notification inbox and unread count exclude deleted actors and sources', async () => {
  const db = setup();
  db.data.set('test_social_posts/post', post('deleted', 1));
  const base = { scope: 'user', createdAtMs: 1, readAtMs: null };
  db.data.set('test_notification_inboxes/user_viewer/items/actor', { ...base, actorPublicId: 'deleted' });
  db.data.set('test_notification_inboxes/user_viewer/items/source', { ...base, actorPublicId: 'active', source: { collection: 'social_posts', id: 'post' } });
  db.data.set('test_notification_inboxes/user_viewer/items/visible', { ...base, actorPublicId: 'active' });
  const result = await new NotificationCenter(db.firestore(), 'test').list('viewer', 'user', 10);
  assert.deepEqual(result.items.map((item) => item.id), ['visible']);
  assert.equal(result.unreadCount, 1);
  assert.equal(await contentVisibility(db.firestore(), 'test').notification({ scope: 'user', actorPublicId: 'deleted' }), false);
});
test('contacts, conversations, messages and call history hide deleted peers', async () => {
  const db = setup();
  db.data.set('test_contacts/viewer/items/deleted', { addedAtMs: 1 });
  db.data.set('test_contacts/viewer/items/active', { addedAtMs: 2 });
  const contacts = new FirestoreContactsStore(db.firestore(), 'test');
  assert.deepEqual((await contacts.listContacts('viewer')).map((item) => item.contactPublicId), ['active']);
  db.data.set('test_chat_conversations/chat', { participants: ['viewer', 'deleted'], createdAtMs: 1, updatedAtMs: 1 });
  db.data.set('test_chat_members/viewer/conversations/chat', { participantPublicId: 'deleted', updatedAtMs: 1 });
  const chat = new FirestoreChatStore(db.firestore(), 'test');
  assert.equal(await chat.findConversation('chat'), null);
  assert.equal(await chat.findConversationMember('viewer', 'chat'), null);
  assert.deepEqual(await chat.listConversations('viewer', 10, 2), []);
  assert.deepEqual(await chat.listMessages('chat', 10, 2), { messages: [] });
  assert.equal(await chat.findMessage('chat', 'message'), null);
  db.data.set('test_calling_calls/call', { callerPublicId: 'viewer', calleePublicId: 'deleted', participantPublicIds: ['viewer', 'deleted'], startedAtMs: 1 });
  const calls = new FirestoreCallingStore(db.firestore(), 'test');
  assert.equal((await calls.listHistory('viewer', 10)).items.length, 0);
  db.data.set('test_users/deleted', { status: 'active' });
  assert.equal((await calls.listHistory('viewer', 10)).items.length, 1);
});
