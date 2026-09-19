import { randomUUID } from 'node:crypto';

import { FieldPath, FieldValue, type DocumentData, type Firestore } from 'firebase-admin/firestore';

import { encodeSocialCursor, type SocialCursor } from './social-cursor.js';
import type { SocialStore } from './social-store.js';
import type {
  CreateSocialCommentInput,
  CreateSocialPostInput,
  CreateSocialReportInput,
  SocialMedia,
  SocialAlert,
  SocialAuthor,
  SocialComment,
  SocialPage,
  SocialPost,
  SocialProfile,
  UpdateSocialProfileInput,
} from './social-types.js';

type StoredPost = Readonly<{
  ownerPublicId: string;
  content: string;
  media?: readonly SocialMedia[];
  visibility: 'anonymous' | 'public';
  createdAtMs: number;
  updatedAtMs: number;
  editedAtMs?: number;
  likeCount: number;
  commentCount: number;
}>;

type StoredComment = Readonly<{
  ownerPublicId: string;
  content: string;
  visibility: 'anonymous' | 'public';
  createdAtMs: number;
}>;

export class FirestoreSocialStore implements SocialStore {
  constructor(private readonly db: Firestore, private readonly prefix: string) {}

  async listPosts(viewerId: string, limit: number, cursor?: SocialCursor, ownerId?: string): Promise<SocialPage<SocialPost>> {
    let query = this.posts().orderBy('createdAtMs', 'desc').orderBy(FieldPath.documentId(), 'desc');
    if (ownerId) query = query.where('ownerPublicId', '==', ownerId);
    if (cursor) query = query.startAfter(cursor.createdAtMs, cursor.id);
    const snapshot = await query.limit(limit + 1).get();
    const documents = snapshot.docs.slice(0, limit);
    const items = await Promise.all(documents.map((document) => this.toPost(viewerId, document.id, document.data() as StoredPost)));
    const last = documents.at(-1);
    return {
      items,
      ...(snapshot.size > limit && last
        ? { nextCursor: encodeSocialCursor({ createdAtMs: (last.data() as StoredPost).createdAtMs, id: last.id }) }
        : {}),
    };
  }

  async findPost(viewerId: string, postId: string): Promise<SocialPost | null> {
    const snapshot = await this.posts().doc(postId).get();
    return snapshot.exists ? this.toPost(viewerId, snapshot.id, snapshot.data() as StoredPost) : null;
  }

  async createPost(ownerId: string, id: string, input: Omit<CreateSocialPostInput, 'media'> & { media?: readonly SocialMedia[] }, nowMs: number): Promise<SocialPost> {
    const post: StoredPost = { ...input, ownerPublicId: ownerId, createdAtMs: nowMs, updatedAtMs: nowMs, likeCount: 0, commentCount: 0 };
    const reference = this.posts().doc(id);
    const stored = await this.db.runTransaction(async (transaction) => {
      const existing = await transaction.get(reference);
      if (existing.exists) return existing.data() as StoredPost;
      transaction.create(reference, post);
      return post;
    });
    return this.toPost(ownerId, id, stored);
  }

