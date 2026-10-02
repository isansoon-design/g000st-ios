import assert from 'node:assert/strict';
import test from 'node:test';
import type { Firestore } from 'firebase-admin/firestore';
import { downloadFeed, feedUrl, parseFeed, publicAddress } from '../src/rss/rss-feed.js';
import { RssService, rssInput } from '../src/rss/rss-service.js';

const url = 'https://example.com/feed';
const xml = '<rss><channel><item><guid>1</guid><title>First</title><description><![CDATA[<p>Hello</p><script>bad()</script>]]></description><link>/first</link></item><item><guid>2</guid><title>Second</title></item></channel></rss>';
const input = { name: 'News', url, accountPublicId: 'A'.repeat(50), intervalMinutes: 1, enabled: true };

test('RSS and Atom become bounded plain-text posts with stable identifiers and source links', () => {
  const entries = parseFeed(xml, url);
  assert.equal(entries.length, 2);
  assert.equal(entries[0]!.content, 'First\n\nHello\n\nhttps://example.com/first');
  assert.equal(parseFeed(xml.replace('First', 'Edited'), url)[0]!.key, entries[0]!.key);
  const atom = '<feed xmlns="http://www.w3.org/2005/Atom"><entry><id>abc</id><title>Atom &amp; RSS</title><summary>News</summary><link rel="self" href="/self"/><link rel="alternate" href="/article"/></entry></feed>';
  assert.equal(parseFeed(atom, url)[0]!.content, 'Atom & RSS\n\nNews\n\nhttps://example.com/article');
  const long = `<rss><channel><item><title>${'x'.repeat(5000)}</title><link>/story</link></item></channel></rss>`;
  assert.equal(parseFeed(long, url)[0]!.content.length, 4000);
  assert.ok(parseFeed(long, url)[0]!.content.endsWith('https://example.com/story'));
});

test('reject malformed XML, DTDs, oversized feeds and unsafe URL schemes', () => {
  for (const body of ['<rss>', '<html><body>No feed</body></html>', '<!DOCTYPE rss><rss/>', 'x'.repeat(2 * 1024 * 1024 + 1)]) assert.throws(() => parseFeed(body, url));
  for (const value of ['file:///etc/passwd', 'https://user:secret@example.com/rss', 'https://example.com:8080/rss']) assert.throws(() => feedUrl(value));
  assert.equal(parseFeed('<rss><channel/></rss>', url).length, 0);
  assert.equal(parseFeed('<rss><channel><item><title>Safe</title><link>javascript:alert(1)</link></item></channel></rss>', url)[0]!.content, 'Safe');
});

test('private, reserved and IPv4-mapped addresses cannot be fetched', async () => {
  for (const address of ['127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.1.1', '169.254.169.254', '0.0.0.0', '100.64.0.1', '::1', '::ffff:127.0.0.1', 'fc00::1', 'fe80::1', '224.0.0.1']) assert.equal(publicAddress(address), false, address);
  assert.equal(publicAddress('8.8.8.8'), true);
  await assert.rejects(() => downloadFeed('http://127.0.0.1/feed'), /public address/);
});

test('RSS input validates account IDs, intervals and unknown fields', () => {
  assert.equal(rssInput.parse(input).intervalMinutes, 1);
  for (const patch of [{ intervalMinutes: 0 }, { intervalMinutes: 1.5 }, { accountPublicId: 'unknown' }, { unexpected: true }]) assert.equal(rssInput.safeParse({ ...input, ...patch }).success, false);
});

