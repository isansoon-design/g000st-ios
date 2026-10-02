import assert from 'node:assert/strict';
import test from 'node:test';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { recentGeography } from '../src/presence/presence-geography.js';
import { PresenceService } from '../src/presence/presence-service.js';
import { decodeGeoCityHeader } from '../src/presence/presence-router.js';
import { FirestorePresenceStore } from '../src/presence/firestore-presence-store.js';

const now = Date.parse('2026-10-03T12:00:00Z');

test('location headers require trust and validate country and city independently', async () => {
  const writes: unknown[][] = [];
  const store = { setLastActive: async (...args: unknown[]) => { writes.push(args); }, getLastActiveMany: async () => new Map<string, number>() };
  await new PresenceService(store, () => now).heartbeat('user', { country: 'SY', city: 'Damascus' });
  assert.equal(writes.at(-1)?.[2], undefined);
  const service = new PresenceService(store, () => now, true);
  await service.heartbeat('user', { country: ' sy ', city: ' Damascus ' });
  assert.deepEqual(writes.at(-1)?.[2], { country: 'SY', city: 'Damascus' });
  for (const country of ['XX', 'ZZ', 'Syria', 'SY\r\nX-Test: 1']) {
    await service.heartbeat('user', { country, city: 'Damascus' });
    assert.equal(writes.at(-1)?.[2], undefined);
  }
  for (const city of ['<script>', 'bad\u0000city', 'x'.repeat(101)]) {
    await service.heartbeat('user', { country: 'SY', city });
    assert.deepEqual(writes.at(-1)?.[2], { country: 'SY' });
  }
});

test('recent locations exclude stale, future and malformed records', () => {
  const record = { country: 'SY', city: 'Damascus', geoRecordedAtMs: now };
  assert.deepEqual(recentGeography(record, now), { country: 'SY', city: 'Damascus', recordedAtMs: now });
  for (const geoRecordedAtMs of [now + 1, now - 30 * 86_400_000 - 1, NaN, Infinity, -1]) {
    assert.equal(recentGeography({ ...record, geoRecordedAtMs }, now), undefined);
  }
  assert.equal(recentGeography(undefined, now), undefined);
  assert.equal(recentGeography({ ...record, country: 'XX' }, now), undefined);
  assert.deepEqual(recentGeography({ ...record, city: '<bad>' }, now), { country: 'SY', recordedAtMs: now });
});

test('UTF-8 city names survive HTTP header decoding', () => {
  for (const city of ['Damascus', 'São Paulo', 'München', 'دمشق']) {
    assert.equal(decodeGeoCityHeader(Buffer.from(city, 'utf8').toString('latin1')), city);
  }
  assert.equal(decodeGeoCityHeader('\xff'), undefined);
});

test('a country-only lookup removes the previous city instead of mixing locations', async () => {
  let written: Record<string, unknown> = {};
  const db = { collection: () => ({ doc: () => ({ set: async (data: Record<string, unknown>) => { written = data; } }) }) } as unknown as Firestore;
  const store = new FirestorePresenceStore(db, 'test');
  await store.setLastActive('user', now, { country: 'TR' });
  assert.equal(written.country, 'TR');
  assert.ok((written.city as FieldValue).isEqual(FieldValue.delete()));
  assert.equal(written.geoRecordedAtMs, now);
});
