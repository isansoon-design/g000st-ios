import { tokenService } from '@/api/token-service';
import { env } from '@/config/env';

export type RelayMessageType =
  | 'call-invite'
  | 'call-offer'
  | 'call-answer'
  | 'ice-candidate'
  | 'call-reject'
  | 'call-end';

export type OutgoingRelayMessage = Readonly<{
  type: RelayMessageType;
  callId: string;
  toPublicId: string;
  media?: 'audio' | 'video';
  sdp?: string;
  candidate?: unknown;
}>;

export type IncomingRelayMessage = OutgoingRelayMessage & Readonly<{ fromPublicId: string }>;

const RECONNECT_DELAY_MS = 2_000;

function resolveWsBase(): string {
  return env.apiBaseUrl.replace(/^http/, 'ws');
}

/**
 * A thin, auto-reconnecting client for the signaling relay (`apps/api/src/calling/calling-relay.ts`).
 * It never inspects message content beyond what it needs to route locally — the server is the
 * one enforcing who a message can claim to be from.
 */
export class SignalingSocket {
  private socket: WebSocket | null = null;
  private readonly listeners = new Set<(message: IncomingRelayMessage) => void>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closedByCaller = true;

  async connect(): Promise<void> {
    this.closedByCaller = false;
    const token = await tokenService.getAccess();
    if (!token) return;

    const socket = new WebSocket(`${resolveWsBase()}/calling/socket?token=${encodeURIComponent(token)}`);
    this.socket = socket;

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data)) as IncomingRelayMessage;
        this.listeners.forEach((listener) => listener(message));
      } catch {
        // Malformed frame — drop it silently, never crash the call UI over a bad message.
      }
    };

    socket.onclose = () => {
      if (this.socket === socket) this.socket = null;
      if (!this.closedByCaller) this.scheduleReconnect();
    };

    socket.onerror = () => {
      socket.close();
    };
  }

  send(message: OutgoingRelayMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  onMessage(listener: (message: IncomingRelayMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  close(): void {
    this.closedByCaller = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, RECONNECT_DELAY_MS);
  }
}
