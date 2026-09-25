import { issueTurnCredential } from "@/app/api/calling";
import type { CallMedia } from "@/features/calling/types";
import { SignalingSocket, type IncomingRelayMessage } from "@/features/calling/signaling-socket";
import { WebrtcCallSession } from "@/features/calling/webrtc-call-session";

export type CallUiState =
  | { phase: "idle" }
  | { phase: "ringing-outgoing"; peerPublicId: string; media: CallMedia }
  | { phase: "ringing-incoming"; peerPublicId: string; media: CallMedia }
  | {
      phase: "in-call";
      peerPublicId: string;
      media: CallMedia;
      isMuted: boolean;
      isCameraOn: boolean;
      answeredAtMs: number;
      localStream?: MediaStream;
      remoteStream?: MediaStream;
    };

type ActiveCall = {
  callId: string;
  peerPublicId: string;
  media: CallMedia;
  direction: "outgoing" | "incoming";
  session?: WebrtcCallSession;
  pendingOfferSdp?: string;
  pendingCandidates: RTCIceCandidateInit[];
  isMuted: boolean;
  isCameraOn: boolean;
  answered: boolean;
  answeredAtMs?: number;
  remoteStream?: MediaStream;
};

const IDLE_STATE: CallUiState = { phase: "idle" };

