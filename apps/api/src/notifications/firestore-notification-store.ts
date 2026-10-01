import { createHash } from 'node:crypto';

import type { Firestore } from 'firebase-admin/firestore';

import type { NotificationStore } from './notification-store.js';
import type { PushDevice, PushPlatform } from './notification-types.js';

export class FirestoreNotificationStore implements NotificationStore {
  constructor(
    private readonly db: Firestore,
    private readonly collectionPrefix: string,
  ) {}

  async upsertDevice(input: Readonly<{
    deviceId: string;
    expoPushToken?: string;
    fcmToken?: string;
    ownerPublicId?: string;
    platform: PushPlatform;
    publicId: string;
    updatedAtMs: number;
  }>): Promise<void> {
    const token = input.fcmToken ?? input.expoPushToken;
    if (!token) throw new Error('A push token is required.');
    const tokenHash = this.tokenHash(token);
    // Replace a rotated token atomically; never leave the installation unregistered.
    const old = await this.devices().where('publicId', '==', input.publicId).where('deviceId', '==', input.deviceId).get();
    const target = this.devices().doc(`${input.publicId}_${tokenHash}`);
    const batch = this.db.batch();
    old.docs.forEach((doc) => { if (doc.id !== target.id) batch.delete(doc.ref); });
    batch.set(target, { ...input, disabledAtMs: null });
    const legacy = this.devices().doc(tokenHash);
    if ((await legacy.get()).data()?.publicId === input.publicId) batch.delete(legacy);
    await batch.commit();
  }

  async removeDevice(publicId: string, deviceId: string): Promise<void> {
    const snapshot = await this.devices()
      .where('publicId', '==', publicId)
      .where('deviceId', '==', deviceId)
      .limit(10)
      .get();
    if (snapshot.empty) return;

    const batch = this.db.batch();
    for (const document of snapshot.docs) batch.delete(document.ref);
    await batch.commit();
  }

  async listActiveDevices(publicId: string): Promise<readonly PushDevice[]> {
    const snapshot = await this.devices().where('publicId', '==', publicId).limit(20).get();
    return snapshot.docs.flatMap((document) => {
      const data = document.data();
      if (
        data.disabledAtMs != null ||
        typeof data.deviceId !== 'string' ||
        (typeof data.expoPushToken !== 'string' && typeof data.fcmToken !== 'string') ||
        (data.platform !== 'android' && data.platform !== 'ios' && data.platform !== 'web') ||
        typeof data.publicId !== 'string' ||
        typeof data.updatedAtMs !== 'number'
      ) {
        return [];
      }
      return [data as PushDevice];
    });
  }

  async disableToken(expoPushToken: string): Promise<void> {
    const matches = await this.devices().where('expoPushToken', '==', expoPushToken).get();
    const batch = this.db.batch();
    for (const document of matches.docs) batch.update(document.ref, { disabledAtMs: Date.now() });
    await batch.commit();
  }

  private devices() {
    return this.db.collection(`${this.collectionPrefix}_push_devices`);
  }

  private tokenHash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
