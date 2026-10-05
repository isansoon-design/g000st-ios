import { contentVisibility } from '../social/content-visibility.js';
import { createHash, randomUUID } from 'node:crypto';
import { FieldPath, type DocumentData, type DocumentReference, type Firestore } from 'firebase-admin/firestore';
import { NotificationCenter } from './notification-center.js';
import type { NotificationService } from './notification-service.js';
import type { NotificationEvent } from './notification-types.js';

const FINISHED = Number.MAX_SAFE_INTEGER;
const LEASE_MS = 120_000;
type FanoutJob = NotificationEvent & { lease: string; state: string; availableAtMs: number; attempts: number; cursor?: string | null };
type DeliveryJob = { lease: string; event: NotificationEvent; attempts: number };

export function notificationItemId(eventId: string, publicId: string): string {
  return createHash('sha256').update(`${eventId}:${publicId}`).digest('hex');
}

export function notificationGroupKey(eventId: string, event: NotificationEvent): string {
  if (event.type.endsWith('.liked')) return `${event.type}:${event.path}:${Math.floor(event.createdAtMs / (15 * 60_000))}`;
  if (event.type === 'social.followed') return `${event.type}:${event.actorPublicId}:${Math.floor(event.createdAtMs / (15 * 60_000))}`;
  return eventId;
}

export function canSendNotification(event: NotificationEvent, preferences: { pushEnabled: boolean; mutedCategories: readonly string[] }, nowMs: number): boolean {
  return event.push && event.expiresAtMs > nowMs && event.pushAfterMs <= nowMs
    && preferences.pushEnabled && !preferences.mutedCategories.includes(event.category);
}

