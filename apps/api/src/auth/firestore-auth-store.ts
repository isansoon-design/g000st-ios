import { randomUUID } from 'node:crypto';

import type { Firestore, Transaction, WriteBatch } from 'firebase-admin/firestore';

import type {
  AccountReservation,
  AccountRole,
  ActiveAccount,
  AuthStore,
  RecoveryCredentialRecord,
  ReserveAccountResult,
  RotateRefreshResult,
  SessionMaterial,
} from './auth-store.js';

const DEFAULT_ROLE: AccountRole = 'user';

type StoredAccessSession = Readonly<{
  accessExpiresAtMs: number;
  createdAtMs: number;
  familyId: string;
  publicId: string;
}>;

type StoredRefreshSession = Readonly<{
  createdAtMs: number;
  familyId: string;
  publicId: string;
  refreshExpiresAtMs: number;
  replacementRefreshHash?: string;
  rotatedAtMs?: number;
}>;

type StoredSessionFamily = Readonly<{
  createdAtMs: number;
  publicId: string;
  revokedAtMs?: number;
}>;

export class FirestoreAuthStore implements AuthStore {
  constructor(
    private readonly db: Firestore,
    private readonly collectionPrefix: string,
  ) {}

  async createAccount(reservation: AccountReservation): Promise<ReserveAccountResult> {
    const userRef = this.collection('users').doc(reservation.publicId);
    const recoveryRef = this.collection('recovery_credentials').doc(
      reservation.recovery.lookupHash,
    );

    return await this.db.runTransaction(async (transaction) => {
      const [user, recovery] = await Promise.all([
        transaction.get(userRef),
        transaction.get(recoveryRef),
      ]);

      if (user.exists) return 'public_id_unavailable';
      if (recovery.exists) return 'recovery_collision';

      transaction.create(userRef, {
        createdAtMs: reservation.createdAtMs,
        publicId: reservation.publicId,
        role: DEFAULT_ROLE,
        status: 'active',
      });
      transaction.create(recoveryRef, {
        createdAtMs: reservation.createdAtMs,
        publicId: reservation.publicId,
        salt: reservation.recovery.salt,
        verifier: reservation.recovery.verifier,
      });
      this.writeNewSession(
        transaction,
        reservation.publicId,
        reservation.session,
        reservation.createdAtMs,
        randomUUID(),
      );

      return 'created';
    });
  }

  async createSession(
    publicId: string,
    material: SessionMaterial,
    createdAtMs: number,
  ): Promise<void> {
    const batch = this.db.batch();
    this.writeNewSession(batch, publicId, material, createdAtMs, randomUUID());
    await batch.commit();
  }

  async deleteAccount(publicId: string, deletedAtMs: number): Promise<void> {
    const userRef = this.collection('users').doc(publicId);
    const profileRef = this.collection('social_profiles').doc(publicId);
    const recoveryCredentials = await this.collection('recovery_credentials')
      .where('publicId', '==', publicId)
      .get();
    const pushDevices = await this.collection('push_devices')
      .where('publicId', '==', publicId)
      .get();

    const batch = this.db.batch();
    batch.update(userRef, { deletedAtMs, status: 'deleted' });
    batch.set(profileRef, {
      deletedAtMs,
      displayName: 'Deleted account',
      showDisplayName: true,
      updatedAtMs: deletedAtMs,
    });
    for (const credential of recoveryCredentials.docs) batch.delete(credential.ref);
    for (const device of pushDevices.docs) batch.delete(device.ref);
    await batch.commit();
  }

  async findActivePublicIdByAccessHash(
    accessHash: string,
    nowMs: number,
  ): Promise<ActiveAccount | null> {
    const access = await this.collection('access_sessions').doc(accessHash).get();
    if (!access.exists) return null;

    const data = access.data() as StoredAccessSession;
    if (data.accessExpiresAtMs <= nowMs) return null;

    const [family, user] = await Promise.all([
      this.collection('session_families').doc(data.familyId).get(),
      this.collection('users').doc(data.publicId).get(),
    ]);
    const familyData = family.data() as StoredSessionFamily | undefined;

    if (!family.exists || familyData?.revokedAtMs) return null;
    if (!user.exists || user.data()?.status !== 'active') return null;

    return {
      publicId: data.publicId,
      role: (user.data()?.role as AccountRole | undefined) ?? DEFAULT_ROLE,
    };
  }

