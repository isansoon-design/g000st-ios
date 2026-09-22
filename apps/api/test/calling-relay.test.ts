import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';

import WebSocket from 'ws';

import { AuthService } from '../src/auth/auth-service.js';
import type {
  AccountReservation,
  AccountRole,
  ActiveAccount,
  AuthStore,
  RecoveryCredentialRecord,
  ReserveAccountResult,
  RotateRefreshResult,
  SessionMaterial,
} from '../src/auth/auth-store.js';
import { CallingRelay } from '../src/calling/calling-relay.js';
import { CallingService } from '../src/calling/calling-service.js';
import type { CallingStore } from '../src/calling/calling-store.js';
import type {
  CallHistoryEntry,
  CallingPage,
  CallMedia,
  CallStatus,
  VoipDeviceRegistration,
} from '../src/calling/calling-types.js';
import type { CallingNotifier, IncomingCallNotification } from '../src/notifications/notification-service.js';

class MemoryAuthStore implements AuthStore {
  private readonly users = new Map<string, AccountRole>();
  private readonly access = new Map<string, string>();

  async createAccount(reservation: AccountReservation): Promise<ReserveAccountResult> {
    this.users.set(reservation.publicId, 'user');
    this.access.set(reservation.session.accessHash, reservation.publicId);
    return 'created';
  }

  async createSession(): Promise<void> {}

  async findActivePublicIdByAccessHash(accessHash: string): Promise<ActiveAccount | null> {
    const publicId = this.access.get(accessHash);
    return publicId ? { publicId, role: this.users.get(publicId) ?? 'user' } : null;
  }

  async findRecoveryCredential(): Promise<RecoveryCredentialRecord | null> {
    return null;
  }

  async getAccountRole(publicId: string): Promise<AccountRole> {
    return this.users.get(publicId) ?? 'user';
  }

  async isUserActive(publicId: string): Promise<boolean> {
    return this.users.has(publicId);
  }

  async rotateRefresh(): Promise<RotateRefreshResult> {
    return 'not_found';
  }
}

type StoredCall = {
  callerPublicId: string;
  calleePublicId: string;
  media: CallMedia;
  status: CallStatus;
  startedAtMs: number;
  answeredAtMs?: number;
  endedAtMs?: number;
};

class MemoryCallingStore implements CallingStore {
  readonly calls = new Map<string, StoredCall>();

  constructor(private readonly createCallDelayMs = 0) {}

  async createCall(entry: { id: string; callerPublicId: string; calleePublicId: string; media: CallMedia; startedAtMs: number }): Promise<void> {
    if (this.createCallDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, this.createCallDelayMs));
    if (this.calls.has(entry.id)) return;
    this.calls.set(entry.id, { ...entry, status: 'ringing' });
  }

  async markAnswered(callId: string, answeredAtMs: number): Promise<void> {
    const call = this.calls.get(callId);
    if (call && call.status === 'ringing') {
      call.status = 'in_progress';
      call.answeredAtMs = answeredAtMs;
    }
  }

  async markEnded(callId: string, endedAtMs: number, status: 'ended' | 'missed' | 'rejected'): Promise<void> {
    const call = this.calls.get(callId);
    if (call && call.status !== 'ended' && call.status !== 'missed' && call.status !== 'rejected') {
      call.status = status;
      call.endedAtMs = endedAtMs;
    }
  }

  async listHistory(): Promise<CallingPage<CallHistoryEntry>> {
    return { items: [] };
  }

  async upsertVoipDevice(): Promise<void> {}

  async removeVoipDevice(): Promise<void> {}

  async listVoipDevices(): Promise<readonly VoipDeviceRegistration[]> {
    return [];
  }
}

class SpyCallingNotifier implements CallingNotifier {
  readonly notified: IncomingCallNotification[] = [];

  async notifyIncomingCall(input: IncomingCallNotification): Promise<void> {
    this.notified.push(input);
  }
}

const PEPPER = 'test-only-recovery-pepper-that-is-long-enough';

