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
    expoPushToken: string;
    platform: PushPlatform;
    publicId: string;
    updatedAtMs: number;
  }>): Promise<void> {
    await this.devices().doc(this.tokenHash(input.expoPushToken)).set(
      {
        ...input,
        disabledAtMs: null,
      },
      { merge: true },
    );
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
        typeof data.expoPushToken !== 'string' ||
        (data.platform !== 'android' && data.platform !== 'ios') ||
        typeof data.publicId !== 'string' ||
        typeof data.updatedAtMs !== 'number'
      ) {
        return [];
      }
      return [data as PushDevice];
    });
  }

  async disableToken(expoPushToken: string): Promise<void> {
    await this.devices().doc(this.tokenHash(expoPushToken)).set(
      { disabledAtMs: Date.now() },
      { merge: true },
    );
  }

  private devices() {
    return this.db.collection(`${this.collectionPrefix}_push_devices`);
  }

  private tokenHash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