/** Leased jobs survive restarts. Provider delivery is at least once, never treated as a read receipt. */
export class NotificationWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly center: NotificationCenter;
  constructor(private readonly db: Firestore, private readonly prefix: string, private readonly sender: NotificationService, private readonly now = Date.now) {
    this.center = new NotificationCenter(db, prefix);
  }
  start() {
    if (this.timer) return;
    void this.sweep();
    this.timer = setInterval(() => void this.sweep(), 5_000);
    this.timer.unref();
  }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }
  private collection(name: string) { return this.db.collection(`${this.prefix}_${name}`); }

  private async claim(ref: DocumentReference): Promise<(DocumentData & { lease: string }) | null> {
    return this.db.runTransaction(async (transaction) => {
      const doc = await transaction.get(ref);
      if (!doc.exists || doc.data()!.availableAtMs > this.now()) return null;
      const lease = randomUUID();
      transaction.update(ref, { availableAtMs: this.now() + LEASE_MS, lease });
      return { ...doc.data()!, lease };
    });
  }
  private async finish(ref: DocumentReference, lease: string, changes: Record<string, unknown>) {
    await this.db.runTransaction(async (transaction) => {
      const doc = await transaction.get(ref);
      if (doc.data()?.lease === lease) transaction.update(ref, changes);
    });
  }

  async sweep() {
    if (this.running) return;
    this.running = true;
    try {
      for (const collection of ['notification_events', 'notification_deliveries']) {
        const jobs = await this.collection(collection).where('availableAtMs', '<=', this.now()).orderBy('availableAtMs').limit(30).get();
        for (const doc of jobs.docs) {
          const claimed = await this.claim(doc.ref);
          if (!claimed) continue;
          try {
            if (collection === 'notification_events') await this.fanout(doc.ref, claimed as FanoutJob);
            else await this.deliver(doc.ref, claimed as DeliveryJob);
          } catch {
            const attempts = Number(claimed.attempts ?? 0) + 1;
            await this.finish(doc.ref, claimed.lease, {
              attempts, state: 'retry', availableAtMs: this.now() + Math.min(60 * 60_000, 5_000 * 2 ** Math.min(attempts, 10)),
            });
            // No payload, tokens or personal information in operational logs.
            console.error(`g000st notification job failed (${collection}, attempt ${attempts}).`);
          }
        }
      }
    } catch { console.error('g000st notification sweep failed.'); }
    finally { this.running = false; }
  }

  private async fanout(ref: DocumentReference, job: FanoutJob) {
    const event = job as NotificationEvent;
    let recipients: string[];
    let cursor: string | null = null;
    if (event.audience === 'recipient') recipients = event.recipientPublicId ? [event.recipientPublicId] : [];
    else {
      let query = this.collection('users').orderBy(FieldPath.documentId()).limit(100);
      if (job.cursor) query = query.startAfter(job.cursor);
      const users = await query.get();
      recipients = users.docs.filter((doc) => doc.data().status === 'active' && !doc.data().ownerPublicId
        && (event.audience === 'all' || doc.data().role === 'admin')).map((doc) => doc.id);
      if (users.size === 100) cursor = users.docs.at(-1)!.id;
    }
    for (const publicId of recipients) {
      if (publicId === event.actorPublicId || !(await this.eligible(publicId, event))) continue;
      const id = notificationItemId(notificationGroupKey(ref.id, event), publicId);
      const itemRef = this.center.inbox(publicId, event.scope).doc(id);
      const reportSummary = event.type === 'admin.report.created' && event.pushAfterMs > event.createdAtMs;
      const deliveryId = reportSummary
        ? notificationItemId(`report-summary:${event.source?.collection}:${Math.floor(event.createdAtMs / (15 * 60_000))}`, publicId) : id;
      const deliveryRef = this.collection('notification_deliveries').doc(deliveryId);
      await this.db.runTransaction(async (transaction) => {
        const [existing, existingItem] = await transaction.getAll(deliveryRef, itemRef);
        const { lease: _lease, state: _state, availableAtMs: _available, attempts: _attempts, cursor: _cursor, ...clean } = job;
        const recipientEvent = { ...clean, recipientPublicId: publicId };
        if (event.category !== 'messages' && !existingItem!.exists) transaction.create(itemRef, { ...recipientEvent, id, readAtMs: null });
        if (!existing!.exists) {
          const { source: _source, ...summary } = recipientEvent;
          const deliveryEvent = reportSummary ? { ...summary, type: 'admin.report.summary', body: 'New reports are waiting for review.', path: event.path.split('&')[0] } : recipientEvent;
          transaction.create(deliveryRef, { event: deliveryEvent, availableAtMs: Math.max(event.pushAfterMs, this.now()), attempts: 0, state: 'pending' });
        }
      });
    }
    await this.finish(ref, job.lease, { cursor, state: cursor ? 'pending' : 'done', availableAtMs: cursor ? this.now() : FINISHED });
  }

  private async eligible(publicId: string, event: NotificationEvent): Promise<boolean> {
    if (!await contentVisibility(this.db, this.prefix, publicId).notification(event)) return false;
    const user = (await this.collection('users').doc(publicId).get()).data();
    if (!user || (user.status !== 'active' && !(user.status === 'suspended' && event.type === 'account.status_changed'))) return false;
    if (event.scope === 'admin' && (user.role !== 'admin' || user.ownerPublicId)) return false;
    if (user.ownerPublicId) {
      const owner = (await this.collection('users').doc(user.ownerPublicId).get()).data();
      if (owner?.status !== 'active') return false;
    }
    if (event.actorPublicId && event.scope !== 'admin') {
      const [blocked, reverse] = await Promise.all([
        this.collection('contacts').doc(publicId).collection('items').doc(event.actorPublicId).get(),
        this.collection('contacts').doc(event.actorPublicId).collection('items').doc(publicId).get(),
      ]);
      if (blocked.data()?.blocked || reverse.data()?.blocked) return false;
    }
    return true;
  }

  private async deliver(ref: DocumentReference, job: DeliveryJob) {
    const event = job.event as NotificationEvent;
    const publicId = event.recipientPublicId!;
    const preferences = await this.center.preferences(publicId, event.scope);
    const item = await this.center.inbox(publicId, event.scope).doc(ref.id).get();
    let send = canSendNotification(event, preferences, this.now()) && item.data()?.readAtMs == null
      && await this.eligible(publicId, event);
    if (send && event.source) {
      const sourceRef = event.source.parentId
        ? this.collection(event.source.collection).doc(event.source.parentId).collection(event.category === 'messages' ? 'messages' : 'comments').doc(event.source.id)
        : this.collection(event.source.collection).doc(event.source.id);
      const source = await sourceRef.get();
      const data = source.data();
      send = source.exists && !data?.hidden && !data?.deletedAtMs && (!data?.expiresAtMs || data.expiresAtMs > this.now());
      if (event.scope === 'admin' && event.category === 'reports' && data?.status === 'resolved') send = false;
      if (send && event.source.parentId && event.category !== 'messages') {
        const parent = await this.collection(event.source.collection).doc(event.source.parentId).get();
        send = parent.exists && !parent.data()?.hidden && !parent.data()?.deletedAtMs;
      }
      if (send && event.category === 'messages' && event.source.parentId) {
        const member = await this.collection('chat_members').doc(publicId).collection('conversations').doc(event.source.parentId).get();
        const summary = member.data();
        if (summary?.lastReadAtMs > event.createdAtMs || (summary?.lastReadAtMs === event.createdAtMs && summary?.lastReadMessageId >= event.source.id)) send = false;
      }
    }
    if (send && event.type === 'social.followed' && event.actorPublicId) {
      const relationship = await this.collection('social_camps').doc(event.actorPublicId).collection('targets').doc(publicId).get();
      send = relationship.exists;
    }
    if (send) await this.sender.sendTo(publicId, {
      title: event.title, body: event.body, expiresAtMs: event.expiresAtMs,
      data: { type: event.type, notificationId: ref.id, recipientPublicId: publicId, path: event.path,
        ...(event.category === 'messages' && event.source?.parentId ? { conversationId: event.source.parentId } : {}) },
    });
    await this.finish(ref, job.lease, { state: send ? 'sent' : 'suppressed', availableAtMs: FINISHED });
  }
}
