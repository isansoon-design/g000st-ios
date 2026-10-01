import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Firestore } from 'firebase-admin/firestore';
import type { Messaging } from 'firebase-admin/messaging';
import { FcmPushGateway } from '../src/notifications/fcm-push-gateway.js';
import type { PushDevice, PushGateway, PushMessage } from '../src/notifications/notification-types.js';

const message: PushMessage = { title: 'g000st', body: 'You received a new private message.', expiresAtMs: Date.now() + 60_000,
  data: { type: 'chat.message', conversationId: 'a'.repeat(64), notificationId: 'b'.repeat(64), path: '/chat?conversationId=' + 'a'.repeat(64) } };
const device: PushDevice = { publicId: 'P'.repeat(50), deviceId: 'device-1', platform: 'android', fcmToken: 'fcm-1', updatedAtMs: 0 };

test('FCM targets tokens once, preserves Expo Android custom data and avoids two transports on one installation', async () => {
  let payloads: any[] = []; let legacy: readonly PushDevice[] = [];
  const fallback: PushGateway = { send: async (devices) => { legacy = devices; } };
  const factory = () => ({ sendEach: async (payload: any[]) => { payloads = payload; return { successCount: payload.length, failureCount: 0, responses: payload.map(() => ({ success: true })) }; } }) as unknown as Pick<Messaging, 'sendEach'>;
  const gateway = new FcmPushGateway({} as Firestore, 'test', fallback, factory);
  await gateway.send([device, { ...device, deviceId: 'device-2' }, { ...device, fcmToken: undefined, expoPushToken: 'ExpoPushToken[old]' },
    { ...device, deviceId: 'legacy-only', fcmToken: undefined, expoPushToken: 'ExpoPushToken[current]' },
    { ...device, deviceId: 'browser', platform: 'web', fcmToken: 'fcm-web' }], message);
  assert.equal(payloads.length, 2);
  assert.deepEqual(JSON.parse(payloads[0].data.body), message.data);
  assert.equal(payloads[0].notification.body, message.body);
  assert.equal(payloads[0].android.notification.channelId, 'messages');
  assert.equal(payloads[0].android.notification.tag, message.data.conversationId);
  assert.equal(payloads[1].data.body, undefined);
  assert.equal(legacy.length, 1); assert.equal(legacy[0]!.deviceId, 'legacy-only');
});

test('expired messages reach neither FCM nor Expo', async () => {
  const fail = async () => { throw new Error('Expired push must not be sent.'); };
  const gateway = new FcmPushGateway({} as Firestore, 'test', { send: fail }, () => ({ sendEach: fail }) as unknown as Pick<Messaging, 'sendEach'>);
  await gateway.send([device], { ...message, expiresAtMs: Date.now() - 1 });
});

test('invalid FCM registrations are disabled while transient delivery failures remain retryable', async () => {
  let disabled = 0;
  const db = { collection: () => ({ where: () => ({ get: async () => ({ docs: [{ ref: 'registration' }] }) }) }),
    batch: () => ({ update: () => { disabled++; }, commit: async () => undefined }) } as unknown as Firestore;
  const factory = () => ({ sendEach: async () => ({ successCount: 0, failureCount: 2, responses: [
    { success: false, error: { code: 'messaging/registration-token-not-registered' } },
    { success: false, error: { code: 'messaging/server-unavailable' } },
  ] }) }) as unknown as Pick<Messaging, 'sendEach'>;
  const gateway = new FcmPushGateway(db, 'test', { send: async () => undefined }, factory);
  await assert.rejects(gateway.send([device, { ...device, fcmToken: 'fcm-2' }], message), /retry/);
  assert.equal(disabled, 1);
});