function randomCallId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `call-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Web counterpart of `apps/mobile/src/features/calling/call-manager.ts`. No native call UI
 * (browsers have none) — incoming calls are a plain in-page overlay, so there is no native
 * round-trip to wait on for teardown, which sidesteps the "hang-up doesn't close" class of bug
 * found on mobile: `hangUp()` here can tear down local state immediately and synchronously.
 *
 * Same critical rule as the mobile version: `getSnapshot()` must return a cached, stable
 * reference between calls — recomputing a fresh object every time breaks
 * `useSyncExternalStore` and causes an infinite render loop (found and fixed on mobile first).
 */
export class CallManager {
  private readonly signaling = new SignalingSocket();
  private readonly listeners = new Set<(state: CallUiState) => void>();
  private call: ActiveCall | null = null;
  private cachedSnapshot: CallUiState = IDLE_STATE;
  private started = false;

  start(): void {
    if (this.started) return;
    this.started = true;
    this.signaling.connect();
    this.signaling.onMessage((message) => void this.handleRelayMessage(message));
  }

  stop(): void {
    this.started = false;
    this.signaling.close();
    this.call?.session?.close();
    this.call = null;
    this.cachedSnapshot = IDLE_STATE;
  }

  subscribe(listener: (state: CallUiState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): CallUiState {
    return this.cachedSnapshot;
  }

  async callUser(peerPublicId: string, media: CallMedia): Promise<void> {
    if (this.call) return;

    const callId = randomCallId();
    this.call = {
      callId,
      peerPublicId,
      media,
      direction: "outgoing",
      pendingCandidates: [],
      isMuted: false,
      isCameraOn: media === "video",
      answered: false,
    };
    this.emit();

    const call = this.call;
    const pendingLocalCandidates: RTCIceCandidateInit[] = [];
    let offerSent = false;
    const session = new WebrtcCallSession(media === "video", "offerer", await this.safeTurnCredential(), {
      onLocalCandidate: (candidate) => {
        if (!offerSent) pendingLocalCandidates.push(candidate);
        else this.signaling.send({ type: "ice-candidate", callId, toPublicId: peerPublicId, candidate });
      },
      onRemoteStream: (stream) => {
        call.remoteStream = stream;
        this.emit();
      },
      onConnectionStateChange: () => this.emit(),
    });
    call.session = session;

    try {
      const sdp = await session.createOffer();
      this.signaling.send({ type: "call-invite", callId, toPublicId: peerPublicId, media });
      this.signaling.send({ type: "call-offer", callId, toPublicId: peerPublicId, sdp });
      offerSent = true;
      for (const candidate of pendingLocalCandidates) {
        this.signaling.send({ type: "ice-candidate", callId, toPublicId: peerPublicId, candidate });
      }
      this.emit();
    } catch {
      this.teardownLocal();
    }
  }

  async answer(): Promise<void> {
    const call = this.call;
    if (!call || call.direction !== "incoming" || !call.pendingOfferSdp) return;

    try {
      call.answeredAtMs = Date.now();
      const pendingLocalCandidates: RTCIceCandidateInit[] = [];
      let answerSent = false;
      const session = new WebrtcCallSession(call.media === "video", "answerer", await this.safeTurnCredential(), {
        onLocalCandidate: (candidate) => {
          if (!answerSent) pendingLocalCandidates.push(candidate);
          else this.signaling.send({ type: "ice-candidate", callId: call.callId, toPublicId: call.peerPublicId, candidate });
        },
        onRemoteStream: (stream) => {
          call.remoteStream = stream;
          this.emit();
        },
        onConnectionStateChange: () => this.emit(),
      });
      call.session = session;

      const answerSdp = await session.createAnswer(call.pendingOfferSdp);
      for (const candidate of call.pendingCandidates) await session.addRemoteCandidate(candidate);
      call.pendingCandidates = [];
      call.answered = true;

      this.signaling.send({ type: "call-answer", callId: call.callId, toPublicId: call.peerPublicId, sdp: answerSdp });
      answerSent = true;
      for (const candidate of pendingLocalCandidates) {
        this.signaling.send({ type: "ice-candidate", callId: call.callId, toPublicId: call.peerPublicId, candidate });
      }
      this.emit();
    } catch {
      this.decline();
    }
  }

  decline(): void {
    if (!this.call) return;
    this.signaling.send({ type: "call-reject", callId: this.call.callId, toPublicId: this.call.peerPublicId });
    this.teardownLocal();
  }

  hangUp(): void {
    if (!this.call) return;
    this.signaling.send({ type: "call-end", callId: this.call.callId, toPublicId: this.call.peerPublicId });
    this.teardownLocal();
  }

  toggleMute(): void {
    if (!this.call) return;
    this.call.isMuted = !this.call.isMuted;
    this.call.session?.setMuted(this.call.isMuted);
    this.emit();
  }

  toggleCamera(): void {
    if (!this.call) return;
    this.call.isCameraOn = !this.call.isCameraOn;
    this.call.session?.setCameraEnabled(this.call.isCameraOn);
    this.emit();
  }

  private async handleRelayMessage(message: IncomingRelayMessage): Promise<void> {
    if (message.type === "call-invite") {
      if (this.call) return; // Already on a call — call-waiting is out of scope for now.
      this.call = {
        callId: message.callId,
        peerPublicId: message.fromPublicId,
        media: message.media ?? "audio",
        direction: "incoming",
        pendingCandidates: [],
        isMuted: false,
        isCameraOn: message.media === "video",
        answered: false,
      };
      this.emit();
      return;
    }

    if (!this.call || message.callId !== this.call.callId) return;

    if (message.type === "call-offer" && message.sdp) {
      this.call.pendingOfferSdp = message.sdp;
    } else if (message.type === "call-answer" && message.sdp) {
      await this.call.session?.applyRemoteAnswer(message.sdp);
      this.call.answered = true;
      this.call.answeredAtMs = Date.now();
      this.emit();
    } else if (message.type === "ice-candidate" && message.candidate) {
      const candidate = message.candidate as RTCIceCandidateInit;
      if (this.call.session) await this.call.session.addRemoteCandidate(candidate);
      else this.call.pendingCandidates.push(candidate);
    } else if (message.type === "call-reject" || message.type === "call-end") {
      this.teardownLocal();
    }
  }

  private teardownLocal(): void {
    this.call?.session?.close();
    this.call = null;
    this.emit();
  }

  private async safeTurnCredential() {
    try {
      return await issueTurnCredential();
    } catch {
      return undefined;
    }
  }

  private computeSnapshot(): CallUiState {
    if (!this.call) return IDLE_STATE;
    const { peerPublicId, media, direction, answered, answeredAtMs } = this.call;

    if (direction === "outgoing" && (!answered || !answeredAtMs)) return { phase: "ringing-outgoing", peerPublicId, media };
    if (direction === "incoming" && (!answered || !answeredAtMs)) return { phase: "ringing-incoming", peerPublicId, media };

    return {
      phase: "in-call",
      peerPublicId,
      media,
      isMuted: this.call.isMuted,
      isCameraOn: this.call.isCameraOn,
      answeredAtMs: answeredAtMs!,
      localStream: this.call.session?.getLocalStream() ?? undefined,
      remoteStream: this.call.remoteStream,
    };
  }

  private emit(): void {
    this.cachedSnapshot = this.computeSnapshot();
    this.listeners.forEach((listener) => listener(this.cachedSnapshot));
  }
}

export const callManager = new CallManager();
