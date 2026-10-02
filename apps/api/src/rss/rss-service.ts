import { randomUUID } from 'node:crypto';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { z } from 'zod';
import { ApiError } from '../http/api-error.js';
import { downloadFeed, feedUrl, parseFeed } from './rss-feed.js';

export const rssInput = z.object({
  name: z.string().trim().min(1).max(100),
  url: z.string().trim().max(2048).transform((value, context) => {
    try { return feedUrl(value).href; } catch { context.addIssue({ code: 'custom', message: 'Invalid feed URL.' }); return z.NEVER; }
  }),
  accountPublicId: z.string().length(50).regex(/^[A-Za-z0-9]+$/),
  intervalMinutes: z.number().int().min(1).max(43_200),
  enabled: z.boolean(),
}).strict();
export type RssInputV1 = z.infer<typeof rssInput>;
export type RssSourceV1 = RssInputV1 & {
  id: string; createdAtMs: number; updatedAtMs: number; nextRunAtMs: number | null;
  lastCheckedAtMs: number | null; lastPublishedAtMs: number | null;
  lastPostId: string | null; lastError: string | null; publishedCount: number;
};
type StoredSource = Omit<RssSourceV1, 'id' | 'nextRunAtMs'> & { nextRunAtMs: number; lease: string; updatedBy: string };
const DISABLED = Number.MAX_SAFE_INTEGER;

export class RssService {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  constructor(private readonly db: Firestore, private readonly prefix: string, private readonly now = Date.now,
    private readonly download = downloadFeed) {}
  private collection(name: string) { return this.db.collection(`${this.prefix}_${name}`); }
  private sources() { return this.collection('rss_sources'); }
  async list(): Promise<{ version: 1; sources: RssSourceV1[] }> {
    const snapshot = await this.sources().orderBy('createdAtMs', 'desc').get();
    return { version: 1, sources: snapshot.docs.map((doc) => {
      const { lease: _lease, updatedBy: _updatedBy, ...source } = doc.data() as StoredSource;
      return { ...source, id: doc.id, nextRunAtMs: source.enabled ? source.nextRunAtMs : null };
    }) };
  }
  private async requireAccount(transaction: Transaction, publicId: string) {
    const user = (await transaction.get(this.collection('users').doc(publicId))).data();
    if (!user || user.status !== 'active' || user.deletedAtMs != null) throw new ApiError(400, 'RSS_ACCOUNT_UNAVAILABLE', 'Choose an existing active account Public ID.');
    if (user.ownerPublicId) {
      const owner = (await transaction.get(this.collection('users').doc(user.ownerPublicId))).data();
      if (!owner || owner.status !== 'active' || owner.deletedAtMs != null) throw new ApiError(400, 'RSS_ACCOUNT_UNAVAILABLE', 'The page owner must be active.');
    }
  }
  async save(id: string | undefined, input: RssInputV1, actor: string): Promise<string> {
    const ref = this.sources().doc(id ?? randomUUID());
    await this.db.runTransaction(async (transaction) => {
      const existing = await transaction.get(ref);
      if (id && !existing.exists) throw new ApiError(404, 'RSS_NOT_FOUND', 'RSS source not found.');
      await this.requireAccount(transaction, input.accountPublicId);
      const now = this.now();
      transaction.set(ref, {
        ...(existing.exists ? existing.data() : { createdAtMs: now, publishedCount: 0, lastCheckedAtMs: null, lastPublishedAtMs: null, lastPostId: null }),
        ...input, updatedAtMs: now, updatedBy: actor, lease: '', lastError: null,
        nextRunAtMs: input.enabled ? now + input.intervalMinutes * 60_000 : DISABLED,
      });
    });
    return ref.id;
  }
  async remove(id: string) { await this.sources().doc(id).delete(); }
  start() {
    if (this.timer) return;
    void this.sweep();
    this.timer = setInterval(() => void this.sweep(), 15_000);
    this.timer.unref();
  }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }
  async sweep(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const due = await this.sources().where('nextRunAtMs', '<=', this.now()).orderBy('nextRunAtMs').limit(20).get();
      await Promise.all(due.docs.map((doc) => this.run(doc.id)));
    } catch { console.error('g000st RSS sweep failed.'); }
    finally { this.running = false; }
  }
  async run(id: string): Promise<void> {
    const ref = this.sources().doc(id);
    const claimed = await this.db.runTransaction(async (transaction) => {
      const source = (await transaction.get(ref)).data() as StoredSource | undefined;
      if (!source?.enabled || source.nextRunAtMs > this.now()) return null;
      const lease = randomUUID();
      transaction.update(ref, { lease, nextRunAtMs: this.now() + 120_000 });
      return { ...source, lease };
    });
    if (!claimed) return;
    let failure = 'Could not fetch the feed. Check its URL and server availability.';
    try {
      const xml = await this.download(claimed.url);
      failure = 'Invalid or unsupported RSS/Atom feed (maximum 2 MB).';
      const entries = parseFeed(xml, claimed.url);
      failure = 'Could not publish. Check the publishing account and try again.';
      await this.db.runTransaction(async (transaction) => {
        const source = (await transaction.get(ref)).data() as StoredSource | undefined;
        if (!source?.enabled || source.lease !== claimed.lease) return;
        await this.requireAccount(transaction, source.accountPublicId);
        // Keep a separate receipt even when a moderator deletes the post or source.
        const receipts = entries.length ? await transaction.getAll(...entries.map((entry) => this.collection('rss_published').doc(entry.key))) : [];
        const entry = entries.find((_entry, index) => !receipts[index]!.exists);
        const now = this.now();
        const postId = randomUUID();
        if (entry) {
          transaction.create(this.collection('social_posts').doc(postId), {
            ownerPublicId: source.accountPublicId, content: entry.content, visibility: 'public', sharedToSocial: true,
            createdAtMs: now, updatedAtMs: now, likeCount: 0, commentCount: 0,
            rssSourceId: id, rssEntryKey: entry.key,
          });
          transaction.create(this.collection('rss_published').doc(entry.key), { postId, sourceId: id, publishedAtMs: now });
        }
        transaction.update(ref, {
          lease: '', nextRunAtMs: now + source.intervalMinutes * 60_000, lastCheckedAtMs: now, lastError: null,
          ...(entry ? { lastPublishedAtMs: now, lastPostId: postId, publishedCount: source.publishedCount + 1 } : {}),
        });
      });
    } catch (error) {
      await this.db.runTransaction(async (transaction) => {
        const source = (await transaction.get(ref)).data() as StoredSource | undefined;
        if (source?.lease !== claimed.lease) return;
        transaction.update(ref, { lease: '', nextRunAtMs: this.now() + source.intervalMinutes * 60_000,
          lastCheckedAtMs: this.now(), lastError: error instanceof ApiError ? error.message : failure });
      });
    }
  }
}
