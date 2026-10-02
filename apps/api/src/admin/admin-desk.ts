import { queueNotification } from '../notifications/notification-events.js';
import { randomUUID } from 'node:crypto';
import { FieldPath, type Firestore, type QueryDocumentSnapshot, type WriteBatch } from 'firebase-admin/firestore';

import { ApiError } from '../http/api-error.js';
import { recentGeography } from '../presence/presence-geography.js';

export const ADMIN_PAGES = [
  ['site', 'Whole website'], ['login', 'Login / paste ID'], ['mypage', 'My Page'],
  ['centre', 'g000st centre'], ['network', 'Network'], ['whisper', 'Whisper'],
  ['trading', 'g000st trading'], ['mobile', 'g000st mobile'],
] as const;

export const ADMIN_PARTS = [
  ['mypage.cover', 'My Page · cover photo'], ['mypage.avatar', 'My Page · avatar'],
  ['mypage.id', 'My Page · ID box'], ['mypage.profile', 'My Page · profile fields'],
  ['mypage.showname', 'My Page · show my name'], ['centre.composer', 'Centre · composer'],
  ['centre.feed', 'Centre · feed'], ['centre.whisper', 'Centre · whisper button'],
  ['network.search', 'Network · FIND'], ['network.list', 'Network · ghost list'],
  ['whisper.chat', 'Whisper · chat'], ['whisper.call', 'Whisper · call'],
  ['trading.list', 'Trading · listings'], ['trading.sell', 'Trading · sell form'],
  ['mobile.dial', 'Mobile · keypad'], ['mobile.sms', 'Mobile · SMS'],
  ['mobile.buy', 'Mobile · buy plans'],
] as const;

type Section = 'social' | 'market';
type AdminMessageInput = Readonly<{ to: string; text: string; type: 'msg' | 'warning' }>;

export class AdminDeskService {
  constructor(private readonly db: Firestore, private readonly prefix: string, private readonly now: () => number = Date.now) {}

  private collection(name: string) { return this.db.collection(`${this.prefix}_${name}`); }
  private postCollection(section: Section) { return this.collection(section === 'social' ? 'social_posts' : 'market_posts'); }

  private encodeUserCursor(document: QueryDocumentSnapshot): string {
    return Buffer.from(JSON.stringify({ createdAtMs: Number(document.data().createdAtMs ?? 0), id: document.id })).toString('base64url');
  }

  private decodeUserCursor(cursor: string): { createdAtMs: number; id: string } {
    try {
      const decoded: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
      if (decoded && typeof decoded === 'object' && 'createdAtMs' in decoded && 'id' in decoded
        && typeof decoded.createdAtMs === 'number' && Number.isSafeInteger(decoded.createdAtMs)
        && typeof decoded.id === 'string' && /^[A-Za-z0-9]{50}$/.test(decoded.id)) {
        return { createdAtMs: decoded.createdAtMs, id: decoded.id };
      }
    } catch { /* Invalid cursor. */ }
    throw new ApiError(400, 'INVALID_CURSOR', 'Invalid users cursor.');
  }

  private async hydrateUsers(documents: readonly QueryDocumentSnapshot[]) {
    if (!documents.length) return [];
    const [profiles, presence] = await Promise.all([
      this.db.getAll(...documents.map((document) => this.collection('social_profiles').doc(document.id))),
      this.db.getAll(...documents.map((document) => this.collection('presence').doc(document.id))),
    ]);
    return documents.map((document, index) => ({
      publicId: document.id,
      displayName: String(profiles[index]?.data()?.displayName ?? ''),
      status: String(document.data().status ?? 'active'),
      role: String(document.data().role ?? 'user'),
      createdAtMs: Number(document.data().createdAtMs ?? 0),
      lastActiveAtMs: Number(presence[index]?.data()?.lastActiveAtMs ?? 0),
      geography: recentGeography(presence[index]?.data(), this.now()) ?? null,
    }));
  }

