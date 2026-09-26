import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';

import { WebSocketServer, type WebSocket } from 'ws';
import { z } from 'zod';

import type { AuthService } from '../auth/auth-service.js';
import type { CallingService } from './calling-service.js';

const RELAY_PATH = '/api/v1/calling/socket';

const relayMessage = z
  .object({
    type: z.enum(['call-invite', 'call-offer', 'call-answer', 'ice-candidate', 'call-reject', 'call-end']),
    callId: z.string().uuid(),
    toPublicId: z.string().min(1).max(64),
    media: z.enum(['audio', 'video']).optional(),
    sdp: z.string().max(20_000).optional(),
    candidate: z.unknown().optional(),
  })
  .strict();

type RelayMessage = z.infer<typeof relayMessage>;

const PENDING_CALL_TTL_MS = 90_000;
const MAX_PENDING_CANDIDATES = 64;

type PendingCall = {
  callerPublicId: string;
  calleePublicId: string;
  invite: RelayMessage;
  offer?: RelayMessage;
  candidates: RelayMessage[];
  expiryTimer: ReturnType<typeof setTimeout>;
};

/**
 * Authenticates each socket and derives `fromPublicId` from that connection, never from a
 * client message. A short-lived in-memory copy of an offline callee's invite, offer, and
 * ICE candidates lets a phone woken by VoIP push receive the signaling it missed. Media
 * remains peer-to-peer; the relay does not inspect SDP or record media contents.
 */
export class CallingRelay {
  private readonly wss = new WebSocketServer({ noServer: true });
  private readonly socketsByPublicId = new Map<string, Set<WebSocket>>();
  /** Signaling for a callee awakened by VoIP push after the caller sent its offer. */
  private readonly pendingCalls = new Map<string, PendingCall>();
  /** Tracks whether an in-flight call has been answered, purely to classify how it ended. */
  private readonly answeredCallIds = new Set<string>();

  constructor(
    private readonly authService: AuthService,
    private readonly callingService: CallingService,
  ) {
    this.wss.on('connection', (socket: WebSocket, publicId: string) => {
      this.handleConnection(socket, publicId);
    });
  }

  async handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
    const url = new URL(request.url ?? '', 'http://internal');
    if (url.pathname !== RELAY_PATH) {
      socket.destroy();
      return;
    }

    const token = url.searchParams.get('token') ?? '';

