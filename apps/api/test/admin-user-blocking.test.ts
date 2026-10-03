import assert from 'node:assert/strict';
import test from 'node:test';
import type { Firestore } from 'firebase-admin/firestore';
import { AdminDeskService } from '../src/admin/admin-desk.js';
import { FirestoreAuthStore } from '../src/auth/firestore-auth-store.js';
import { AuthService } from '../src/auth/auth-service.js';

type Data = Record<string, unknown>;
type Ref = { path: string; get: () => Promise<unknown> };
const actor = 'A'.repeat(50);
const target = 'U'.repeat(50);
const page = 'P'.repeat(50);

function fixture() {
  const records = new Map<string, Data>([
    [`test_users/${actor}`, { role: 'admin', status: 'active' }],
    [`test_users/${target}`, { role: 'user', status: 'active' }],
    [`test_users/${page}`, { role: 'user', status: 'active', ownerPublicId: target }],
    [`test_social_profiles/${target}`, { displayName: 'User', bio: 'Preserved' }],
  ]);
  function writer() {
    const writes: (() => void)[] = [];
    return {
      get: (ref: Ref) => ref.get(),
      create: (ref: Ref, data: Data) => writes.push(() => records.set(ref.path, data)),
      update: (ref: Ref, data: Data) => writes.push(() => records.set(ref.path, { ...records.get(ref.path), ...data })),
      commit: async () => { for (const write of writes) write(); },
    };
  }
  const db = {
    collection: (name: string) => ({ doc: (id: string) => {
      const path = `${name}/${id}`;
      return { path, get: async () => ({ exists: records.has(path), data: () => records.get(path) }) };
    } }),
    batch: writer,
    runTransaction: async (fn: (transaction: ReturnType<typeof writer>) => Promise<unknown>) => {
      const transaction = writer();
      const result = await fn(transaction);
      await transaction.commit();
      return result;
    },
  } as unknown as Firestore;
  const store = new FirestoreAuthStore(db, 'test');
  return { records, store, auth: new AuthService(store, 'test-pepper', () => 100), desk: new AdminDeskService(db, 'test', () => 100) };
}

test('blocking denies existing sessions, refresh, restoration and owned page activity while preserving account data', async () => {
  const { records, store, auth, desk } = fixture();
  const account = await auth.register();
  await desk.setUserStatus(account.user.publicId, 'suspended', actor);
  await desk.setUserStatus(target, 'suspended', actor);
  assert.equal(await store.isUserActive(page), false);
  await assert.rejects(() => auth.getUser(account.session.accessToken), { code: 'SESSION_EXPIRED' });
  await assert.rejects(() => auth.refresh(account.session.refreshToken), { code: 'SESSION_EXPIRED' });
  await assert.rejects(() => auth.restore(account.recoveryId), { code: 'ACCOUNT_UNAVAILABLE' });
  assert.deepEqual(records.get(`test_social_profiles/${target}`), { displayName: 'User', bio: 'Preserved' });
  const auditCount = [...records.keys()].filter((path) => path.startsWith('test_admin_audit/')).length;
  await desk.setUserStatus(target, 'suspended', actor);
  assert.equal([...records.keys()].filter((path) => path.startsWith('test_admin_audit/')).length, auditCount);
  await desk.setUserStatus(target, 'active', actor);
  await desk.setUserStatus(account.user.publicId, 'active', actor);
  assert.equal(await store.isUserActive(target), true);
  assert.equal(await store.isUserActive(page), true);
  assert.equal((await auth.restore(account.recoveryId)).user.publicId, account.user.publicId);
  const audits = [...records].filter(([path]) => path.startsWith('test_admin_audit/')).map(([, data]) => data);
  assert(audits.some((data) => data.actor === actor && data.target === target && data.action === 'user.suspended'));
  assert(audits.some((data) => data.actor === actor && data.target === target && data.action === 'user.active'));
});

test('blocking protects administrators and rejects pages, missing and deleted accounts', async () => {
  const { records, desk } = fixture();
  for (const [id, code] of [[actor, 'ADMIN_PROTECTED'], [page, 'USER_NOT_FOUND'], ['X'.repeat(50), 'USER_NOT_FOUND']]) {
    await assert.rejects(() => desk.setUserStatus(id!, 'suspended', actor), { code });
  }
  records.set(`test_users/${target}`, { role: 'admin', status: 'active' });
  await assert.rejects(() => desk.setUserStatus(target, 'suspended', actor), { code: 'ADMIN_PROTECTED' });
  records.set(`test_users/${target}`, { role: 'user', status: 'deleted' });
  await assert.rejects(() => desk.setUserStatus(target, 'active', actor), { code: 'USER_NOT_FOUND' });
  assert.equal([...records.keys()].some((path) => path.startsWith('test_admin_audit/')), false);
});