  async listUsers(limit: number, cursor?: string) {
    let query = this.collection('users').orderBy('createdAtMs', 'desc').orderBy(FieldPath.documentId(), 'desc');
    if (cursor) {
      const decoded = this.decodeUserCursor(cursor);
      query = query.startAfter(decoded.createdAtMs, decoded.id);
    }
    const visible: QueryDocumentSnapshot[] = [];
    let last: QueryDocumentSnapshot | undefined;
    while (visible.length <= limit) {
      const snapshot = await query.limit(Math.max(51, limit + 1)).get();
      if (snapshot.empty) break;
      for (const document of snapshot.docs) {
        last = document;
        if (!document.data().ownerPublicId && document.data().status !== 'deleted') visible.push(document);
        if (visible.length > limit) break;
      }
      if (visible.length > limit) break;
      if (snapshot.size < Math.max(51, limit + 1)) break;
      query = query.startAfter(last!.data().createdAtMs, last!.id);
    }
    const page = visible.slice(0, limit);
    const lastVisible = page.at(-1);
    return { version: 1 as const, users: await this.hydrateUsers(page), ...(visible.length > limit && lastVisible ? { nextCursor: this.encodeUserCursor(lastVisible) } : {}) };
  }

  async listSearchedUsers(limit: number, search: string, cursor?: string) {
    const needle = search.trim().toLowerCase();
    const after = cursor ? this.decodeUserCursor(cursor) : undefined;
    const [users, profiles] = await Promise.all([
      this.collection('users').select('createdAtMs', 'ownerPublicId', 'status', 'role').get(),
      this.collection('social_profiles').select('displayName').get(),
    ]);
    const names = new Map(profiles.docs.map((doc) => [doc.id, String(doc.data().displayName ?? '')]));
    const matches = users.docs
      .filter((doc) => !doc.data().ownerPublicId && doc.data().status !== 'deleted')
      .filter((doc) => doc.id.toLowerCase().includes(needle) || (names.get(doc.id) ?? '').toLowerCase().includes(needle))
      .sort((a, b) => Number(b.data().createdAtMs ?? 0) - Number(a.data().createdAtMs ?? 0) || b.id.localeCompare(a.id))
      .filter((doc) => !after || Number(doc.data().createdAtMs ?? 0) < after.createdAtMs
        || (Number(doc.data().createdAtMs ?? 0) === after.createdAtMs && doc.id < after.id));
    const page = matches.slice(0, limit);
    const last = page.at(-1);
    return { version: 1 as const, users: await this.hydrateUsers(page), ...(matches.length > limit && last ? { nextCursor: this.encodeUserCursor(last) } : {}) };
  }

  async listPosts(section: Section, limit: number, cursor?: string) {
    let query = this.postCollection(section).orderBy('createdAtMs', 'desc').orderBy(FieldPath.documentId(), 'desc');
    if (cursor) {
      try {
        const decoded: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
        if (!decoded || typeof decoded !== 'object' || !('section' in decoded) || decoded.section !== section
          || !('createdAtMs' in decoded) || typeof decoded.createdAtMs !== 'number' || !Number.isSafeInteger(decoded.createdAtMs)
          || !('id' in decoded) || typeof decoded.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(decoded.id)) throw new Error('Invalid');
        query = query.startAfter(decoded.createdAtMs, decoded.id);
      } catch { throw new ApiError(400, 'INVALID_CURSOR', 'Invalid posts cursor.'); }
    }
    const visible: QueryDocumentSnapshot[] = [];
    let last: QueryDocumentSnapshot | undefined;
    const batchSize = Math.max(51, limit + 1);
    while (visible.length <= limit) {
      const snapshot = await query.limit(batchSize).get();
      if (snapshot.empty) break;
      for (const document of snapshot.docs) {
        last = document;
        if (!document.data().deletedAtMs) visible.push(document);
        if (visible.length > limit) break;
      }
      if (visible.length > limit || snapshot.size < batchSize) break;
      query = query.startAfter(last!.data().createdAtMs, last!.id);
    }
    const page = visible.slice(0, limit);
    const lastVisible = page.at(-1);
    return {
      version: 1 as const,
      items: page.map((doc) => ({
        id: doc.id, ownerPublicId: String(doc.data().ownerPublicId ?? ''), content: String(doc.data().content ?? ''),
        city: section === 'market' ? String(doc.data().city ?? '') : undefined,
        hidden: doc.data().hidden === true, deleted: false, createdAtMs: Number(doc.data().createdAtMs ?? 0),
      })),
      ...(visible.length > limit && lastVisible ? { nextCursor: Buffer.from(JSON.stringify({ section, createdAtMs: lastVisible.data().createdAtMs, id: lastVisible.id })).toString('base64url') } : {}),
    };
  }

