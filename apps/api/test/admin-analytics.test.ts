import assert from 'node:assert/strict';
import test from 'node:test';

import { summarizeUsers } from '../src/admin/admin-analytics.js';

test('admin analytics counts accounts and recent activity without treating pages as users', () => {
  const now = Date.parse('2026-09-27T12:00:00.000Z');
  const users = [
    { id: 'today', data: { createdAtMs: Date.parse('2026-09-27T00:00:00.000Z'), status: 'active' } },
    { id: 'earlier', data: { createdAtMs: Date.parse('2026-09-02T08:00:00.000Z'), status: 'active' } },
    { id: 'blocked', data: { createdAtMs: Date.parse('2026-08-12T08:00:00.000Z'), status: 'suspended' } },
    { id: 'page', data: { createdAtMs: now, ownerPublicId: 'today', status: 'active' } },
    { id: 'deleted', data: { createdAtMs: now, status: 'deleted' } },
  ];
  const presence = new Map([
    ['today', { lastActiveAtMs: now - 30_000, country: 'SY', city: 'Damascus', geoRecordedAtMs: now - 30_000 }],
    ['earlier', { lastActiveAtMs: Date.parse('2026-09-05T08:00:00.000Z') }],
    ['blocked', { lastActiveAtMs: now - 10_000, country: 'TR', city: 'Istanbul', geoRecordedAtMs: now - 10_000 }],
  ]);
  const result = summarizeUsers(users, presence, now);

  assert.equal(result.users.total, 3);
  assert.equal(result.users.registeredToday, 1);
  assert.equal(result.users.registeredThisMonth, 2);
  assert.equal(result.users.activeToday, 1);
  assert.equal(result.users.activeThisMonth, 2);
  assert.equal(result.users.onlineNow, 1);
  assert.equal(result.users.suspended, 1);
  assert.equal(result.users.registrationsByDay.at(-1)?.count, 1);
  assert.deepEqual(result.geography.countries, [{ name: 'SY', count: 1 }]);
  assert.deepEqual(result.geography.cities, [{ name: 'Damascus', country: 'SY', count: 1 }]);
});
