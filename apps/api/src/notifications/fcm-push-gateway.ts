import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import type { Firestore } from 'firebase-admin/firestore';
import type { PushDevice, PushGateway, PushMessage } from './notification-types.js';

export class FcmPushGateway implements PushGateway {
  constructor(private readonly db: Firestore, private readonly prefix: string, private readonly fallback: PushGateway, private readonly messaging: () => Pick<Messaging, 'sendEach'> = getMessaging) {}

  async send(devices: readonly PushDevice[], message: PushMessage): Promise<void> {
    const now = Date.now();
    const ttl = Math.max(0, (message.expiresAtMs ?? now + 24 * 60 * 60_000) - now);
    if (message.expiresAtMs !== undefined && ttl === 0) return;
    // Never send both transports to the same installation.
    const fcmDevices = devices.filter((device) => !!device.fcmToken);
    const nativeIds = new Set(fcmDevices.map((device) => device.deviceId));
    await this.fallback.send(devices.filter((device) => !nativeIds.has(device.deviceId)), message);
    const unique = [...new Map(fcmDevices.map((device) => [device.fcmToken!, device])).values()];
    if (!unique.length) return;
    const result = await this.messaging().sendEach(unique.map((device) => ({
      token: device.fcmToken!,
      notification: { title: message.title, body: message.body },
      data: device.platform === 'android'
        // Expo's Android foreground serializer reads custom content.data from JSON body.
        ? { ...message.data, body: JSON.stringify(message.data), title: message.title, message: message.body }
        : message.data,
      android: { priority: 'high' as const, ttl, notification: { channelId: message.data.type === 'chat.message' ? 'messages' : 'activity', ...(message.data.notificationId ? { tag: message.data.conversationId ?? message.data.notificationId } : {}) } },
      apns: { headers: { 'apns-expiration': String(Math.floor((now + ttl) / 1000)), ...(message.data.notificationId ? { 'apns-collapse-id': message.data.conversationId ?? message.data.notificationId } : {}) }, payload: { aps: { sound: 'default' } } },
      // The service worker resolves data.path on this origin after checking the recipient.
      webpush: { headers: { TTL: String(Math.floor(ttl / 1000)) }, ...(message.data.notificationId ? { notification: { tag: message.data.conversationId ?? message.data.notificationId } } : {}) },
    })));
    let transientFailure = false;
    for (const [index, response] of result.responses.entries()) {
      if (response.success) continue;
      const code = response.error?.code;
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
        const snapshot = await this.db.collection(`${this.prefix}_push_devices`).where('fcmToken', '==', unique[index]!.fcmToken).get();
        const batch = this.db.batch();
        snapshot.docs.forEach((doc) => batch.update(doc.ref, { disabledAtMs: now }));
        await batch.commit();
      } else transientFailure = true;
    }
    if (transientFailure) throw new Error('FCM delivery needs a retry.');
  }
}