  async getRecentBillingBalances() {
    const [recent, count] = await Promise.all([
      this.collection('billing_balances').orderBy('updatedAtMs', 'desc').limit(30).get(),
      this.collection('billing_balances').count().get(),
    ]);
    return {
      version: 1 as const,
      accountCount: count.data().count,
      balances: recent.docs.map((document) => ({
        publicId: document.id,
        voiceSecondsRemaining: Number(document.data().voiceSecondsRemaining ?? 0),
        smsRemaining: Number(document.data().smsRemaining ?? 0),
        updatedAtMs: Number(document.data().updatedAtMs ?? 0),
      })),
    };
  }

  private async commit(actor: string, action: string, target: string, write: (batch: WriteBatch) => void): Promise<void> {
    const batch = this.db.batch();
    write(batch);
    batch.create(this.collection('admin_audit').doc(randomUUID()), { actor, action, target, createdAtMs: this.now() });
    await batch.commit();
  }

  async listReports(section: Section, cursor?: string, reportId?: string) {
    let query = this.collection(`${section}_reports`).orderBy('createdAtMs', 'desc').orderBy(FieldPath.documentId(), 'desc');
    if (cursor) {
      try {
        const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
        if (!Number.isSafeInteger(value.time) || typeof value.id !== 'string' || !/^[a-f0-9-]{36}$/.test(value.id)) throw new Error();
        query = query.startAfter(value.time, value.id);
      } catch { throw new ApiError(400, 'INVALID_CURSOR', 'Invalid report cursor.'); }
    }
    const snapshot = await query.limit(31).get();
    const docs = snapshot.docs.slice(0, 30);
    const last = docs.at(-1);
    const selected = reportId ? await this.collection(`${section}_reports`).doc(reportId).get() : null;
    return { version: 1, items: docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      ...(selected?.exists ? { selected: { id: selected.id, ...selected.data() } } : {}),
      ...(snapshot.size > 30 && last ? { nextCursor: Buffer.from(JSON.stringify({ time: last.data().createdAtMs, id: last.id })).toString('base64url') } : {}) };
  }

  async resolveReport(section: Section, id: string, resolution: 'action_taken' | 'no_violation', actor: string) {
    const ref = this.collection(`${section}_reports`).doc(id);
    await this.db.runTransaction(async (transaction) => {
      const doc = await transaction.get(ref);
      if (!doc.exists) throw new ApiError(404, 'REPORT_NOT_FOUND', 'Report not found.');
      if (doc.data()?.status === 'resolved') return;
      const nowMs = this.now();
      transaction.update(ref, { status: 'resolved', resolution, resolvedAtMs: nowMs, resolvedBy: actor });
      transaction.create(this.collection('admin_audit').doc(randomUUID()), { actor, action: 'report.resolve', target: id, createdAtMs: nowMs });
      queueNotification(this.db, this.prefix, transaction, { type: 'report.resolved', audience: 'recipient',
        recipientPublicId: doc.data()!.reporterPublicId, scope: 'user', category: 'reports', title: 'Report reviewed',
        body: resolution === 'action_taken' ? 'Your report was reviewed and action was taken.' : 'Your report was reviewed. No violation was found.',
        path: '/notifications', createdAtMs: nowMs, push: false });
    });
  }

  async getExperienceConfig() {
    const config = (await this.collection('admin_config').doc('desk').get()).data();
    return {
      version: 1 as const,
      pages: Object.fromEntries(ADMIN_PAGES.map(([key]) => [key, config?.pages?.[key] !== false])),
      parts: Object.fromEntries(ADMIN_PARTS.map(([key]) => [key, config?.parts?.[key] !== false])),
    };
  }

