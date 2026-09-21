import { getMessaging } from 'firebase-admin/messaging';

import type { IncomingCallPushEvent } from './calling-types.js';

/**
 * Sends the raw FCM data message shape expo-callkit-telecom's Android service expects
 * (`{ data: { messageType: 'incomingCall', incomingCall: <JSON string> } }`). Reuses the
 * already-initialized default `firebase-admin` app — no separate FCM credential needed
 * beyond the service account this project already uses for Firestore.
 */
export class FcmVoipClient {
  async sendIncomingCall(fcmToken: string, event: IncomingCallPushEvent): Promise<void> {
    await getMessaging().send({
      token: fcmToken,
      android: { priority: 'high' },
      data: {
        messageType: 'incomingCall',
        incomingCall: JSON.stringify(event),
      },
    });
  }
}