  async getAccountRole(publicId: string): Promise<AccountRole> {
    const user = await this.collection('users').doc(publicId).get();
    return (user.data()?.role as AccountRole | undefined) ?? DEFAULT_ROLE;
  }

  async findRecoveryCredential(lookupHash: string): Promise<RecoveryCredentialRecord | null> {
    const snapshot = await this.collection('recovery_credentials').doc(lookupHash).get();
    if (!snapshot.exists) return null;

    const data = snapshot.data();
    if (
      typeof data?.publicId !== 'string' ||
      typeof data.salt !== 'string' ||
      typeof data.verifier !== 'string'
    ) {
      return null;
    }

    return {
      publicId: data.publicId,
      salt: data.salt,
      verifier: data.verifier,
    };
  }

  async isUserActive(publicId: string): Promise<boolean> {
    const user = await this.collection('users').doc(publicId).get();
    return user.exists && user.data()?.status === 'active';
  }

  async rotateRefresh(
    currentRefreshHash: string,
    next: SessionMaterial,
    rotatedAtMs: number,
  ): Promise<RotateRefreshResult> {
    const currentRef = this.collection('refresh_sessions').doc(currentRefreshHash);

    return await this.db.runTransaction(async (transaction) => {
      const current = await transaction.get(currentRef);
      if (!current.exists) return 'not_found';

      const currentData = current.data() as StoredRefreshSession;
      const familyRef = this.collection('session_families').doc(currentData.familyId);
      const nextAccessRef = this.collection('access_sessions').doc(next.accessHash);
      const nextRefreshRef = this.collection('refresh_sessions').doc(next.refreshHash);
      const [family, user, nextAccess, nextRefresh] = await Promise.all([
        transaction.get(familyRef),
        transaction.get(this.collection('users').doc(currentData.publicId)),
        transaction.get(nextAccessRef),
        transaction.get(nextRefreshRef),
      ]);
      const familyData = family.data() as StoredSessionFamily | undefined;

      if (!family.exists || familyData?.revokedAtMs) return 'revoked';

      if (!user.exists || user.data()?.status !== 'active') {
        transaction.update(familyRef, { revokedAtMs: rotatedAtMs });
        return 'revoked';
      }

      if (currentData.rotatedAtMs) {
        transaction.update(familyRef, { revokedAtMs: rotatedAtMs });
        return 'replayed';
      }

      if (currentData.refreshExpiresAtMs <= rotatedAtMs) return 'expired';
      if (nextAccess.exists || nextRefresh.exists) return 'replayed';

      transaction.update(currentRef, {
        replacementRefreshHash: next.refreshHash,
        rotatedAtMs,
      });
      transaction.create(nextAccessRef, {
        accessExpiresAtMs: next.accessExpiresAtMs,
        createdAtMs: rotatedAtMs,
        familyId: currentData.familyId,
        publicId: currentData.publicId,
      } satisfies StoredAccessSession);
      transaction.create(nextRefreshRef, {
        createdAtMs: rotatedAtMs,
        familyId: currentData.familyId,
        publicId: currentData.publicId,
        refreshExpiresAtMs: next.refreshExpiresAtMs,
      } satisfies StoredRefreshSession);

      return 'rotated';
    });
  }

  private collection(name: string) {
    return this.db.collection(`${this.collectionPrefix}_${name}`);
  }

  private writeNewSession(
    writer: Transaction | WriteBatch,
    publicId: string,
    material: SessionMaterial,
    createdAtMs: number,
    familyId: string,
  ): void {
    writer.create(this.collection('session_families').doc(familyId), {
      createdAtMs,
      publicId,
    } satisfies StoredSessionFamily);
    writer.create(this.collection('access_sessions').doc(material.accessHash), {
      accessExpiresAtMs: material.accessExpiresAtMs,
      createdAtMs,
      familyId,
      publicId,
    } satisfies StoredAccessSession);
    writer.create(this.collection('refresh_sessions').doc(material.refreshHash), {
      createdAtMs,
      familyId,
      publicId,
      refreshExpiresAtMs: material.refreshExpiresAtMs,
    } satisfies StoredRefreshSession);
  }
}
