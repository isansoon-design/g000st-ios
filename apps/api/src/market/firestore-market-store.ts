import { randomUUID } from 'node:crypto';

import { FieldPath, FieldValue, type DocumentData, type Firestore } from 'firebase-admin/firestore';

import type { MediaService } from '../media/media-service.js';
import { encodeSocialCursor, type SocialCursor } from '../social/social-cursor.js';
import { publicDisplayName } from '../social/social-identity.js';
import type { SocialAuthor, SocialMedia } from '../social/social-types.js';
import type { MarketStore } from './market-store.js';
import type { CreateMarketPostInput, MarketComment, MarketPage, MarketPost, UpdateMarketPostInput } from './market-types.js';

type StoredPost = Readonly<Omit<MarketPost, 'id' | 'author' | 'likedByViewer' | 'ownedByViewer'> & { ownerPublicId: string }>;
type StoredComment = Readonly<{ ownerPublicId: string; content: string; createdAtMs: number }>;

export class FirestoreMarketStore implements MarketStore {
  constructor(private readonly db: Firestore, private readonly prefix: string, private readonly mediaService?: MediaService) {}

  async listPosts(viewerId: string, limit: number, cursor?: SocialCursor, ownerId?: string): Promise<MarketPage<MarketPost>> {
    let query = this.posts().orderBy('createdAtMs', 'desc').orderBy(FieldPath.documentId(), 'desc');
    if (ownerId) query = query.where('ownerPublicId', '==', ownerId);
    if (cursor) query = query.startAfter(cursor.createdAtMs, cursor.id);
    let documents;
    let hasMore: boolean;
    try {
      const snapshot = await query.limit(limit + 1).get();
      documents = snapshot.docs.slice(0, limit);
      hasMore = snapshot.size > limit;
    } catch (error) {
      if (!ownerId || !isMissingFirestoreIndex(error)) throw error;
      // Keep "My Listings" available while a newly declared composite index is still
      // building. This fallback reads only the authenticated owner's listings and applies
      // the same deterministic cursor locally. Firestore resumes the indexed path above
      // automatically as soon as the index is ready.
      const snapshot = await this.posts().where('ownerPublicId', '==', ownerId).get();
      const ordered = [...snapshot.docs]
        .sort((left, right) => comparePostDocuments(right, left))
        .filter((document) => !cursor || isAfterCursor(document.id, document.data() as StoredPost, cursor));
      documents = ordered.slice(0, limit);
      hasMore = ordered.length > limit;
    }
    const items = await Promise.all(documents.map((document) => this.toPost(viewerId, document.id, document.data() as StoredPost)));
    const last = documents.at(-1);
    return { items, ...(hasMore && last ? { nextCursor: encodeSocialCursor({ createdAtMs: (last.data() as StoredPost).createdAtMs, id: last.id }) } : {}) };
  }

  async findPost(viewerId: string, postId: string) {
    const snapshot = await this.posts().doc(postId).get();
    return snapshot.exists ? this.toPost(viewerId, snapshot.id, snapshot.data() as StoredPost) : null;
  }