  async get() {
    const [users, posts, listings, config, messages, inbox, issued, openInboxCount] = await Promise.all([
      this.collection('users').orderBy('createdAtMs', 'desc').limit(100).get(),
      this.collection('social_posts').orderBy('createdAtMs', 'desc').limit(40).get(),
      this.collection('market_posts').orderBy('createdAtMs', 'desc').limit(40).get(),
      this.collection('admin_config').doc('desk').get(),
      this.collection('admin_messages').orderBy('createdAtMs', 'desc').limit(16).get(),
      this.collection('support_inbox').orderBy('createdAtMs', 'desc').limit(30).get(),
      this.collection('admin_issued_accounts').orderBy('createdAtMs', 'desc').limit(30).get(),
      this.collection('support_inbox').where('status', '==', 'open').count().get(),
    ]);
    const actualUsers = users.docs.filter((doc) => !doc.data().ownerPublicId && doc.data().status !== 'deleted').slice(0, 40);
    const profiles = actualUsers.length
      ? await this.db.getAll(...actualUsers.map((doc) => this.collection('social_profiles').doc(doc.id)))
      : [];
    return {
      version: 1 as const,
      openInboxCount: openInboxCount.data().count,
      users: actualUsers.map((doc, index) => ({
        publicId: doc.id,
        displayName: String(profiles[index]?.data()?.displayName ?? ''),
        status: String(doc.data().status ?? 'active'),
        role: String(doc.data().role ?? 'user'),
        createdAtMs: Number(doc.data().createdAtMs ?? 0),
      })),
      posts: posts.docs.map((doc) => ({ id: doc.id, ownerPublicId: String(doc.data().ownerPublicId ?? ''), content: String(doc.data().content ?? ''), hidden: doc.data().hidden === true, deleted: !!doc.data().deletedAtMs, createdAtMs: Number(doc.data().createdAtMs ?? 0) })),
      listings: listings.docs.map((doc) => ({ id: doc.id, ownerPublicId: String(doc.data().ownerPublicId ?? ''), content: String(doc.data().content ?? ''), city: String(doc.data().city ?? ''), hidden: doc.data().hidden === true, deleted: !!doc.data().deletedAtMs, createdAtMs: Number(doc.data().createdAtMs ?? 0) })),
      config: {
        pages: Object.fromEntries(ADMIN_PAGES.map(([key]) => [key, config.data()?.pages?.[key] !== false])),
        parts: Object.fromEntries(ADMIN_PARTS.map(([key]) => [key, config.data()?.parts?.[key] !== false])),
        labels: Object.fromEntries([...ADMIN_PAGES, ...ADMIN_PARTS].map(([key, fallback]) => [key, String(config.data()?.labels?.[key] ?? fallback)])),
      },
      messages: messages.docs.map((doc) => ({ id: doc.id, to: String(doc.data().to ?? ''), text: String(doc.data().text ?? ''), type: String(doc.data().type ?? 'msg'), createdAtMs: Number(doc.data().createdAtMs ?? 0) })),
      inbox: inbox.docs.map((doc) => ({ id: doc.id, from: String(doc.data().from ?? ''), text: String(doc.data().text ?? ''), status: String(doc.data().status ?? 'open'), createdAtMs: Number(doc.data().createdAtMs ?? 0) })),
      issued: issued.docs.map((doc) => ({ publicId: doc.id, note: String(doc.data().note ?? ''), createdAtMs: Number(doc.data().createdAtMs ?? 0) })),
    };
  }

  async searchUsers(query: string) {
    if (!query.trim()) return [];
    return (await this.listSearchedUsers(40, query)).users;
  }

  async recordIssuedAccount(publicId: string, note: string, actor: string): Promise<void> {
    await this.commit(actor, 'account.issue', publicId, (batch) => {
      batch.create(this.collection('admin_issued_accounts').doc(publicId), { note, createdAtMs: this.now(), actor });
    });
  }

  async setFlag(kind: 'pages' | 'parts', key: string, enabled: boolean, actor: string): Promise<boolean> {
    const allowed = kind === 'pages' ? ADMIN_PAGES : ADMIN_PARTS;
    if (!allowed.some(([candidate]) => candidate === key)) throw new ApiError(400, 'UNKNOWN_FLAG', 'Unknown control.');
    await this.commit(actor, `config.${kind}`, key, (batch) => {
      batch.set(this.collection('admin_config').doc('desk'), { [kind]: { [key]: enabled } }, { merge: true });
    });
    return enabled;
  }

  async setLabel(kind: 'pages' | 'parts', key: string, label: string, actor: string): Promise<void> {
    const allowed = kind === 'pages' ? ADMIN_PAGES : ADMIN_PARTS;
    if (!allowed.some(([candidate]) => candidate === key)) throw new ApiError(400, 'UNKNOWN_FLAG', 'Unknown control.');
    await this.commit(actor, `config.${kind}.label`, key, (batch) => {
      batch.set(this.collection('admin_config').doc('desk'), { labels: { [key]: label } }, { merge: true });
    });
  }

