import assert from 'node:assert/strict';
import test from 'node:test';
import express, { type ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { createCommunicationRouter } from '../src/admin/communication-router.js';
import { createAdminRouter } from '../src/admin/admin-router.js';
import type { AuthService } from '../src/auth/auth-service.js';
import type { AdminDeskService } from '../src/admin/admin-desk.js';
import type { AdminAnalyticsService } from '../src/admin/admin-analytics.js';
import type { ChatService } from '../src/chat/chat-service.js';
import { ApiError } from '../src/http/api-error.js';

test('support chat requires login; configuration requires admin and uses the configured recipient', async () => {
  const owner = 'A'.repeat(50);
  const support = 'B'.repeat(50);
  const page = 'C'.repeat(50);
  let configured: string | null = null;
  const chats: string[][] = [];
  const auth = {
    async getUser(token: string) {
      if (!token) throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in.');
      return { publicId: owner, role: token === 'admin' ? 'admin' : 'user' };
    },
    async getActor(_token: string, acting?: string) { return { publicId: acting ?? owner, role: 'user' }; },
    async resolveSupportAccount(identifier: string, kind: string) {
      assert.equal(identifier, support);
      assert.equal(kind, 'public');
      return support;
    },
  } as unknown as AuthService;
  const desk = {
    async getSupportContact() { return { version: 1, publicId: configured }; },
    async setSupportContact(publicId: string | null, actor: string) { assert.equal(actor, owner); configured = publicId; },
  } as unknown as AdminDeskService;
  const chat = { async startConversation(sender: string, recipient: string) { chats.push([sender, recipient]); return { id: 'existing-conversation' }; } } as unknown as ChatService;
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin', createAdminRouter(auth, {} as AdminAnalyticsService, desk));
  app.use('/api/v1/communication', createCommunicationRouter(auth, desk, chat));
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    res.status(error instanceof ApiError ? error.status : error instanceof z.ZodError ? 400 : 500).json({ code: error.code });
  };
  app.use(errors);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  try {
    const address = server.address(); assert(address && typeof address !== 'string');
    const origin = `http://127.0.0.1:${address.port}/api/v1`;
    const request = (path: string, method: string, token?: string, body?: unknown, acting?: string) => fetch(origin + path, {
      method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(acting ? { 'X-Acting-Public-Id': acting } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    assert.equal((await request('/communication/support/conversation', 'POST')).status, 401);
    assert.equal((await request('/admin/support', 'GET', 'member')).status, 403);
    assert.equal((await request('/admin/support', 'PUT', 'member', { identifier: support, kind: 'public' })).status, 403);
    assert.equal((await request('/communication/support/conversation', 'POST', 'member')).status, 503);
    assert.equal(chats.length, 0);
    assert.equal((await request('/admin/support', 'PUT', 'admin', { identifier: 'bad', kind: 'public' })).status, 400);
    const saved = await request('/admin/support', 'PUT', 'admin', { identifier: support, kind: 'public' });
    assert.deepEqual(await saved.json(), { version: 1, publicId: support });
    const opened = await request('/communication/support/conversation', 'POST', 'member', undefined, page);
    assert.deepEqual(await opened.json(), { version: 1, conversationId: 'existing-conversation' });
    assert.deepEqual(chats, [[page, support]]);
    assert.equal((await request('/admin/support', 'PUT', 'admin', { identifier: null, kind: 'public' })).status, 200);
    assert.equal((await request('/communication/support/conversation', 'POST', 'member')).status, 503);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