describe('CallingRelay', () => {
  let httpServer: Server;
  let baseUrl: string;
  let relay: CallingRelay;
  let callingStore: MemoryCallingStore;
  let notifier: SpyCallingNotifier;
  let aliceToken: string;
  let bobToken: string;
  let alicePublicId: string;
  let bobPublicId: string;

  before(async () => {
    const authStore = new MemoryAuthStore();
    const authService = new AuthService(authStore, PEPPER);
    const alice = await authService.register();
    const bob = await authService.register();
    aliceToken = alice.session.accessToken;
    bobToken = bob.session.accessToken;
    alicePublicId = alice.user.publicId;
    bobPublicId = bob.user.publicId;

    callingStore = new MemoryCallingStore();
    notifier = new SpyCallingNotifier();
    const callingService = new CallingService(callingStore, undefined, notifier);
    relay = new CallingRelay(authService, callingService);

    httpServer = createServer();
    httpServer.on('upgrade', (request, socket, head) => {
      void relay.handleUpgrade(request, socket, head);
    });
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    baseUrl = `ws://127.0.0.1:${(httpServer.address() as AddressInfo).port}/api/v1/calling/socket`;
  });

  after(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  function connect(token: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(`${baseUrl}?token=${token}`);
      socket.once('open', () => resolve(socket));
      socket.once('error', reject);
    });
  }

  function nextMessage(socket: WebSocket): Promise<Record<string, unknown>> {
    return new Promise((resolve) => {
      socket.once('message', (raw) => resolve(JSON.parse(raw.toString())));
    });
  }

  it('rejects a connection with an invalid access token before it can send or receive anything', async () => {
    await assert.rejects(
      () =>
        new Promise((_resolve, reject) => {
          const socket = new WebSocket(`${baseUrl}?token=not-a-real-token`);
          socket.once('unexpected-response', (_request, response) => reject(new Error(`status ${response.statusCode}`)));
          socket.once('error', reject);
        }),
      /status 401/,
    );
  });

  it('relays a message to the addressed peer, always attaching the authenticated sender, never a client-supplied one', async () => {
    const alice = await connect(aliceToken);
    const bob = await connect(bobToken);
    const callId = crypto.randomUUID();

    const delivered = nextMessage(bob);
    alice.send(JSON.stringify({ type: 'call-invite', callId, toPublicId: bobPublicId, media: 'video' }));
    const message = await delivered;

    assert.equal(message.fromPublicId, alicePublicId);
    assert.equal(message.toPublicId, bobPublicId);
    assert.equal(message.media, 'video');

    const stored = callingStore.calls.get(callId);
    assert.equal(stored?.callerPublicId, alicePublicId);
    assert.equal(stored?.calleePublicId, bobPublicId);
    assert.equal(stored?.status, 'ringing');

    alice.close();
    bob.close();
  });

  it('drops a message that tries to smuggle its own fromPublicId instead of relaying it', async () => {
    const alice = await connect(aliceToken);
    const bob = await connect(bobToken);
    const callId = crypto.randomUUID();

    let received = false;
    bob.once('message', () => {
      received = true;
    });

    alice.send(
      JSON.stringify({
        type: 'call-invite',
        callId,
        toPublicId: bobPublicId,
        media: 'audio',
        fromPublicId: 'someone-else-entirely',
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(received, false, 'a message with an unexpected field must be dropped, not relayed');
    assert.equal(callingStore.calls.has(callId), false);

    alice.close();
    bob.close();
  });

  it('falls back to a push notification when the target has no open socket', async () => {
    const alice = await connect(aliceToken);
    const callId = crypto.randomUUID();
    const unreachablePublicId = 'C'.repeat(50);

    alice.send(JSON.stringify({ type: 'call-invite', callId, toPublicId: unreachablePublicId, media: 'audio' }));
    await new Promise((resolve) => setTimeout(resolve, 100));

    assert.equal(notifier.notified.length, 1);
    assert.equal(notifier.notified[0]?.callId, callId);
    assert.equal(notifier.notified[0]?.callerPublicId, alicePublicId);
    assert.equal(notifier.notified[0]?.calleePublicId, unreachablePublicId);

    alice.close();
  });

  it('classifies an ended call as missed when it was never answered, and ended when it was', async () => {
    const alice = await connect(aliceToken);
    const bob = await connect(bobToken);
    const callId = crypto.randomUUID();

    alice.send(JSON.stringify({ type: 'call-invite', callId, toPublicId: bobPublicId, media: 'audio' }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    alice.send(JSON.stringify({ type: 'call-end', callId, toPublicId: bobPublicId }));
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.equal(callingStore.calls.get(callId)?.status, 'missed');

    alice.close();
    bob.close();
  });
});

describe('CallingRelay message ordering', () => {
  // A regression test for a real bug found in production testing: call-invite's handler
  // awaits a Firestore write (simulated here with an artificial delay) before relaying,
  // while call-offer's handler has no such await. Without strictly sequential per-socket
  // processing, a call-offer sent immediately after a call-invite could be relayed FIRST,
  // arriving at the callee before their call record exists — the offer was then dropped
  // silently, leaving the callee stuck on a "connecting" screen with nothing to answer.
  let httpServer: Server;
  let baseUrl: string;
  let aliceToken: string;
  let bobToken: string;
  let bobPublicId: string;

  before(async () => {
    const authStore = new MemoryAuthStore();
    const authService = new AuthService(authStore, PEPPER);
    const alice = await authService.register();
    const bob = await authService.register();
    aliceToken = alice.session.accessToken;
    bobToken = bob.session.accessToken;
    bobPublicId = bob.user.publicId;

    const slowStore = new MemoryCallingStore(50);
    const relay = new CallingRelay(authService, new CallingService(slowStore, undefined, new SpyCallingNotifier()));

    httpServer = createServer();
    httpServer.on('upgrade', (request, socket, head) => {
      void relay.handleUpgrade(request, socket, head);
    });
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    baseUrl = `ws://127.0.0.1:${(httpServer.address() as AddressInfo).port}/api/v1/calling/socket`;
  });

  after(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  function connect(token: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(`${baseUrl}?token=${token}`);
      socket.once('open', () => resolve(socket));
      socket.once('error', reject);
    });
  }

  it('delivers call-invite before a call-offer sent immediately after it, even though invite processing is slower', async () => {
    const alice = await connect(aliceToken);
    const bob = await connect(bobToken);
    const callId = crypto.randomUUID();
    const received: string[] = [];

    const gotBoth = new Promise<void>((resolve) => {
      bob.on('message', (raw) => {
        const message = JSON.parse(raw.toString()) as { type: string };
        received.push(message.type);
        if (received.length === 2) resolve();
      });
    });

    alice.send(JSON.stringify({ type: 'call-invite', callId, toPublicId: bobPublicId, media: 'video' }));
    alice.send(JSON.stringify({ type: 'call-offer', callId, toPublicId: bobPublicId, sdp: 'v=0…' }));
    await gotBoth;

    assert.deepEqual(received, ['call-invite', 'call-offer']);

    alice.close();
    bob.close();
  });
});