  async createPost(ownerId: string, id: string, input: Omit<CreateMarketPostInput, 'media'> & { media?: readonly SocialMedia[] }, nowMs: number) {
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

  async updatePost(viewerId: string, postId: string, input: UpdateMarketPostInput, nowMs: number) {
    const reference = this.posts().doc(postId);
    const updated = await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) return null;
      const post = snapshot.data() as StoredPost;
      if (post.ownerPublicId !== viewerId) return null;
      const next = { ...post, ...input, editedAtMs: nowMs, updatedAtMs: nowMs };
      transaction.set(reference, next);
      return next;
    });
    return updated ? this.toPost(viewerId, postId, updated) : null;
  }

  async deletePost(viewerId: string, postId: string) {
    const reference = this.posts().doc(postId);
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists || (snapshot.data() as StoredPost).ownerPublicId !== viewerId) return false;
      transaction.delete(reference);
      return true;
    });
  }

  async toggleLike(viewerId: string, postId: string, nowMs: number) {
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
      return { liked, likeCount };
    });
  }

  async listComments(viewerId: string, postId: string, limit: number, cursor?: SocialCursor) {
    if (!(await this.posts().doc(postId).get()).exists) return null;
    let query = this.comments(postId).orderBy('createdAtMs', 'asc').orderBy(FieldPath.documentId(), 'asc');
    if (cursor) query = query.startAfter(cursor.createdAtMs, cursor.id);
    const snapshot = await query.limit(limit + 1).get();
    const documents = snapshot.docs.slice(0, limit);
    const items = await Promise.all(documents.map((document) => this.toComment(viewerId, postId, document.id, document.data() as StoredComment)));
    const last = documents.at(-1);
    return { items, ...(snapshot.size > limit && last ? { nextCursor: encodeSocialCursor({ createdAtMs: (last.data() as StoredComment).createdAtMs, id: last.id }) } : {}) };
  }

  async createComment(viewerId: string, postId: string, content: string, nowMs: number) {
    const postRef = this.posts().doc(postId);
    const id = randomUUID();
    const comment: StoredComment = { ownerPublicId: viewerId, content, createdAtMs: nowMs };
    const created = await this.db.runTransaction(async (transaction) => {
      if (!(await transaction.get(postRef)).exists) return false;
      transaction.create(this.comments(postId).doc(id), comment);
      transaction.update(postRef, { commentCount: FieldValue.increment(1), updatedAtMs: nowMs });
      return true;
    });
    return created ? this.toComment(viewerId, postId, id, comment) : null;
  }

  async deleteComment(viewerId: string, postId: string, commentId: string) {
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

  private async toPost(viewerId: string, id: string, post: StoredPost): Promise<MarketPost> {
    const [liked, author] = await Promise.all([this.reactions(id).doc(viewerId).get(), this.author(post.ownerPublicId)]);
    return { ...post, id, author, likedByViewer: liked.exists, ownedByViewer: post.ownerPublicId === viewerId };
  }

  private async toComment(viewerId: string, postId: string, id: string, comment: StoredComment): Promise<MarketComment> {
    return { ...comment, id, postId, author: await this.author(comment.ownerPublicId), ownedByViewer: comment.ownerPublicId === viewerId };
  }

  private async author(publicId: string): Promise<SocialAuthor> {
    const profile = await this.profiles().doc(publicId).get();
    const data = profile.data();
    const deletedAtMs = data?.deletedAtMs as number | undefined;
    const avatarObjectKey = data?.avatarObjectKey as string | undefined;
    let avatarUrl: string | undefined;
    if (deletedAtMs === undefined && avatarObjectKey && this.mediaService) {
      avatarUrl = (await this.mediaService.getDownloadUrl({ byteSize: 0, contentType: 'image/*', fileName: 'avatar', id: 'avatar', kind: 'image', objectKey: avatarObjectKey }, 30 * 60)).downloadUrl;
    }
    return { publicId, displayName: publicDisplayName(publicId, { deletedAtMs, displayName: data?.displayName as string | undefined, showDisplayName: data?.showDisplayName === true }), ...(avatarUrl ? { avatarUrl } : {}) };
  }

  private collection(name: string) { return this.db.collection(`${this.prefix}_${name}`); }
  private posts() { return this.collection('market_posts'); }
  private profiles() { return this.collection('social_profiles'); }
  private comments(postId: string) { return this.posts().doc(postId).collection('comments'); }
  private reactions(postId: string) { return this.posts().doc(postId).collection('reactions'); }
}

function isMissingFirestoreIndex(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: number | string; message?: string };
  return (candidate.code === 9 || candidate.code === 'failed-precondition')
    && candidate.message?.toLowerCase().includes('index') === true;
}

function comparePostDocuments(
  left: Readonly<{ id: string; data(): DocumentData }>,
  right: Readonly<{ id: string; data(): DocumentData }>,
): number {
  const timeDifference = (left.data() as StoredPost).createdAtMs - (right.data() as StoredPost).createdAtMs;
  return timeDifference || left.id.localeCompare(right.id);
}

function isAfterCursor(id: string, post: StoredPost, cursor: SocialCursor): boolean {
  return post.createdAtMs < cursor.createdAtMs
    || (post.createdAtMs === cursor.createdAtMs && id < cursor.id);
}