  async updatePost(viewerId: string, postId: string, content: string, nowMs: number): Promise<SocialPost | null> {
    const reference = this.posts().doc(postId);
    const updated = await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) return null;
      const post = snapshot.data() as StoredPost;
      if (post.ownerPublicId !== viewerId) return null;
      const next = { ...post, content, editedAtMs: nowMs, updatedAtMs: nowMs };
      transaction.set(reference, next);
      return next;
    });
    return updated ? this.toPost(viewerId, postId, updated) : null;
  }

  async deletePost(viewerId: string, postId: string): Promise<boolean> {
    const reference = this.posts().doc(postId);
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists || (snapshot.data() as StoredPost).ownerPublicId !== viewerId) return false;
      transaction.delete(reference);
      return true;
    });
  }

  async toggleLike(viewerId: string, postId: string, nowMs: number): Promise<{ liked: boolean; likeCount: number } | null> {
    const postRef = this.posts().doc(postId);
    const reactionRef = this.reactions(postId).doc(viewerId);
    return this.db.runTransaction(async (transaction) => {
      const [postSnapshot, reactionSnapshot] = await Promise.all([transaction.get(postRef), transaction.get(reactionRef)]);
      if (!postSnapshot.exists) return null;
      const post = postSnapshot.data() as StoredPost;
      const liked = !reactionSnapshot.exists;
      const likeCount = Math.max(0, post.likeCount + (liked ? 1 : -1));
      transaction.update(postRef, { likeCount, updatedAtMs: nowMs });
      if (liked) transaction.create(reactionRef, { createdAtMs: nowMs });
      else transaction.delete(reactionRef);
      if (liked && post.ownerPublicId !== viewerId) {
        transaction.create(this.alerts(post.ownerPublicId).doc(randomUUID()), { actorPublicId: viewerId, createdAtMs: nowMs, kind: 'like', postId, readAtMs: null });
      }
      return { liked, likeCount };
    });
  }

  async listComments(viewerId: string, postId: string, limit: number, cursor?: SocialCursor): Promise<SocialPage<SocialComment> | null> {
    if (!(await this.posts().doc(postId).get()).exists) return null;
    let query = this.comments(postId).orderBy('createdAtMs', 'asc').orderBy(FieldPath.documentId(), 'asc');
    if (cursor) query = query.startAfter(cursor.createdAtMs, cursor.id);
    const snapshot = await query.limit(limit + 1).get();
    const documents = snapshot.docs.slice(0, limit);
    const items = await Promise.all(documents.map((document) => this.toComment(viewerId, postId, document.id, document.data() as StoredComment)));
    const last = documents.at(-1);
    return { items, ...(snapshot.size > limit && last ? { nextCursor: encodeSocialCursor({ createdAtMs: (last.data() as StoredComment).createdAtMs, id: last.id }) } : {}) };
  }

  async createComment(viewerId: string, postId: string, input: CreateSocialCommentInput, nowMs: number): Promise<SocialComment | null> {
    const postRef = this.posts().doc(postId);
    const id = randomUUID();
    const comment: StoredComment = { ...input, ownerPublicId: viewerId, createdAtMs: nowMs };
    const created = await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(postRef);
      if (!snapshot.exists) return false;
      const post = snapshot.data() as StoredPost;
      transaction.create(this.comments(postId).doc(id), comment);
      transaction.update(postRef, { commentCount: FieldValue.increment(1), updatedAtMs: nowMs });
      if (post.ownerPublicId !== viewerId) transaction.create(this.alerts(post.ownerPublicId).doc(randomUUID()), { actorPublicId: viewerId, commentId: id, createdAtMs: nowMs, kind: 'comment', postId, readAtMs: null });
      return true;
    });
    return created ? this.toComment(viewerId, postId, id, comment) : null;
  }

  async deleteComment(viewerId: string, postId: string, commentId: string): Promise<boolean> {
    const postRef = this.posts().doc(postId);
    const commentRef = this.comments(postId).doc(commentId);
    return this.db.runTransaction(async (transaction) => {
      const [postSnapshot, commentSnapshot] = await Promise.all([transaction.get(postRef), transaction.get(commentRef)]);
      if (!postSnapshot.exists || !commentSnapshot.exists || (commentSnapshot.data() as StoredComment).ownerPublicId !== viewerId) return false;
      transaction.delete(commentRef);
      transaction.update(postRef, { commentCount: FieldValue.increment(-1) });
      return true;
    });
  }

  async toggleCamp(viewerId: string, targetId: string, nowMs: number): Promise<{ camped: boolean }> {
    const reference = this.camps(viewerId).doc(targetId);
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      const camped = !snapshot.exists;
      if (camped) {
        transaction.create(reference, { createdAtMs: nowMs });
        transaction.create(this.alerts(targetId).doc(randomUUID()), { actorPublicId: viewerId, createdAtMs: nowMs, kind: 'camp', readAtMs: null });
      } else transaction.delete(reference);
      return { camped };
    });
  }

  async getProfile(viewerId: string, publicId: string): Promise<(SocialProfile & { campedByViewer: boolean }) | null> {
    const [profile, camp] = await Promise.all([this.profiles().doc(publicId).get(), this.camps(viewerId).doc(publicId).get()]);
    if (!profile.exists && viewerId !== publicId) return null;
    return { publicId, ...(profile.data() as Omit<SocialProfile, 'publicId'> | undefined), updatedAtMs: (profile.data()?.updatedAtMs as number | undefined) ?? 0, campedByViewer: camp.exists };
  }

  async updateProfile(publicId: string, input: UpdateSocialProfileInput, nowMs: number): Promise<SocialProfile> {
    const profile = { ...input, updatedAtMs: nowMs };
    await this.profiles().doc(publicId).set(profile, { merge: true });
    return { publicId, ...profile };
  }

  async listAlerts(publicId: string, limit: number, cursor?: SocialCursor): Promise<SocialPage<SocialAlert>> {
    let query = this.alerts(publicId).orderBy('createdAtMs', 'desc').orderBy(FieldPath.documentId(), 'desc');
    if (cursor) query = query.startAfter(cursor.createdAtMs, cursor.id);
    const snapshot = await query.limit(limit + 1).get();
    const documents = snapshot.docs.slice(0, limit);
    const items = await Promise.all(documents.map(async (document) => {
      const data = document.data();
      return { id: document.id, kind: data.kind, actor: await this.author(data.actorPublicId, true), ...(data.postId ? { postId: data.postId } : {}), ...(data.commentId ? { commentId: data.commentId } : {}), createdAtMs: data.createdAtMs, ...(data.readAtMs ? { readAtMs: data.readAtMs } : {}) } as SocialAlert;
    }));
    const last = documents.at(-1);
    return { items, ...(snapshot.size > limit && last ? { nextCursor: encodeSocialCursor({ createdAtMs: last.data().createdAtMs, id: last.id }) } : {}) };
  }

  async markAlertsRead(publicId: string, nowMs: number): Promise<void> {
    const snapshot = await this.alerts(publicId).where('readAtMs', '==', null).limit(200).get();
    const batch = this.db.batch();
    for (const document of snapshot.docs) batch.update(document.ref, { readAtMs: nowMs });
    await batch.commit();
  }

  async createReport(reporterId: string, input: CreateSocialReportInput, nowMs: number): Promise<void> {
    await this.collection('social_reports').doc(randomUUID()).create({ ...input, reporterPublicId: reporterId, status: 'open', createdAtMs: nowMs });
  }

  private async toPost(viewerId: string, id: string, post: StoredPost): Promise<SocialPost> {
    const [liked, camped, author] = await Promise.all([this.reactions(id).doc(viewerId).get(), this.camps(viewerId).doc(post.ownerPublicId).get(), this.author(post.ownerPublicId, post.visibility === 'public' || post.ownerPublicId === viewerId)]);
    const ownedByViewer = post.ownerPublicId === viewerId;
    return { id, ...(ownedByViewer || post.visibility === 'public' ? { ownerPublicId: post.ownerPublicId } : {}), author, content: post.content, ...(post.media?.length ? { media: post.media } : {}), visibility: post.visibility, createdAtMs: post.createdAtMs, updatedAtMs: post.updatedAtMs, ...(post.editedAtMs ? { editedAtMs: post.editedAtMs } : {}), likeCount: post.likeCount, commentCount: post.commentCount, likedByViewer: liked.exists, campedByViewer: camped.exists, ownedByViewer };
  }

  private async toComment(viewerId: string, postId: string, id: string, comment: StoredComment): Promise<SocialComment> {
    const ownedByViewer = comment.ownerPublicId === viewerId;
    return { id, postId, ...(ownedByViewer || comment.visibility === 'public' ? { ownerPublicId: comment.ownerPublicId } : {}), author: await this.author(comment.ownerPublicId, comment.visibility === 'public' || ownedByViewer), content: comment.content, visibility: comment.visibility, createdAtMs: comment.createdAtMs, ownedByViewer };
  }

  private async author(publicId: string, visible: boolean): Promise<SocialAuthor> {
    if (!visible) return { displayName: 'Anonymous' };
    const profile = await this.profiles().doc(publicId).get();
    const data = profile.data();
    return { publicId, displayName: (data?.displayName as string | undefined) || publicId.slice(0, 12), ...(data?.avatarUrl ? { avatarUrl: data.avatarUrl as string } : {}) };
  }

  private collection(name: string) { return this.db.collection(`${this.prefix}_${name}`); }
  private posts() { return this.collection('social_posts'); }
  private profiles() { return this.collection('social_profiles'); }
  private comments(postId: string) { return this.posts().doc(postId).collection('comments'); }
  private reactions(postId: string) { return this.posts().doc(postId).collection('reactions'); }
  private camps(publicId: string) { return this.collection('social_camps').doc(publicId).collection('targets'); }
  private alerts(publicId: string) { return this.collection('social_alerts').doc(publicId).collection('items'); }
}
