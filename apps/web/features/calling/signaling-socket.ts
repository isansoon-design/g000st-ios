import { sessionStorage } from "@/app/api/session-storage";

export type RelayMessageType =
  | "call-invite"
  | "call-offer"
  | "call-answer"
  | "ice-candidate"
  | "call-reject"
  | "call-end";

export type OutgoingRelayMessage = {
  type: RelayMessageType;
  callId: string;
  toPublicId: string;
  media?: CallMediaType;
  sdp?: string;
  candidate?: unknown;
};

type CallMediaType = "audio" | "video";

export type IncomingRelayMessage = OutgoingRelayMessage & { fromPublicId: string };

const RECONNECT_DELAY_MS = 2_000;

function resolveWsUrl(token: string): string {
  const apiOrigin = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3100").replace(/\/+$/, "");
  const apiBasePath = `/${(process.env.NEXT_PUBLIC_API_BASE_PATH || "/api/v1").replace(/^\/+|\/+$/g, "")}`;
  const wsOrigin = apiOrigin.replace(/^http/, "ws");
  return `${wsOrigin}${apiBasePath}/calling/socket?token=${encodeURIComponent(token)}`;
}

/**
 * A thin, auto-reconnecting client for the signaling relay (`apps/api/src/calling/calling-relay.ts`).
 * Mirrors `apps/mobile/src/services/calling/signaling-socket.ts` — same server, same protocol,
 * same "queue until open" behavior (a message sent before the handshake completes must never be
 * silently dropped — that exact bug was found and fixed on mobile).
 */
export class SignalingSocket {
  private socket: WebSocket | null = null;
  private readonly listeners = new Set<(message: IncomingRelayMessage) => void>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closedByCaller = true;
  private readonly outbox: OutgoingRelayMessage[] = [];

  connect(): void {
    if (typeof window === "undefined") return;
    this.closedByCaller = false;
    const token = sessionStorage.get()?.tokens.accessToken;
    if (!token) return;

    const socket = new WebSocket(resolveWsUrl(token));
    this.socket = socket;

    socket.onopen = () => {
      while (this.outbox.length > 0 && this.socket === socket) {
        socket.send(JSON.stringify(this.outbox.shift()));
      }
    };

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
      return;
    }
    this.outbox.push(message);
    if (!this.socket) this.connect();
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
      this.connect();
    }, RECONNECT_DELAY_MS);
  }
}
