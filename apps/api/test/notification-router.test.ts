import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import express, { type ErrorRequestHandler } from 'express';
import type { Server } from 'node:http';
import { z } from 'zod';
import type { AuthService } from '../src/auth/auth-service.js';
import { ApiError } from '../src/http/api-error.js';
import { createNotificationRouter } from '../src/notifications/notification-router.js';
import type { NotificationCenter } from '../src/notifications/notification-center.js';
import type { NotificationService } from '../src/notifications/notification-service.js';

const owner = 'O'.repeat(50);
const page = 'P'.repeat(50);
const calls: { kind: string; publicId: string; scope?: string; input?: unknown }[] = [];
let server: Server;
let origin: string;
before(async () => {
  const auth = {
    getUser: async (token: string) => { if (!token) throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in.'); return { publicId: owner, role: token === 'admin' ? 'admin' : 'user' }; },
    getActor: async (token: string, actor?: string) => {
      if (!token) throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in.');
      if (actor && actor !== owner && actor !== page) throw new ApiError(403, 'PAGE_ACCESS_DENIED', 'Unavailable.');
      return { publicId: actor ?? owner, role: 'user' };
    },
  } as unknown as AuthService;
  const center = {
    list: async (publicId: string, scope: string) => { calls.push({ kind: 'list', publicId, scope }); return { version: 1, items: [], unreadCount: 0 }; },
    markRead: async (publicId: string, scope: string, input: unknown) => { calls.push({ kind: 'read', publicId, scope, input }); },
    preferences: async () => ({ pushEnabled: true, mutedCategories: [] }),
    setPreferences: async (publicId: string, scope: string, input: unknown) => { calls.push({ kind: 'preferences', publicId, scope, input }); },
  } as unknown as NotificationCenter;
  const sender = { registerDevice: async (publicId: string, input: unknown) => { calls.push({ kind: 'device', publicId, input }); }, unregisterDevice: async () => undefined } as unknown as NotificationService;
  const app = express(); app.use(express.json()); app.use('/notifications', createNotificationRouter(auth, sender, center));
  const errors: ErrorRequestHandler = (error, _request, response, _next) => {
    response.status(error instanceof ApiError ? error.status : error instanceof z.ZodError ? 400 : 500).json({ error: 'Rejected' });
  };
  app.use(errors);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address(); assert(address && typeof address !== 'string');
  origin = `http://127.0.0.1:${address.port}`;
});
after(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });

async function request(path: string, token: string | null = 'member', actor?: string, body?: unknown, method = 'GET') {
  return fetch(`${origin}/notifications${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(actor ? { 'X-Acting-Public-Id': actor } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
test('notification API refuses unauthenticated and non-admin access to admin inbox/preferences/read state', async () => {
  assert.equal((await request('', null)).status, 401);
  assert.equal((await request('?scope=admin')).status, 403);
  assert.equal((await request('/preferences?scope=admin')).status, 403);
  assert.equal((await request('/read', 'member', undefined, { scope: 'admin', ids: ['a'.repeat(64)] }, 'POST')).status, 403);
});
test('notification API binds a page inbox to its actor and the admin inbox to the authenticated owner', async () => {
  assert.equal((await request('', 'member', page)).status, 200);
  assert.deepEqual(calls.at(-1), { kind: 'list', publicId: page, scope: 'user' });
  assert.equal((await request('?scope=admin', 'admin', page)).status, 200);
  assert.deepEqual(calls.at(-1), { kind: 'list', publicId: owner, scope: 'admin' });
  assert.equal((await request('', 'member', 'X'.repeat(50))).status, 403);
});
test('notification API refuses recipient overrides, unsafe IDs and unknown preference categories', async () => {
  assert.equal((await request('?recipientPublicId=someone')).status, 400);
  assert.equal((await request('/read', 'member', undefined, { ids: ['../other'] }, 'POST')).status, 400);
  assert.equal((await request('/preferences', 'member', undefined, { pushEnabled: true, mutedCategories: ['unknown'] }, 'PUT')).status, 400);
  assert.equal((await request('/read', 'member', page, { ids: ['a'.repeat(64)] }, 'POST')).status, 204);
  assert.equal(calls.at(-1)!.publicId, page);
});
test('FCM web registration preserves the verified owner and rejects ambiguous transports', async () => {
  const deviceId = 'a8b631a6-19ad-4ae3-a119-74ebd35bca94';
  const body = { deviceId, fcmToken: 'fcm-token-'.repeat(8), platform: 'web' };
  assert.equal((await request('/devices', 'member', page, body, 'PUT')).status, 204);
  assert.deepEqual(calls.at(-1), { kind: 'device', publicId: page, input: { ...body, ownerPublicId: owner } });
  assert.equal((await request('/devices', 'member', page, { ...body, expoPushToken: 'ExpoPushToken[abcdefghijklmnop]' }, 'PUT')).status, 400);
});
