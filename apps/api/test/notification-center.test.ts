import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Firestore } from 'firebase-admin/firestore';
import { NotificationCenter } from '../src/notifications/notification-center.js';
import { NotificationWorker, canSendNotification, notificationGroupKey, notificationItemId } from '../src/notifications/notification-worker.js';
import { queueNotification } from '../src/notifications/notification-events.js';
import type { NotificationEvent, PushMessage } from '../src/notifications/notification-types.js';
import type { NotificationService } from '../src/notifications/notification-service.js';
import { FirestoreSocialStore } from '../src/social/firestore-social-store.js';
import { AdminDeskService } from '../src/admin/admin-desk.js';

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
      where: (key: string, operator: string, value: any): any => db.collection(path, [...filters, (data) => operator === '==' ? data[key] === value : data[key] <= value], max, orders),
      orderBy: (key: any, direction = 'asc'): any => db.collection(path, filters, max, [...orders, { key: typeof key === 'string' ? key : '__id', direction }]),
      limit: (value: number): any => db.collection(path, filters, value, orders),
      count: () => ({ get: async () => { const snapshot = await query.get(); return { data: () => ({ count: snapshot.size }) }; } }),
      get: async (): Promise<{ docs: ReturnType<MemoryDb['snapshot']>[]; size: number; empty: boolean }> => {
        const docs = [...db.data.keys()].filter((key) => key.startsWith(`${path}/`) && key.slice(path.length + 1).indexOf('/') === -1)
          .map((key) => db.snapshot(key)).filter((doc) => filters.every((filter) => filter(doc.data()!)))
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
const now = 1_000_000;
const recipient = 'R'.repeat(50);
const actor = 'A'.repeat(50);
function event(overrides: Partial<NotificationEvent> = {}): NotificationEvent {
  return { audience: 'recipient', recipientPublicId: recipient, actorPublicId: actor, scope: 'user', category: 'social', type: 'social.post.commented', title: 'New comment', body: 'Someone commented on your post.', path: '/notifications', createdAtMs: now, expiresAtMs: now + 60_000, pushAfterMs: now, push: true, ...overrides };
}
function setup() {
  const db = new MemoryDb();
  db.data.set(`test_users/${recipient}`, { status: 'active', role: 'user' });
  const sent: { id: string; message: PushMessage }[] = [];
  const sender = { sendTo: async (id: string, message: PushMessage) => { sent.push({ id, message }); } } as unknown as NotificationService;
  return { db, sent, sender, worker: new NotificationWorker(db.firestore(), 'test', sender, () => now) };
}
function enqueue(db: MemoryDb, id: string, value: NotificationEvent) {
  db.data.set(`test_notification_events/${id}`, { ...value, availableAtMs: now, state: 'pending', attempts: 0, cursor: null });
}

test('notification worker preserves one inbox item and sends only to its recipient', async () => {
  const { db, sent, worker } = setup(); enqueue(db, 'event-1', event());
  await worker.sweep(); await worker.sweep();
  assert.equal(sent.length, 1); assert.equal(sent[0]!.id, recipient);
  const center = new NotificationCenter(db.firestore(), 'test');
  const page = await center.list(recipient, 'user', 20);
  assert.equal(page.unreadCount, 1); assert.equal(page.items.length, 1);
  assert.equal((page.items[0] as any).actorPublicId, undefined);
  assert.equal((await center.list(actor, 'user', 20)).items.length, 0);
  assert.equal((await center.list(recipient, 'admin', 20)).items.length, 0);
  await center.markRead(recipient, 'user', [page.items[0]!.id], now + 1);
  await center.markRead(recipient, 'user', [page.items[0]!.id], now + 2);
  assert.equal((await center.list(recipient, 'user', 20)).unreadCount, 0);
  assert.equal((await center.list(recipient, 'user', 20)).items[0]!.readAtMs, now + 1);
});

test('expired and muted pushes keep their inbox record while blocked recipients get no notification', async () => {
  const { db, sent, worker } = setup();
  enqueue(db, 'expired', event({ expiresAtMs: now - 1 }));
  await worker.sweep(); assert.equal(sent.length, 0);
  const center = new NotificationCenter(db.firestore(), 'test');
  assert.equal((await center.list(recipient, 'user', 20)).items.length, 1);
  await center.setPreferences(recipient, 'user', { pushEnabled: true, mutedCategories: ['social'] });
  enqueue(db, 'muted', event()); await worker.sweep(); assert.equal(sent.length, 0);
  db.data.set(`test_contacts/${recipient}/items/${actor}`, { blocked: true });
  enqueue(db, 'blocked', event()); await worker.sweep();
  assert.equal((await center.list(recipient, 'user', 20)).items.length, 2);
});

test('likes in one time bucket produce one inbox entry and one scheduled push', async () => {
  const { db, worker } = setup();
  const like = event({ type: 'social.post.liked', pushAfterMs: now + 15 * 60_000 });
  enqueue(db, 'like-1', like); enqueue(db, 'like-2', { ...like, actorPublicId: 'B'.repeat(50) });
  await worker.sweep();
  assert.equal((await new NotificationCenter(db.firestore(), 'test').list(recipient, 'user', 20)).items.length, 1);
  assert.equal([...db.data.keys()].filter((path) => path.startsWith('test_notification_deliveries/')).length, 1);
  assert.equal(notificationGroupKey('one', like), notificationGroupKey('two', like));
});

test('admin fanout excludes ordinary users, suspended admins and page accounts', async () => {
  const { db, sent, worker } = setup();
  db.data.set(`test_users/${actor}`, { status: 'active', role: 'admin' });
  db.data.set(`test_users/${'B'.repeat(50)}`, { status: 'suspended', role: 'admin' });
  db.data.set(`test_users/${'C'.repeat(50)}`, { status: 'active', role: 'admin', ownerPublicId: actor });
  enqueue(db, 'report', event({ audience: 'admins', actorPublicId: undefined, scope: 'admin', category: 'reports' }));
  await worker.sweep();
  assert.deepEqual(sent.map((entry) => entry.id), [actor]);
  assert.equal((await new NotificationCenter(db.firestore(), 'test').list(actor, 'admin', 20)).unreadCount, 1);
});

test('transient failure schedules a retry without duplicating the inbox, then succeeds', async () => {
  const { db, sender } = setup(); let clock = now; let attempts = 0;
  sender.sendTo = async () => { if (++attempts === 1) throw new Error('Unavailable'); };
  const worker = new NotificationWorker(db.firestore(), 'test', sender, () => clock);
  enqueue(db, 'retry', event()); await worker.sweep();
  const job = [...db.data.entries()].find(([path]) => path.startsWith('test_notification_deliveries/'))![1];
  assert.equal(job.state, 'retry'); assert(job.availableAtMs > now);
  clock = job.availableAtMs; await worker.sweep(); assert.equal(attempts, 2);
  assert.equal((await new NotificationCenter(db.firestore(), 'test').list(recipient, 'user', 20)).items.length, 1);
});

test('deleted content suppresses delayed push; a read item suppresses a pending push', async () => {
  const { db, sent, worker } = setup();
  enqueue(db, 'deleted', event({ source: { collection: 'social_posts', id: 'missing' } }));
  await worker.sweep(); assert.equal(sent.length, 0);
  const delayed = event({ pushAfterMs: now + 10_000 }); enqueue(db, 'read', delayed); await worker.sweep();
  const center = new NotificationCenter(db.firestore(), 'test');
  const id = notificationItemId('read', recipient); await center.markRead(recipient, 'user', [id], now);
  const late = new NotificationWorker(db.firestore(), 'test', { sendTo: async () => { throw new Error('Should not send.'); } } as unknown as NotificationService, () => now + 10_000);
  await late.sweep();
  assert.equal(db.data.get(`test_notification_deliveries/${id}`)!.state, 'suppressed');
});

test('anonymous comment alerts hide actor identity, including legacy records', async () => {
  const db = new MemoryDb();
  db.data.set(`test_social_alerts/${recipient}/items/alert`, { actorPublicId: actor, kind: 'comment', postId: 'post', commentId: 'comment', createdAtMs: now });
  db.data.set('test_social_posts/post/comments/comment', { visibility: 'anonymous' });
  db.data.set(`test_social_profiles/${actor}`, { displayName: 'Secret name', showDisplayName: true });
  const store = new FirestoreSocialStore(db.firestore(), 'test');
  // Production keeps alerts in a subcollection called "items".
  const result = await store.listAlerts(recipient, 20);
  if (!result.items.length) throw new Error('Fixture path must match the alert collection.');
  assert.deepEqual(result.items[0]!.actor, { displayName: 'Anonymous' });
});

test('self-actions are not queued and dispatch obeys expiry and preferences', () => {
  let writes = 0;
  const db = { collection: () => ({ doc: () => ({}) }) } as unknown as Firestore;
  queueNotification(db, 'test', { create: () => { writes++; } } as any, event({ recipientPublicId: actor }));
  assert.equal(writes, 0);
  assert.equal(canSendNotification(event(), { pushEnabled: false, mutedCategories: [] }, now), false);
  assert.equal(canSendNotification(event({ expiresAtMs: now }), { pushEnabled: true, mutedCategories: [] }, now), false);
  assert.equal(canSendNotification(event(), { pushEnabled: true, mutedCategories: [] }, now), true);
});

test('administration message details remain private to their targeted identity', async () => {
  const db = new MemoryDb();
  db.data.set('test_admin_messages/direct', { to: recipient, text: 'Private reply', type: 'msg', createdAtMs: now });
  db.data.set('test_admin_messages/global', { to: 'all', text: 'Announcement', type: 'warning', createdAtMs: now });
  const desk = new AdminDeskService(db.firestore(), 'test');
  assert.equal((await desk.getNotice(recipient, 'direct')).text, 'Private reply');
  assert.equal((await desk.getNotice(actor, 'global')).text, 'Announcement');
  await assert.rejects(desk.getNotice(actor, 'direct'), (error: any) => error.status === 404);
});


test('ordinary reports retain separate inbox records but share one summary push', async () => {
  const { db, worker } = setup();
  db.data.set(`test_users/${actor}`, { status: 'active', role: 'admin' });
  const report = event({ type: 'admin.report.created', audience: 'admins', actorPublicId: undefined,
    scope: 'admin', category: 'reports', pushAfterMs: now + 15 * 60_000,
    source: { collection: 'social_reports', id: 'first' }, path: '/reports?section=social&reportId=first' });
  enqueue(db, 'report-1', report);
  enqueue(db, 'report-2', { ...report, source: { collection: 'social_reports', id: 'second' }, path: '/reports?section=social&reportId=second' });
  await worker.sweep();
  assert.equal((await new NotificationCenter(db.firestore(), 'test').list(actor, 'admin', 20)).unreadCount, 2);
  assert.equal([...db.data.keys()].filter((path) => path.startsWith('test_notification_deliveries/')).length, 1);
});

test('suspended accounts receive their suspension notice but no social activity pushes', async () => {
  const { db, sent, worker } = setup();
  db.data.set(`test_users/${recipient}`, { status: 'suspended', role: 'user' });
  enqueue(db, 'social', event());
  enqueue(db, 'status', event({ type: 'account.status_changed', category: 'administration' }));
  await worker.sweep();
  assert.equal(sent.length, 1); assert.equal(sent[0]!.message.data.type, 'account.status_changed');
});
