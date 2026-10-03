import assert from 'node:assert/strict';
import test from 'node:test';
import type { Firestore } from 'firebase-admin/firestore';
import { FirestoreAuthStore } from '../src/auth/firestore-auth-store.js';

type Data = Record<string, unknown>;
type Ref = { path: string };
const actor = 'A'.repeat(50);
const target = 'U'.repeat(50);
const page = 'P'.repeat(50);

function fixture(status = 'active') {
  const records = new Map<string, Data>([
    [`test_users/${actor}`, { role: 'admin', status: 'active' }],
    [`test_users/${target}`, { role: 'user', status }],
    [`test_users/${page}`, { role: 'user', status: 'active', ownerPublicId: target }],
    ['test_recovery_credentials/user', { publicId: target }],
    ['test_push_devices/user', { publicId: target }],
    ['test_push_devices/page', { publicId: page }],
    ['test_push_devices/admin', { publicId: actor }],
    [`test_social_profiles/${target}`, { displayName: 'Original', bio: 'Private' }],
  ]);
  const snapshot = (path: string) => ({ id: path.split('/').at(-1)!, ref: { path }, exists: records.has(path), data: () => records.get(path) });
  const db = {
    collection: (name: string) => ({
      doc: (id: string) => ({ path: `${name}/${id}` }),
      where: (field: string, _operator: string, value: string) => ({ name, field, value }),
    }),
    runTransaction: async (fn: (transaction: unknown) => Promise<void>) => {
      const writes: (() => void)[] = [];
      await fn({
        get: async (ref: Ref | { name: string; field: string; value: string }) => {
          assert.equal(writes.length, 0, 'All reads must precede writes');
          if ('path' in ref) return snapshot(ref.path);
          return { docs: [...records].filter(([path, data]) => path.startsWith(`${ref.name}/`) && data[ref.field] === ref.value).map(([path]) => snapshot(path)) };
        },
        update: (ref: Ref, data: Data) => writes.push(() => records.set(ref.path, { ...records.get(ref.path), ...data })),
        set: (ref: Ref, data: Data) => writes.push(() => records.set(ref.path, data)),
        create: (ref: Ref, data: Data) => writes.push(() => { assert(!records.has(ref.path)); records.set(ref.path, data); }),
        delete: (ref: Ref) => writes.push(() => records.delete(ref.path)),
      });
      for (const write of writes) write();
    },
  } as unknown as Firestore;
  return { records, store: new FirestoreAuthStore(db, 'test') };
}

test('admin deletion atomically deletes active or suspended accounts, pages, credentials and devices with an audit record', async () => {
  for (const status of ['active', 'suspended']) {
    const { records, store } = fixture(status);
    await store.deleteAccount(target, 123, actor);
    assert.equal(records.get(`test_users/${target}`)?.status, 'deleted');
    assert.equal(records.get(`test_users/${page}`)?.status, 'deleted');
    for (const id of [target, page]) {
      assert.deepEqual(records.get(`test_social_profiles/${id}`), { deletedAtMs: 123, displayName: 'Deleted account', showDisplayName: true, updatedAtMs: 123 });
    }
    for (const path of ['test_recovery_credentials/user', 'test_push_devices/user', 'test_push_devices/page']) assert(!records.has(path));
    assert(records.has('test_push_devices/admin'));
    assert.deepEqual([...records].filter(([path]) => path.startsWith('test_admin_audit/')).map(([, data]) => data), [{ actor, action: 'user.delete', target, createdAtMs: 123 }]);
  }
});

test('admin deletion rejects administrators, pages, missing and already deleted accounts without writes', async () => {
  for (const [id, code] of [[actor, 'ADMIN_PROTECTED'], [page, 'USER_NOT_FOUND'], ['X'.repeat(50), 'USER_NOT_FOUND'], [target, 'USER_NOT_FOUND']]) {
    const { records, store } = fixture(id === target ? 'deleted' : 'active');
    const before = [...records];
    await assert.rejects(() => store.deleteAccount(id!, 123, actor), { code });
    assert.deepEqual([...records], before);
  }
  const { records, store } = fixture();
  records.set(`test_users/${target}`, { role: 'admin', status: 'active' });
  await assert.rejects(() => store.deleteAccount(target, 123, actor), { code: 'ADMIN_PROTECTED' });
  assert.equal(records.get(`test_users/${target}`)?.status, 'active');
});

test('self deletion retains existing behavior and does not create an admin audit entry', async () => {
  const { records, store } = fixture();
  await store.deleteAccount(target, 123);
  assert.equal(records.get(`test_users/${target}`)?.status, 'deleted');
  assert.equal(records.get(`test_users/${page}`)?.status, 'deleted');
  assert.equal([...records.keys()].some((path) => path.startsWith('test_admin_audit/')), false);
});
