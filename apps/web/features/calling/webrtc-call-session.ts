import type { TurnCredential } from "@/features/calling/types";

const PUBLIC_STUN_URLS = ["stun:stun.l.google.com:19302"];

function buildIceServers(turnCredential?: TurnCredential): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: PUBLIC_STUN_URLS }];
  if (turnCredential) {
    servers.push({
      urls: turnCredential.urls,
      username: turnCredential.username,
      credential: turnCredential.credential,
    });
  }
  return servers;
}

export type WebrtcCallSessionCallbacks = {
  onLocalCandidate: (candidate: RTCIceCandidateInit) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
};

/**
 * Browser counterpart of `apps/mobile/src/services/calling/webrtc-call-session.ts` — same
 * media tracks and stream IDs are attached before offer/answer negotiation.
 */
export class WebrtcCallSession {
  private readonly pc: RTCPeerConnection;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private pendingRemoteCandidates: RTCIceCandidateInit[] = [];

  constructor(
    private readonly hasVideo: boolean,
    turnCredential: TurnCredential | undefined,
    private readonly callbacks: WebrtcCallSessionCallbacks,
    relayOnly = false,
  ) {
    // Incoming video on the same Wi-Fi network can select an unstable host pair.
    // Use TURN for that path when credentials are available.
    this.pc = new RTCPeerConnection({
      iceServers: buildIceServers(turnCredential),
      iceTransportPolicy: relayOnly && turnCredential ? "relay" : "all",
    });

    this.pc.onicecandidate = (event) => {
      if (event.candidate) this.callbacks.onLocalCandidate(event.candidate.toJSON());
    };
    this.pc.ontrack = (event) => {
      if (!this.remoteStream) this.remoteStream = event.streams[0] ?? new MediaStream();
      if (!this.remoteStream.getTracks().some((track) => track.id === event.track.id)) {
        this.remoteStream.addTrack(event.track);
      }
      this.callbacks.onRemoteStream(this.remoteStream);
    };
    this.pc.onconnectionstatechange = () => {
      this.callbacks.onConnectionStateChange(this.pc.connectionState);
    };
  }

  async ensureLocalMedia(): Promise<MediaStream> {
    if (this.localStream) return this.localStream;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: this.hasVideo ? { facingMode: "user" } : false,
    });

    const audioTrack = stream.getAudioTracks()[0];
    const videoTrack = stream.getVideoTracks()[0];
    if (!audioTrack || (this.hasVideo && !videoTrack)) {
      stream.getTracks().forEach((track) => track.stop());
      throw new Error("Required call media track is unavailable");
    }

    try {
      this.pc.addTrack(audioTrack, stream);
      if (videoTrack) this.pc.addTrack(videoTrack, stream);
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop());
      throw error;
    }

    this.localStream = stream;
    return stream;
  }

  async createOffer(): Promise<string> {
    await this.ensureLocalMedia();
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    return this.pc.localDescription?.sdp ?? "";
  }

  async createAnswer(remoteOfferSdp: string): Promise<string> {
    await this.ensureLocalMedia();
    await this.pc.setRemoteDescription({ type: "offer", sdp: remoteOfferSdp });
    await this.flushRemoteCandidates();
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return this.pc.localDescription?.sdp ?? "";
  }

  async applyRemoteAnswer(remoteAnswerSdp: string): Promise<void> {
    await this.pc.setRemoteDescription({ type: "answer", sdp: remoteAnswerSdp });
    await this.flushRemoteCandidates();
  }

  async addRemoteCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!candidate.candidate) return;
    if (!this.pc.remoteDescription) {
      this.pendingRemoteCandidates.push(candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(candidate);
    } catch {
      // A candidate can legitimately arrive after the connection is already torn down.
    }
  }

  private async flushRemoteCandidates(): Promise<void> {
    for (const candidate of this.pendingRemoteCandidates.splice(0)) {
      await this.addRemoteCandidate(candidate);
    }
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  setMuted(muted: boolean): void {
    this.localStream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }

  setCameraEnabled(enabled: boolean): void {
    this.localStream?.getVideoTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }

  close(): void {
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.pendingRemoteCandidates = [];
    this.pc.close();
  }
}
