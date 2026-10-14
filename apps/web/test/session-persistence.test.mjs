import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import axios from 'axios';
import ts from 'typescript';

// Load the actual product modules with browser globals and explicit dependencies.
function loadModule(path, browser, dependencies = {}) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  });
  const exports = {};
  runInNewContext(outputText, {
    exports, process, ...browser,
    require(name) {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

function storage(values = new Map()) {
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

function browser(localStorage = storage(), pathname = '/social') {
  const cookies = [];
  const redirects = [];
  const listeners = new Map();
  return {
    cookies, redirects, listeners,
    document: { set cookie(value) { cookies.push(value); } },
    window: {
      localStorage, sessionStorage: storage(),
      location: { protocol: 'https:', pathname, replace: (path) => redirects.push(path) },
      addEventListener: (name, handler) => listeners.set(name, handler),
      removeEventListener: (name) => listeners.delete(name),
    },
  };
}

const session = {
  user: { publicId: 'A'.repeat(50), role: 'user' },
  tokens: { accessToken: 'test-expired-access', refreshToken: 'test-refresh', expiresAt: 1 },
};

function setupRefresh(refresh) {
  const page = browser();
  const stored = loadModule('../app/api/session-storage.ts', page);
  stored.sessionStorage.save(session);
  const apiError = loadModule('../app/api/api-error.ts', page, { axios });
  let requests = 0;
  const client = axios.create({ adapter: async (config) => {
    requests++;
    if (config.headers.get('Authorization') === 'Bearer test-renewed-access') {
      return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config };
    }
    throw new axios.AxiosError('Expired access token', 'ERR_BAD_REQUEST', config, null,
      { status: 401, data: { code: 'SESSION_EXPIRED' }, headers: {}, config });
  } });
  loadModule('../app/api/axios.ts', page, {
    axios: { __esModule: true, default: { create: () => client, post: refresh }, isAxiosError: axios.isAxiosError },
    '@/app/api/session-storage': stored,
    '@/app/api/api-error': apiError,
  });
  return { page, stored, client, requests: () => requests };
}

test('closing and reopening the browser retains the saved session', () => {
  const persistentStorage = storage();
  const first = browser(persistentStorage);
  loadModule('../app/api/session-storage.ts', first).sessionStorage.save(session);
  const reopened = browser(persistentStorage);
  const restored = loadModule('../app/api/session-storage.ts', reopened).sessionStorage.get();
  assert.equal(JSON.stringify(restored), JSON.stringify(session));
});

for (const role of ['user', 'admin']) {
  test(`reopening on login restores missing routing cookies for ${role}`, () => {
    const persistentStorage = storage();
    loadModule('../app/api/session-storage.ts', browser(persistentStorage)).sessionStorage.save({ ...session, user: { ...session.user, role } });
    const reopened = browser(persistentStorage, '/login');
    const stored = loadModule('../app/api/session-storage.ts', reopened);
    const component = loadModule('../features/auth/session-sync.tsx', reopened, {
      react: { useEffect: (effect) => effect() }, '@/app/api/session-storage': stored,
    });
    component.SessionSync();
    assert.deepEqual(reopened.redirects, [role === 'admin' ? '/dashboard' : '/social']);
    assert.ok(reopened.cookies.includes('g000st_session_hint=1; Path=/; Max-Age=2592000; SameSite=Lax; Secure'));
    assert.ok(reopened.cookies.some((cookie) => cookie.startsWith(`user_role=${role};`)));
  });
}

test('explicit logout remains logged out on reopening', () => {
  const persistentStorage = storage();
  const stored = loadModule('../app/api/session-storage.ts', browser(persistentStorage));
  stored.sessionStorage.save(session);
  stored.sessionStorage.clear();
  const reopened = browser(persistentStorage, '/login');
  const next = loadModule('../app/api/session-storage.ts', reopened);
  loadModule('../features/auth/session-sync.tsx', reopened, {
    react: { useEffect: (effect) => effect() }, '@/app/api/session-storage': next,
  }).SessionSync();
  assert.equal(next.sessionStorage.get(), null);
  assert.deepEqual(reopened.redirects, []);
});

for (const status of [undefined, 500, 503, 429]) {
  test(`refresh failure (${status ?? 'offline'}) preserves session and allows retry`, async () => {
    let unavailable = true;
    const failure = new axios.AxiosError('Temporarily unavailable', 'ERR_NETWORK', undefined, undefined,
      status ? { status, data: {}, headers: {} } : undefined);
    const { page, stored, client } = setupRefresh(async () => {
      if (unavailable) throw failure;
      return { data: { session: { ...session.tokens, accessToken: 'test-renewed-access', refreshToken: 'test-renewed-refresh' } } };
    });
    await assert.rejects(client.get('/auth/me'));
    assert.equal(stored.sessionStorage.get()?.tokens.refreshToken, session.tokens.refreshToken);
    assert.deepEqual(page.redirects, []);
    unavailable = false;
    assert.equal((await client.get('/auth/me')).data.ok, true);
    assert.equal(stored.sessionStorage.get()?.tokens.refreshToken, 'test-renewed-refresh');
  });
}

test('rejected refresh token clears the session and redirects to login', async () => {
  const { page, stored, client } = setupRefresh(async () => {
    throw new axios.AxiosError('Session expired', 'ERR_BAD_REQUEST', undefined, undefined,
      { status: 401, data: { code: 'SESSION_EXPIRED' }, headers: {} });
  });
  await assert.rejects(client.get('/auth/me'));
  assert.equal(stored.sessionStorage.get(), null);
  assert.deepEqual(page.redirects, ['/login']);
});

test('parallel requests share a refresh and renew persistent routing cookies', async () => {
  let refreshes = 0;
  const { page, client, requests } = setupRefresh(async () => {
    refreshes++;
    return { data: { session: { ...session.tokens, accessToken: 'test-renewed-access', refreshToken: 'test-renewed-refresh' } } };
  });
  page.cookies.length = 0;
  const results = await Promise.all([client.get('/auth/me'), client.get('/social/feed')]);
  assert.ok(results.every((result) => result.data.ok));
  assert.equal(refreshes, 1);
  assert.equal(requests(), 4);
  assert.ok(page.cookies.some((cookie) => cookie.startsWith('g000st_session_hint=1;') && cookie.includes('Max-Age=2592000')));
});
