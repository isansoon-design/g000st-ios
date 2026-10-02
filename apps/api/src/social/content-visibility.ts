import type { DocumentData, Firestore, Query, QueryDocumentSnapshot } from 'firebase-admin/firestore';

/** Create per-read checks so deletion is never hidden by a process-wide cache. */
export function contentVisibility(db: Firestore, prefix: string) {
  const accounts = new Map<string, Promise<boolean>>();
  function account(publicId: string): Promise<boolean> {
    if (!accounts.has(publicId)) {
      accounts.set(publicId, Promise.all([
        db.collection(`${prefix}_users`).doc(publicId).get(),
        db.collection(`${prefix}_social_profiles`).doc(publicId).get(),
      ]).then(([user, profile]) => user.data()?.status !== 'deleted'
        && user.data()?.deletedAtMs == null && profile.data()?.deletedAtMs == null));
    }
    return accounts.get(publicId)!;
  }
  async function content(data: DocumentData | undefined, seen = new Set<string>()): Promise<boolean> {
    if (!data || data.hidden === true || data.deletedAtMs != null) return false;
    if (typeof data.ownerPublicId === 'string' && !await account(data.ownerPublicId)) return false;
    if (typeof data.sharedPostId === 'string') {
      if (seen.has(data.sharedPostId)) return false;
      seen.add(data.sharedPostId);
      const original = await db.collection(`${prefix}_social_posts`).doc(data.sharedPostId).get();
      return content(original.data(), seen);
    }
    return true;
  }
  async function notification(data: DocumentData): Promise<boolean> {
    if (data.scope === 'admin') return true;
    if (data.actorPublicId && !await account(data.actorPublicId)) return false;
    if (data.source && ['social_posts', 'market_posts'].includes(data.source.collection)) {
      const parent = db.collection(`${prefix}_${data.source.collection}`).doc(data.source.parentId ?? data.source.id);
      if (!await content((await parent.get()).data())) return false;
      if (data.source.parentId && !await content((await parent.collection('comments').doc(data.source.id).get()).data())) return false;
    }
    return true;
  }
  return { account, content, notification };
}

/** Collect a full visible page plus lookahead, even across entirely hidden batches. */
export async function visibleDocuments(
  query: Query<DocumentData>, limit: number,
  visible: (document: QueryDocumentSnapshot<DocumentData>) => Promise<boolean>,
): Promise<QueryDocumentSnapshot<DocumentData>[]> {
  const documents: QueryDocumentSnapshot<DocumentData>[] = [];
  const batchSize = Math.max(limit + 1, 30);
  while (documents.length <= limit) {
    const snapshot = await query.limit(batchSize).get();
    const visibility = await Promise.all(snapshot.docs.map(visible));
    documents.push(...snapshot.docs.filter((_, index) => visibility[index]));
    if (documents.length > limit || snapshot.size < batchSize) break;
    const last = snapshot.docs.at(-1);
    if (!last) break;
    query = query.startAfter(last);
  }
  return documents.slice(0, limit + 1);
}
