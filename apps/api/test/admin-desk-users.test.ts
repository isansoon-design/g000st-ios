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