  async setUserStatus(publicId: string, status: 'active' | 'suspended', actor: string): Promise<void> {
    const ref = this.collection('users').doc(publicId);
    const user = await ref.get();
    if (!user.exists || user.data()?.status === 'deleted' || user.data()?.ownerPublicId) throw new ApiError(404, 'USER_NOT_FOUND', 'Account not found.');
    if (publicId === actor || user.data()?.role === 'admin') throw new ApiError(403, 'ADMIN_PROTECTED', 'Administrator accounts cannot be suspended here.');
    if (user.data()?.status === status) return;
    await this.commit(actor, `user.${status}`, publicId, (batch) => {
      batch.update(ref, { status });
      queueNotification(this.db, this.prefix, batch, { type: 'account.status_changed', audience: 'recipient',
        recipientPublicId: publicId, scope: 'user', category: 'administration', title: 'Account status changed',
        body: status === 'suspended' ? 'Your account was suspended. Contact support for details.' : 'Your account was reactivated.',
        path: '/notifications', createdAtMs: this.now() });
    });
  }

  async setDisplayName(publicId: string, displayName: string, actor: string): Promise<void> {
    const user = await this.collection('users').doc(publicId).get();
    if (!user.exists || user.data()?.status === 'deleted') throw new ApiError(404, 'USER_NOT_FOUND', 'Account not found.');
    await this.commit(actor, 'user.rename', publicId, (batch) => {
      batch.set(this.collection('social_profiles').doc(publicId), { displayName, showDisplayName: true, updatedAtMs: this.now() }, { merge: true });
    });
  }

  async setPostHidden(section: Section, postId: string, hidden: boolean, actor: string): Promise<void> {
    const ref = this.postCollection(section).doc(postId);
    if (!(await ref.get()).exists) throw new ApiError(404, 'POST_NOT_FOUND', 'Post not found.');
    const post = (await ref.get()).data()!;
    await this.commit(actor, `${section}.${hidden ? 'hide' : 'show'}`, postId, (batch) => {
      batch.update(ref, { hidden, updatedAtMs: this.now() });
      queueNotification(this.db, this.prefix, batch, { type: 'moderation.content_action', audience: 'recipient',
        recipientPublicId: post.ownerPublicId, scope: 'user', category: 'administration', title: 'Content visibility changed',
        body: hidden ? 'The administration hid your content. Contact support for details.' : 'The administration restored your content.',
        path: '/notifications', createdAtMs: this.now() });
    });
  }

  async setPostContent(postId: string, content: string, actor: string): Promise<void> {
    const ref = this.postCollection('social').doc(postId);
    if (!(await ref.get()).exists) throw new ApiError(404, 'POST_NOT_FOUND', 'Post not found.');
    const post = (await ref.get()).data()!;
    await this.commit(actor, 'social.edit', postId, (batch) => {
      batch.update(ref, { content, editedAtMs: this.now(), updatedAtMs: this.now() });
      queueNotification(this.db, this.prefix, batch, { type: 'moderation.content_action', audience: 'recipient',
        recipientPublicId: post.ownerPublicId, scope: 'user', category: 'administration', title: 'Content updated',
        body: 'The administration updated your content. Contact support for details.', path: '/notifications', createdAtMs: this.now() });
    });
  }

  async deletePost(section: Section, postId: string, actor: string): Promise<void> {
    const ref = this.postCollection(section).doc(postId);
    if (!(await ref.get()).exists) throw new ApiError(404, 'POST_NOT_FOUND', 'Post not found.');
    const post = (await ref.get()).data()!;
    await this.commit(actor, `${section}.delete`, postId, (batch) => {
      batch.update(ref, { hidden: true, deletedAtMs: this.now(), updatedAtMs: this.now() });
      queueNotification(this.db, this.prefix, batch, { type: 'moderation.content_action', audience: 'recipient',
        recipientPublicId: post.ownerPublicId, scope: 'user', category: 'administration', title: 'Content removed',
        body: 'The administration removed your content. Contact support for details.', path: '/notifications', createdAtMs: this.now() });
    });
  }