// Serialized atomic transactions model commit/rollback, including competing workers.
function fixture(download: (url: string) => Promise<string> = async () => xml) {
  type Row = Record<string, unknown>;
  type Ref = { path: string; id: string; delete(): Promise<void> };
  const rows = new Map<string, Row>();
  let now = 1_000;
  let tail = Promise.resolve();
  let failPostCommit = false;
  const ref = (path: string): Ref => ({ path, id: path.split('/').at(-1)!, async delete() { rows.delete(path); } });
  const snapshot = (reference: Ref) => ({ exists: rows.has(reference.path), data: () => rows.get(reference.path) });
  const db = {
    collection: (name: string) => ({ doc: (id: string) => ref(`${name}/${id}`) }),
    runTransaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      const previous = tail;
      let release!: () => void;
      tail = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      const writes: (() => void)[] = [];
      let createsPost = false;
      const tx = {
        get: async (reference: Ref) => snapshot(reference),
        getAll: async (...references: Ref[]) => references.map(snapshot),
        set: (reference: Ref, data: Row) => { writes.push(() => rows.set(reference.path, data)); },
        update: (reference: Ref, data: Row) => { writes.push(() => { assert.ok(rows.has(reference.path)); rows.set(reference.path, { ...rows.get(reference.path), ...data }); }); },
        create: (reference: Ref, data: Row) => { assert.ok(!rows.has(reference.path)); createsPost ||= reference.path.startsWith('test_social_posts/'); writes.push(() => rows.set(reference.path, data)); },
      };
      try {
        const result = await fn(tx);
        if (failPostCommit && createsPost) { failPostCommit = false; throw new Error('Simulated commit failure'); }
        writes.forEach((write) => write());
        return result;
      } finally { release(); }
    },
  } as unknown as Firestore;
  rows.set(`test_users/${input.accountPublicId}`, { status: 'active' });
  return {
    rows, service: new RssService(db, 'test', () => now, download),
    secondWorker: () => new RssService(db, 'test', () => now, download),
    advance: (ms = 60_000) => { now += ms; },
    failCommit: () => { failPostCommit = true; },
    posts: () => [...rows.entries()].filter(([key]) => key.startsWith('test_social_posts/')),
  };
}

test('schedule publishes one public post per interval and receipts survive post deletion and restart', async () => {
  const f = fixture();
  const id = await f.service.save(undefined, input, 'admin');
  await f.service.run(id);
  assert.equal(f.posts().length, 0);
  f.advance();
  await Promise.all([f.service.run(id), f.secondWorker().run(id)]);
  assert.equal(f.posts().length, 1);
  assert.equal(f.posts()[0]![1].ownerPublicId, input.accountPublicId);
  assert.equal(f.posts()[0]![1].visibility, 'public');
  assert.equal(f.posts()[0]![1].sharedToSocial, true);
  f.rows.delete(f.posts()[0]![0]);
  f.advance();
  await f.secondWorker().run(id);
  assert.equal(f.posts().length, 1);
  assert.equal(f.posts()[0]![1].content, 'Second');
  f.advance();
  await f.service.run(id);
  assert.equal(f.posts().length, 1);
});

test('failed publication leaves no receipt and retries next interval', async () => {
  const f = fixture();
  const id = await f.service.save(undefined, input, 'admin');
  f.advance(); f.failCommit();
  await f.service.run(id);
  assert.equal(f.posts().length, 0);
  assert.equal([...f.rows.keys()].filter((key) => key.startsWith('test_rss_published/')).length, 0);
  assert.ok(f.rows.get(`test_rss_sources/${id}`)!.lastError);
  f.advance(); await f.service.run(id);
  assert.equal(f.posts().length, 1);
});

test('pausing or deleting while fetching prevents an in-flight post', async () => {
  for (const remove of [false, true]) {
    let started!: () => void;
    const fetching = new Promise<void>((resolve) => { started = resolve; });
    let finish!: (xml: string) => void;
    const f = fixture(async () => { started(); return new Promise<string>((resolve) => { finish = resolve; }); });
    const id = await f.service.save(undefined, input, 'admin');
    f.advance();
    const run = f.service.run(id);
    await fetching;
    if (remove) await f.service.remove(id);
    else await f.service.save(id, { ...input, enabled: false }, 'admin');
    finish(xml); await run;
    assert.equal(f.posts().length, 0);
  }
});

test('missing accounts are rejected and suspended accounts cannot publish', async () => {
  const f = fixture();
  await assert.rejects(() => f.service.save(undefined, { ...input, accountPublicId: 'B'.repeat(50) }, 'admin'), { code: 'RSS_ACCOUNT_UNAVAILABLE' });
  const id = await f.service.save(undefined, input, 'admin');
  f.rows.set(`test_users/${input.accountPublicId}`, { status: 'suspended' });
  f.advance(); await f.service.run(id);
  assert.equal(f.posts().length, 0);
});

test('fetch failures are recorded without leaking remote errors and do not produce posts', async () => {
  const f = fixture(async () => { throw new Error('Sensitive remote response'); });
  const id = await f.service.save(undefined, input, 'admin');
  f.advance(); await f.service.run(id);
  assert.equal(f.posts().length, 0);
  assert.match(String(f.rows.get(`test_rss_sources/${id}`)!.lastError), /Could not fetch/);
});
