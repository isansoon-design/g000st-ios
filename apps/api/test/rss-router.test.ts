import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import express, { type ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { createAdminRouter } from '../src/admin/admin-router.js';
import type { AdminAnalyticsService } from '../src/admin/admin-analytics.js';
import type { AdminDeskService } from '../src/admin/admin-desk.js';
import type { AuthService } from '../src/auth/auth-service.js';
import { ApiError } from '../src/http/api-error.js';
import type { RssInputV1, RssService } from '../src/rss/rss-service.js';

const id = '667fc7d4-91b9-4c48-9b45-63b38c66d165';
const input = { name: 'News', url: 'https://example.com/rss', accountPublicId: 'A'.repeat(50), intervalMinutes: 60, enabled: true };
const calls: { action: string; actor?: string; id?: string; input?: RssInputV1 }[] = [];
let server: Server;
let origin: string;
before(async () => {
  const auth = { async getUser(token: string) {
    if (!token) throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in.');
    return { publicId: 'Z'.repeat(50), role: token === 'admin' ? 'admin' : 'user' };
  } } as unknown as AuthService;
  const rss = {
    async list() { calls.push({ action: 'list' }); return { version: 1, sources: [] }; },
    async save(sourceId: string | undefined, body: RssInputV1, actor: string) { calls.push({ action: 'save', id: sourceId, input: body, actor }); return sourceId ?? id; },
    async remove(sourceId: string) { calls.push({ action: 'remove', id: sourceId }); },
  } as unknown as RssService;
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin', createAdminRouter(auth, {} as AdminAnalyticsService, {} as AdminDeskService, rss));
  const errors: ErrorRequestHandler = (error, _request, response, _next) => {
    response.status(error instanceof ApiError ? error.status : error instanceof z.ZodError ? 400 : 500).json({ message: 'Rejected' });
  };
  app.use(errors);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  const address = server.address(); assert(address && typeof address !== 'string');
  origin = `http://127.0.0.1:${address.port}/api/v1/admin/rss`;
});
after(async () => { if (server) await new Promise<void>((resolve) => server.close(() => resolve())); });
async function request(method: string, token: string | null, path = '', body?: unknown) {
  return fetch(`${origin}${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
}

test('all RSS endpoints reject unauthenticated and non-admin requests before accessing sources', async () => {
  const count = calls.length;
  for (const token of [null, 'member']) {
    for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
      const response = await request(method, token, ['PUT', 'DELETE'].includes(method) ? `/${id}` : '', ['POST', 'PUT'].includes(method) ? input : undefined);
      assert.equal(response.status, token ? 403 : 401);
    }
  }
  assert.equal(calls.length, count);
});

test('admin RSS CRUD uses versioned responses and the authenticated administrator', async () => {
  assert.deepEqual(await (await request('GET', 'admin')).json(), { version: 1, sources: [] });
  const created = await request('POST', 'admin', '', input);
  assert.equal(created.status, 201);
  assert.deepEqual(await created.json(), { version: 1, id });
  assert.equal(calls.at(-1)?.actor, 'Z'.repeat(50));
  assert.equal((await request('PUT', 'admin', `/${id}`, { ...input, enabled: false })).status, 200);
  assert.equal(calls.at(-1)?.input?.enabled, false);
  assert.equal((await request('DELETE', 'admin', `/${id}`)).status, 204);
  assert.deepEqual(calls.at(-1), { action: 'remove', id });
});

test('RSS API rejects invalid schedules, unsafe identifiers and extra fields', async () => {
  const count = calls.length;
  assert.equal((await request('POST', 'admin', '', { ...input, intervalMinutes: 0 })).status, 400);
  assert.equal((await request('POST', 'admin', '', { ...input, updatedBy: 'spoofed' })).status, 400);
  assert.equal((await request('PUT', 'admin', '/not-a-uuid', input)).status, 400);
  assert.equal(calls.length, count);
});
