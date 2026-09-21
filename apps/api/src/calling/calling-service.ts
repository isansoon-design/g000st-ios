import { randomUUID } from 'node:crypto';

import { ApiError } from '../http/api-error.js';
import type { CallingNotifier } from '../notifications/notification-service.js';
import { decodeCallingCursor } from './calling-cursor.js';
import type { CallingStore } from './calling-store.js';
import type {
  CallHistoryEntry,
  CallingPage,
  CallMedia,
  IncomingCallPushEvent,
  PushTokenType,
  TurnCredential,
  VoipDeviceRegistration,
} from './calling-types.js';
import type { TurnCredentialProvider } from './turn-credential-provider.js';

export interface NativeCallPushClient {
  sendIncomingCall(deviceToken: string, event: IncomingCallPushEvent): Promise<void>;
}

export type NativeCallPushClients = Readonly<{
  apns?: NativeCallPushClient;
  fcm?: NativeCallPushClient;
}>;

export class CallingService {
  constructor(
    private readonly store: CallingStore,
    private readonly turnCredentialProvider: TurnCredentialProvider | undefined,
    private readonly notifier: CallingNotifier,
    private readonly nativePush: NativeCallPushClients = {},
    private readonly now: () => number = Date.now,
  ) {}

  async issueTurnCredential(publicId: string): Promise<TurnCredential> {
    if (!this.turnCredentialProvider) {
      // Direct peer-to-peer connections (the common case, using public STUN only) still work
      // without this — only the ~20-30% of calls that need a relay fail until TURN is configured.
      throw new ApiError(503, 'TURN_UNAVAILABLE', 'Relay calling is not configured yet.');
    }
    return this.turnCredentialProvider.issueCredential(publicId);
  }

  async listHistory(
    publicId: string,
    limit: number,
    cursorValue?: string,
  ): Promise<CallingPage<CallHistoryEntry>> {
    return this.store.listHistory(publicId, limit, decodeCallingCursor(cursorValue));
  }

  async recordInvite(
    callId: string,
    callerPublicId: string,
    calleePublicId: string,
    media: CallMedia,
  ): Promise<void> {
    await this.store.createCall({ id: callId, callerPublicId, calleePublicId, media, startedAtMs: this.now() });
  }

  async recordAnswered(callId: string): Promise<void> {
    await this.store.markAnswered(callId, this.now());
  }

  async recordEnded(callId: string, outcome: 'ended' | 'missed' | 'rejected'): Promise<void> {
    await this.store.markEnded(callId, this.now(), outcome);
  }

  async registerVoipDevice(
    publicId: string,
    deviceId: string,
    tokenType: PushTokenType,
    token: string,
  ): Promise<void> {
    await this.store.upsertVoipDevice({ publicId, deviceId, tokenType, token, updatedAtMs: this.now() });
  }

  async unregisterVoipDevice(publicId: string, deviceId: string): Promise<void> {
    await this.store.removeVoipDevice(publicId, deviceId);
  }

  /**
   * Called by the relay when the callee has no open signaling socket to relay the invite to.
   * Prefers a native VoIP/FCM push (rings via CallKit/Telecom even if the app is fully
   * killed) whenever the callee has a registered device and the corresponding provider is
   * configured; falls back to a plain notification banner otherwise — better than nothing,
   * but the user has to open the app to see it, it will not ring on its own.
   */
  async notifyMissedInvite(
    callId: string,
    callerPublicId: string,
    calleePublicId: string,
    media: CallMedia,
  ): Promise<void> {
    const devices = await this.store.listVoipDevices(calleePublicId);
    const event: IncomingCallPushEvent = {
      eventId: randomUUID(),
      serverCallId: callId,
      hasVideo: media === 'video',
      startedAt: new Date(this.now()).toISOString(),
      caller: { id: callerPublicId },
    };

    const deliveredNatively = await this.sendNativeIncomingCallPush(devices, event);
    if (!deliveredNatively) {
      await this.notifier.notifyIncomingCall({ callId, callerPublicId, calleePublicId, media });
    }
  }

  private async sendNativeIncomingCallPush(
    devices: readonly VoipDeviceRegistration[],
    event: IncomingCallPushEvent,
  ): Promise<boolean> {
    if (devices.length === 0) return false;

    const attempts = await Promise.allSettled(
      devices.map((device) => {
        const client = device.tokenType === 'APNS_VOIP' ? this.nativePush.apns : this.nativePush.fcm;
        if (!client) return Promise.reject(new Error(`No ${device.tokenType} push client configured.`));
        return client.sendIncomingCall(device.token, event);
      }),
    );

    return attempts.some((attempt) => attempt.status === 'fulfilled');
  }
}
