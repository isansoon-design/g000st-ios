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
 * design (explicit upfront transceivers + replaceTrack, never addTrack after
 * setRemoteDescription) for consistency, even though native browser WebRTC implementations
 * are generally less prone to the transceiver-reuse bug found on the mobile binding.
 */
export class WebrtcCallSession {
  private readonly pc: RTCPeerConnection;
  private readonly audioTransceiver: RTCRtpTransceiver;
  private readonly videoTransceiver: RTCRtpTransceiver | null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private pendingRemoteCandidates: RTCIceCandidateInit[] = [];

  constructor(
    private readonly hasVideo: boolean,
    turnCredential: TurnCredential | undefined,
    private readonly callbacks: WebrtcCallSessionCallbacks,
  ) {
    this.pc = new RTCPeerConnection({ iceServers: buildIceServers(turnCredential) });

    this.audioTransceiver = this.pc.addTransceiver("audio", { direction: "sendrecv" });
    this.videoTransceiver = hasVideo ? this.pc.addTransceiver("video", { direction: "sendrecv" }) : null;

    this.pc.onicecandidate = (event) => {
      if (event.candidate) this.callbacks.onLocalCandidate(event.candidate.toJSON());
    };
    this.pc.ontrack = (event) => {
      // replaceTrack on a transceiver does not attach an msid, so streams can be empty.
      // Build a stream from the tracks for both audio playback and video rendering.
      if (!this.remoteStream) this.remoteStream = new MediaStream();
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
    if (audioTrack) await this.audioTransceiver.sender.replaceTrack(audioTrack);

    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack && this.videoTransceiver) await this.videoTransceiver.sender.replaceTrack(videoTrack);

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