    try {
      const user = await this.authService.getUser(token);
      this.wss.handleUpgrade(request, socket, head, (ws) => {
        this.wss.emit('connection', ws, user.publicId);
      });
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
    }
  }

  private handleConnection(socket: WebSocket, publicId: string): void {
    this.addSocket(publicId, socket);
    this.replayPendingCalls(publicId, socket);
    console.log(`[calling] socket open for ${publicId.slice(0, 8)} (${this.socketsByPublicId.get(publicId)?.size ?? 0} open for this user)`);

    // Messages are handled strictly in the order they arrive on this socket. Without this,
    // e.g. a call-invite (which awaits a Firestore write before relaying) can finish AFTER a
    // call-offer sent right behind it (which has no such await) — the callee then receives
    // the offer before its own call record exists, drops it, and is left with no offer to
    // ever answer. This was observed directly: server logs showed "call-offer relayed"
    // before "call-invite relayed" for the same call.
    let processingChain: Promise<void> = Promise.resolve();
    socket.on('message', (raw) => {
      const payload = raw.toString();
      processingChain = processingChain.then(() => this.handleMessage(publicId, payload));
    });

    socket.on('close', () => {
      this.removeSocket(publicId, socket);
      console.log(`[calling] socket closed for ${publicId.slice(0, 8)}`);
    });
  }

  private async handleMessage(fromPublicId: string, raw: string): Promise<void> {
    const parsed = relayMessage.safeParse(safeJsonParse(raw));
    if (!parsed.success) {
      console.log(`[calling] dropped malformed message from ${fromPublicId.slice(0, 8)}:`, parsed.error.issues[0]);
      return;
    }
    const message = parsed.data;
    console.log(`[calling] ${message.type} from ${fromPublicId.slice(0, 8)} to ${message.toPublicId.slice(0, 8)} (call ${message.callId})`);

    if (message.type === 'call-invite') {
      await this.callingService.recordInvite(message.callId, fromPublicId, message.toPublicId, message.media ?? 'audio');
    } else if (message.type === 'call-answer') {
      this.answeredCallIds.add(message.callId);
      await this.callingService.recordAnswered(message.callId);
    } else if (message.type === 'call-reject') {
      await this.callingService.recordEnded(message.callId, 'rejected');
    } else if (message.type === 'call-end') {
      const wasAnswered = this.answeredCallIds.delete(message.callId);
      await this.callingService.recordEnded(message.callId, wasAnswered ? 'ended' : 'missed');
    }

    const delivered = this.relay(message, fromPublicId);
    console.log(`[calling] ${message.type} ${delivered ? 'relayed to an open socket' : 'target has no open socket'}`);

    if (!delivered && message.type === 'call-invite') {
      this.rememberPendingInvite(message, fromPublicId);
      await this.callingService.notifyMissedInvite(message.callId, fromPublicId, message.toPublicId, message.media ?? 'audio');
    } else if (message.type === 'call-offer' || message.type === 'ice-candidate') {
      // Retain an offline call's signaling until it is answered: the first
      // socket can disconnect during cold startup before processing its offer.
      this.rememberPendingSignal(message, fromPublicId);
    }

    if (message.type === 'call-answer' || message.type === 'call-reject' || message.type === 'call-end') {
      this.forgetPendingCall(message.callId);
    }
  }

  private rememberPendingInvite(invite: RelayMessage, callerPublicId: string): void {
    this.forgetPendingCall(invite.callId);
    const expiryTimer = setTimeout(() => this.pendingCalls.delete(invite.callId), PENDING_CALL_TTL_MS);
    expiryTimer.unref();
    this.pendingCalls.set(invite.callId, {
      callerPublicId,
      calleePublicId: invite.toPublicId,
      invite,
      candidates: [],
      expiryTimer,
    });
  }

  private rememberPendingSignal(message: RelayMessage, callerPublicId: string): void {
    const pending = this.pendingCalls.get(message.callId);
    if (!pending || pending.callerPublicId !== callerPublicId || pending.calleePublicId !== message.toPublicId) return;
    if (message.type === 'call-offer') pending.offer = message;
    if (message.type === 'ice-candidate' && pending.candidates.length < MAX_PENDING_CANDIDATES) {
      pending.candidates.push(message);
    }
  }

  private replayPendingCalls(publicId: string, socket: WebSocket): void {
    for (const pending of this.pendingCalls.values()) {
      if (pending.calleePublicId !== publicId) continue;
      const send = (message: RelayMessage) => socket.send(JSON.stringify({ ...message, fromPublicId: pending.callerPublicId }));
      send(pending.invite);
      if (pending.offer) send(pending.offer);
      pending.candidates.forEach(send);
    }
  }

  private forgetPendingCall(callId: string): void {
    const pending = this.pendingCalls.get(callId);
    if (!pending) return;
    clearTimeout(pending.expiryTimer);
    this.pendingCalls.delete(callId);
  }

  private relay(message: RelayMessage, fromPublicId: string): boolean {
    const targetSockets = this.socketsByPublicId.get(message.toPublicId);
    if (!targetSockets || targetSockets.size === 0) return false;

    const outgoing = JSON.stringify({ ...message, fromPublicId });
    for (const targetSocket of targetSockets) targetSocket.send(outgoing);
    return true;
  }

  private addSocket(publicId: string, socket: WebSocket): void {
    const set = this.socketsByPublicId.get(publicId) ?? new Set<WebSocket>();
    set.add(socket);
    this.socketsByPublicId.set(publicId, set);
  }

  private removeSocket(publicId: string, socket: WebSocket): void {
    const set = this.socketsByPublicId.get(publicId);
    if (!set) return;
    set.delete(socket);
    if (set.size === 0) this.socketsByPublicId.delete(publicId);
  }
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