  async sendMessage(input: AdminMessageInput, actor: string) {
    if (input.to !== 'all' && !(await this.collection('users').doc(input.to).get()).exists) throw new ApiError(404, 'USER_NOT_FOUND', 'Account not found.');
    const id = randomUUID();
    const message = { id, ...input, createdAtMs: this.now(), from: actor };
    await this.commit(actor, `message.${input.type}`, input.to, (batch) => {
      batch.create(this.collection('admin_messages').doc(id), message);
      queueNotification(this.db, this.prefix, batch, { type: input.to === 'all' ? 'admin.announcement' : 'admin.message', audience: input.to === 'all' ? 'all' : 'recipient', recipientPublicId: input.to, scope: "user", category: "administration", title: "Message from g000st", body: "You have a new message from the administration.", path: `/notifications?noticeId=${id}`, createdAtMs: message.createdAtMs, push: input.to !== 'all' || input.type === 'warning', source: { collection: 'admin_messages', id } });
    });
    return message;
  }

  async deleteMessage(id: string, actor: string): Promise<void> {
    await this.commit(actor, 'message.delete', id, (batch) => batch.delete(this.collection('admin_messages').doc(id)));
  }

  async replyToInbox(id: string, text: string, actor: string): Promise<void> {
    const ref = this.collection('support_inbox').doc(id);
    await this.db.runTransaction(async (transaction) => {
      const message = await transaction.get(ref);
      const from = message.data()?.from;
      if (!message.exists || typeof from !== 'string') throw new ApiError(404, 'MESSAGE_NOT_FOUND', 'Contact message not found.');
      if (message.data()?.status === 'replied') throw new ApiError(409, 'ALREADY_REPLIED', 'This message was already answered.');
      const noticeId = randomUUID();
      transaction.create(this.collection('admin_messages').doc(noticeId), { id: noticeId, to: from, text, type: 'msg', from: actor, createdAtMs: this.now() });
      queueNotification(this.db, this.prefix, transaction, { type: "support.replied", audience: "recipient", recipientPublicId: from, scope: "user", category: "support", title: "Support replied", body: "The support team replied to your request.", path: `/notifications?noticeId=${noticeId}`, createdAtMs: this.now(), source: { collection: 'admin_messages', id: noticeId } });
      transaction.update(ref, { status: 'replied', repliedAtMs: this.now() });
      transaction.create(this.collection('admin_audit').doc(randomUUID()), { actor, action: 'inbox.reply', target: id, createdAtMs: this.now() });
    });
  }

  async createSupportMessage(from: string, text: string): Promise<void> {
    const user = await this.collection('users').doc(from).get();
    if (!user.exists || user.data()?.status !== 'active') throw new ApiError(403, 'ACCOUNT_UNAVAILABLE', 'Account is unavailable.');
    const id = randomUUID();
    const createdAtMs = this.now();
    const batch = this.db.batch();
    batch.create(this.collection('support_inbox').doc(id), { from, text, status: 'open', createdAtMs });
    queueNotification(this.db, this.prefix, batch, { type: "admin.support.created", audience: "admins", scope: "admin", category: "support", title: "New support request", body: "A user contacted support.", path: "/client-desk", createdAtMs: createdAtMs, push: false, source: { collection: 'support_inbox', id } });
    await batch.commit();
  }

  async listNotices(publicId: string) {
    const [personal, global] = await Promise.all([
      this.collection('admin_messages').where('to', '==', publicId).limit(30).get(),
      this.collection('admin_messages').where('to', '==', 'all').limit(30).get(),
    ]);
    return [...personal.docs, ...global.docs]
      .sort((a, b) => Number(b.data().createdAtMs ?? 0) - Number(a.data().createdAtMs ?? 0))
      .slice(0, 20)
      .map((doc) => ({ id: doc.id, text: String(doc.data().text ?? ''), type: doc.data().type === 'warning' ? 'warning' as const : 'msg' as const, createdAtMs: Number(doc.data().createdAtMs ?? 0) }));
  }

  async getNotice(publicId: string, id: string) {
    const doc = await this.collection('admin_messages').doc(id).get();
    const data = doc.data();
    if (!doc.exists || (data?.to !== publicId && data?.to !== 'all')) throw new ApiError(404, 'NOTICE_NOT_FOUND', 'Message is unavailable.');
    return { id: doc.id, text: String(data.text ?? ''), type: data.type === 'warning' ? 'warning' as const : 'msg' as const, createdAtMs: Number(data.createdAtMs ?? 0) };
  }
}
