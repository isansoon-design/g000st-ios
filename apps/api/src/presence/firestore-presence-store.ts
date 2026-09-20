import type { Firestore } from 'firebase-admin/firestore';

import type { PresenceStore } from './presence-store.js';

export class FirestorePresenceStore implements PresenceStore {
  constructor(private readonly db: Firestore, private readonly prefix: string) {}

  async setLastActive(publicId: string, nowMs: number): Promise<void> {
    await this.presence().doc(publicId).set({ lastActiveAtMs: nowMs }, { merge: true });
  }

  async getLastActiveMany(publicIds: readonly string[]): Promise<ReadonlyMap<string, number>> {
    if (publicIds.length === 0) return new Map();
    const refs = publicIds.map((publicId) => this.presence().doc(publicId));
    const snapshots = await this.db.getAll(...refs);
    const result = new Map<string, number>();
    for (const snapshot of snapshots) {
      const lastActiveAtMs = snapshot.data()?.lastActiveAtMs as number | undefined;
      if (lastActiveAtMs !== undefined) result.set(snapshot.id, lastActiveAtMs);
    }
    return result;
  }

  private presence() {
    return this.db.collection(`${this.prefix}_presence`);
  }
}
