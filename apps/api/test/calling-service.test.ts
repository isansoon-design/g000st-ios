import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { NativeCallPushClient } from '../src/calling/calling-service.js';
import { CallingService } from '../src/calling/calling-service.js';
import { CallingRelay } from '../src/calling/calling-relay.js';
import type { AuthService } from '../src/auth/auth-service.js';
import type { CallingStore } from '../src/calling/calling-store.js';
import type {
  CallHistoryEntry,
  CallingPage,
  IncomingCallPushEvent,
  PushTokenType,
  VoipDeviceRegistration,
} from '../src/calling/calling-types.js';
import type { CallingNotifier, IncomingCallNotification } from '../src/notifications/notification-service.js';

class StubCallingStore implements CallingStore {
  constructor(private readonly devices: VoipDeviceRegistration[] = []) {}

  async createCall(): Promise<void> {}
  async markAnswered(): Promise<void> {}
  async markEnded(): Promise<void> {}
  async listHistory(): Promise<CallingPage<CallHistoryEntry>> {
    return { items: [] };
  }
  async upsertVoipDevice(registration: VoipDeviceRegistration): Promise<void> {
    this.devices.push(registration);
  }
  async removeVoipDevice(): Promise<void> {}
  async listVoipDevices(): Promise<readonly VoipDeviceRegistration[]> {
    return this.devices;
  }
}

class SpyNotifier implements CallingNotifier {
  readonly calls: IncomingCallNotification[] = [];
  async notifyIncomingCall(input: IncomingCallNotification): Promise<void> {
    this.calls.push(input);
  }
}

class SpyPushClient implements NativeCallPushClient {
  readonly calls: Array<{ deviceToken: string; event: IncomingCallPushEvent }> = [];
  constructor(private readonly shouldFail = false) {}
  async sendIncomingCall(deviceToken: string, event: IncomingCallPushEvent): Promise<void> {
    if (this.shouldFail) throw new Error('push provider rejected the request');
    this.calls.push({ deviceToken, event });
  }
}

const CALLER = 'A'.repeat(50);
const CALLEE = 'B'.repeat(50);

function device(tokenType: PushTokenType, token: string): VoipDeviceRegistration {
  return { publicId: CALLEE, deviceId: `device-${token}`, tokenType, token, updatedAtMs: 0 };
}

describe('CallingService.notifyMissedInvite', () => {
  it('falls back to a generic notification when the callee has no registered device', async () => {
    const notifier = new SpyNotifier();
    const service = new CallingService(new StubCallingStore([]), undefined, notifier, {});

    await service.notifyMissedInvite('call-1', CALLER, CALLEE, 'audio');

    assert.equal(notifier.calls.length, 1);
    assert.equal(notifier.calls[0]?.calleePublicId, CALLEE);
  });

  it('prefers a native VoIP push over the generic notification when a device and client are both available', async () => {
    const notifier = new SpyNotifier();
    const apns = new SpyPushClient();
    const store = new StubCallingStore([device('APNS_VOIP', 'ios-token')]);
    const service = new CallingService(store, undefined, notifier, { apns });

    await service.notifyMissedInvite('call-2', CALLER, CALLEE, 'video');

    assert.equal(apns.calls.length, 1);
    assert.equal(apns.calls[0]?.deviceToken, 'ios-token');
    assert.equal(apns.calls[0]?.event.hasVideo, true);
    assert.equal(apns.calls[0]?.event.caller.id, CALLER);
    assert.equal(notifier.calls.length, 0, 'the generic notification must not also fire');
  });

  it('falls back to the generic notification when a device is registered but no matching client is configured', async () => {
    const notifier = new SpyNotifier();
    const store = new StubCallingStore([device('FCM', 'android-token')]);
    const service = new CallingService(store, undefined, notifier, {});

    await service.notifyMissedInvite('call-3', CALLER, CALLEE, 'audio');

    assert.equal(notifier.calls.length, 1);
  });

  it('falls back to the generic notification when the native push provider throws', async () => {
    const notifier = new SpyNotifier();
    const failingApns = new SpyPushClient(true);
    const store = new StubCallingStore([device('APNS_VOIP', 'ios-token')]);
    const service = new CallingService(store, undefined, notifier, { apns: failingApns });

    await service.notifyMissedInvite('call-4', CALLER, CALLEE, 'audio');

    assert.equal(notifier.calls.length, 1);
  });
});

describe('CallingService call permissions', () => {
  it('checks the caller, callee, and media before a call can ring', async () => {
    const checked: string[] = [];
    const service = new CallingService(new StubCallingStore(), undefined, new SpyNotifier(), {}, Date.now, {
      async canCall(caller, callee, media) {
        checked.push(`${caller}:${callee}:${media}`);
        return media === 'audio';
      },
    });

    assert.equal(await service.canReceiveCall(CALLER, CALLEE, 'audio'), true);
    assert.equal(await service.canReceiveCall(CALLER, CALLEE, 'video'), false);
    assert.deepEqual(checked, [`${CALLER}:${CALLEE}:audio`, `${CALLER}:${CALLEE}:video`]);
  });
});

describe('CallingRelay call permissions', () => {
  it('drops a denied invite and its offer before recording or notifying a call', async () => {
    let recorded = 0;
    let notified = 0;
    const callingService = {
      async canReceiveCall() { return false; },
      async recordInvite() { recorded += 1; },
      async notifyMissedInvite() { notified += 1; },
    } as unknown as CallingService;
    const relay = new CallingRelay({} as AuthService, callingService);
    const handleMessage = (relay as unknown as { handleMessage(fromPublicId: string, raw: string): Promise<void> }).handleMessage.bind(relay);
    const callId = '5ec62ebf-953e-4d21-b1a3-0b6837f899a6';

    await handleMessage(CALLER, JSON.stringify({ type: 'call-invite', callId, toPublicId: CALLEE, media: 'audio' }));
    await handleMessage(CALLER, JSON.stringify({ type: 'call-offer', callId, toPublicId: CALLEE, sdp: 'offer' }));

    assert.equal(recorded, 0);
    assert.equal(notified, 0);
  });
});
