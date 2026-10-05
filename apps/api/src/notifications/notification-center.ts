import { contentVisibility, visibleDocuments } from '../social/content-visibility.js';
import { FieldPath, type Firestore } from 'firebase-admin/firestore';
import { ApiError } from '../http/api-error.js';
import type { InboxNotification, NotificationPreferences, NotificationScope } from './notification-types.js';

export const defaultNotificationPreferences: NotificationPreferences = { pushEnabled: true, mutedCategories: [] };

export class NotificationCenter {
  constructor(private readonly db: Firestore, private readonly prefix: string) {}

  inbox(publicId: string, scope: NotificationScope) {
    return this.db.collection(`${this.prefix}_notification_inboxes`).doc(`${scope}_${publicId}`).collection('items');
  }

  async list(publicId: string, scope: NotificationScope, limit: number, cursor?: string) {
    let query = this.inbox(publicId, scope).orderBy('createdAtMs', 'desc').orderBy(FieldPath.documentId(), 'desc');
    if (cursor) {
      let parsed: { time: number; id: string };
      try {
        parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
        if (!Number.isSafeInteger(parsed.time) || !/^[a-f0-9]{64}$/.test(parsed.id)) throw new Error();
      } catch { throw new ApiError(400, 'INVALID_CURSOR', 'Invalid notification cursor.'); }
      query = query.startAfter(parsed.time, parsed.id);
    }
    const visibility = contentVisibility(this.db, this.prefix, publicId);
    const [visible, unread] = await Promise.all([
      visibleDocuments(query, limit, (doc) => visibility.notification(doc.data())),
      this.inbox(publicId, scope).where('readAtMs', '==', null).get(),
    ]);
    const unreadVisibility = await Promise.all(unread.docs.map((doc) => visibility.notification(doc.data())));
    const docs = visible.slice(0, limit);
    const last = docs.at(-1);
    // Do not expose internal audience, actor identifiers, source paths or delivery metadata.
    const items = docs.map((doc) => {
      const data = doc.data() as InboxNotification;
      return { id: doc.id, type: data.type, category: data.category, title: data.title, body: data.body,
        path: data.path, createdAtMs: data.createdAtMs, expiresAtMs: data.expiresAtMs, readAtMs: data.readAtMs };
    });
    return { version: 1 as const, items, unreadCount: unreadVisibility.filter(Boolean).length,
      ...(visible.length > limit && last ? { nextCursor: Buffer.from(JSON.stringify({ time: last.data().createdAtMs, id: last.id })).toString('base64url') } : {}) };
  }

  async markRead(publicId: string, scope: NotificationScope, ids: readonly string[], nowMs: number) {
    await this.db.runTransaction(async (transaction) => {
      const refs = ids.map((id) => this.inbox(publicId, scope).doc(id));
      if (!refs.length) return;
      const docs = await transaction.getAll(...refs);
      docs.forEach((doc) => { if (doc.exists && doc.data()?.readAtMs == null) transaction.update(doc.ref, { readAtMs: nowMs }); });
    });
  }

  async preferences(publicId: string, scope: NotificationScope): Promise<NotificationPreferences> {
    const doc = await this.db.collection(`${this.prefix}_notification_preferences`).doc(`${scope}_${publicId}`).get();
    return doc.exists ? doc.data() as NotificationPreferences : defaultNotificationPreferences;
  }

  async setPreferences(publicId: string, scope: NotificationScope, value: NotificationPreferences) {
    await this.db.collection(`${this.prefix}_notification_preferences`).doc(`${scope}_${publicId}`).set(value);
  }
}
