import assert from 'node:assert/strict';
import test from 'node:test';
import type { Firestore } from 'firebase-admin/firestore';

import { AdminDeskService } from '../src/admin/admin-desk.js';

test('admin user pages skip page accounts and deleted accounts without losing the cursor', async () => {
  const ids = ['A', 'B', 'C', 'D', 'E', 'F'].map((letter) => letter.repeat(50));
  const rows = ids.map((id, index) => ({
    id,
    data: () => ({ createdAtMs: 600 - index, status: index === 2 ? 'deleted' : 'active', ...(index === 1 ? { ownerPublicId: ids[0] } : {}) }),
  }));
  function userQuery(after?: number, take = 51) {
    return {
      orderBy: () => userQuery(after, take),
      startAfter: (createdAtMs: number) => userQuery(createdAtMs, take),
      limit: (value: number) => userQuery(after, value),
      get: async () => {
        const docs = rows.filter((row) => after === undefined || row.data().createdAtMs < after).slice(0, take);
        return { docs, size: docs.length, empty: docs.length === 0 };
      },
    };
  }
  const db = {
    collection: (name: string) => ({
      orderBy: () => userQuery(),
      doc: (id: string) => ({ name, id }),
    }),
    getAll: async (...refs: { name: string; id: string }[]) => refs.map((ref) => ({ data: () => ref.name.endsWith('social_profiles') ? { displayName: ref.id.slice(0, 1) } : { lastActiveAtMs: 123 } })),
  } as unknown as Firestore;
  const service = new AdminDeskService(db, 'staging');

  const first = await service.listUsers(2);
  assert.deepEqual(first.users.map((user) => user.publicId), [ids[0], ids[3]]);
  assert.equal(first.users[0]?.displayName, 'A');
  assert.equal(first.users[0]?.lastActiveAtMs, 123);
  assert.ok(first.nextCursor);

  const second = await service.listUsers(2, first.nextCursor);
  assert.deepEqual(second.users.map((user) => user.publicId), [ids[4], ids[5]]);
  assert.equal(second.nextCursor, undefined);
});

test('social and market post pages skip deleted records and keep an independent cursor', async () => {
  const rows = Array.from({ length: 55 }, (_, index) => ({
    id: `post_${String(index).padStart(3, '0')}`,
    data: () => ({ createdAtMs: 1000 - index, ownerPublicId: 'owner', content: `Item ${index}`, ...(index === 1 || index === 2 || index === 50 ? { deletedAtMs: 10 } : {}) }),
  }));
  function postQuery(after?: number, take = 51) {
    return {
      orderBy: () => postQuery(after, take),
      startAfter: (createdAtMs: number) => postQuery(createdAtMs, take),
      limit: (value: number) => postQuery(after, value),
      get: async () => {
        const docs = rows.filter((row) => after === undefined || row.data().createdAtMs < after).slice(0, take);
        return { docs, size: docs.length, empty: docs.length === 0 };
      },
    };
  }
  const db = { collection: () => ({ orderBy: () => postQuery() }) } as unknown as Firestore;
  const service = new AdminDeskService(db, 'staging');
  const first = await service.listPosts('social', 20);
  const second = await service.listPosts('social', 20, first.nextCursor);
  const third = await service.listPosts('social', 20, second.nextCursor);
  assert.equal(first.items.length, 20);
  assert.equal(second.items.length, 20);
  assert.equal(third.items.length, 12);
  assert.equal(new Set([...first.items, ...second.items, ...third.items].map((item) => item.id)).size, 52);
  assert.equal(third.nextCursor, undefined);
  await assert.rejects(() => service.listPosts('market', 20, first.nextCursor), { code: 'INVALID_CURSOR' });
});

test('searched user pages keep stable order when creation times match', async () => {
  const ids = ['A', 'B', 'C', 'D', 'E'].map((letter) => letter.repeat(50));
  const users = ids.map((id) => ({ id, data: () => ({ createdAtMs: 100, status: 'active' }) }));
  const profiles = ids.map((id) => ({ id, data: () => ({ displayName: 'Sam' }) }));
  const db = {
    collection: (name: string) => ({
      select: () => ({ get: async () => ({ docs: name.endsWith('users') ? users : profiles }) }),
      doc: (id: string) => ({ name, id }),
    }),
    getAll: async (...refs: { name: string; id: string }[]) => refs.map((ref) => ({ data: () => ref.name.endsWith('social_profiles') ? { displayName: 'Sam' } : { lastActiveAtMs: 0 } })),
  } as unknown as Firestore;
  const service = new AdminDeskService(db, 'staging');
  const first = await service.listSearchedUsers(2, 'sam');
  const second = await service.listSearchedUsers(2, 'sam', first.nextCursor);
  const third = await service.listSearchedUsers(2, 'sam', second.nextCursor);
  assert.deepEqual([...first.users, ...second.users, ...third.users].map((user) => user.publicId), ids.reverse());
  assert.equal(third.nextCursor, undefined);
});
