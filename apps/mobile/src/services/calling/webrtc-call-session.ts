import {
  mediaDevices,
  MediaStream,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  type RTCRtpTransceiver,
} from '@livekit/react-native-webrtc';

import type { TurnCredential } from '@/domain/calling/types';

type IceServer = Readonly<{ urls: string | string[]; username?: string; credential?: string }>;
type ConnectionState = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';
type RemoteCandidateInit = Readonly<{
  candidate?: string;
  sdpMLineIndex?: number | null;
  sdpMid?: string | null;
}>;

const PUBLIC_STUN_URLS = ['stun:stun.l.google.com:19302'];

function buildIceServers(turnCredential?: TurnCredential): IceServer[] {
  const servers: IceServer[] = [{ urls: PUBLIC_STUN_URLS }];
  if (turnCredential) {
    servers.push({
      urls: turnCredential.urls as unknown as string[],
      username: turnCredential.username,
      credential: turnCredential.credential,
    });
  }
  return servers;
}

export type WebrtcCallSessionCallbacks = Readonly<{
  onLocalCandidate: (candidate: RemoteCandidateInit) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionStateChange: (state: ConnectionState) => void;
}>;

/**
 * Owns exactly one call's `RTCPeerConnection` and local media — never the native call UI or
 * signaling transport, both of which live one layer up. This isolation is what lets the
 * in-app calling feature stay fully independent of Telnyx: nothing here talks to a phone
 * network, only to the peer's browser/app directly.
 */
export class WebrtcCallSession {
  private readonly pc: RTCPeerConnection;
  private readonly audioTransceiver: RTCRtpTransceiver;
  private readonly videoTransceiver: RTCRtpTransceiver | null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private pendingRemoteCandidates: RemoteCandidateInit[] = [];

  constructor(
    private readonly hasVideo: boolean,
    turnCredential: TurnCredential | undefined,
    private readonly callbacks: WebrtcCallSessionCallbacks,
  ) {
    this.pc = new RTCPeerConnection({ iceServers: buildIceServers(turnCredential) });

    // Transceivers are created explicitly, upfront, on both the offering and answering
    // side — never left to addTrack()'s implicit "reuse a transceiver created by
    // setRemoteDescription" behavior. That implicit path is a known source of m-line
    // mismatches between offer and answer in mobile WebRTC bindings once a video m-line
    // is involved, which breaks the whole session (audio included), not just video.
    this.audioTransceiver = this.pc.addTransceiver('audio', { direction: 'sendrecv' });
    this.videoTransceiver = hasVideo ? this.pc.addTransceiver('video', { direction: 'sendrecv' }) : null;

    this.pc.addEventListener('icecandidate', (event) => {
      if (event.candidate) this.callbacks.onLocalCandidate(event.candidate.toJSON());
    });
    this.pc.addEventListener('track', (event) => {
      const track = event.track;
      if (!track) return;
      // Transceiver replaceTrack can produce streamless tracks. RTCView still needs
      // a MediaStream containing the remote video track to render it.
      if (!this.remoteStream) this.remoteStream = new MediaStream();
      if (!this.remoteStream.getTracks().some((existing) => existing.id === track.id)) {
        this.remoteStream.addTrack(track);
      }
      this.callbacks.onRemoteStream(this.remoteStream);
    });
    this.pc.addEventListener('connectionstatechange', () => {
      this.callbacks.onConnectionStateChange(this.pc.connectionState as ConnectionState);
    });
  }

  async ensureLocalMedia(): Promise<MediaStream> {
    if (this.localStream) return this.localStream;

    const stream = await mediaDevices.getUserMedia({
      audio: true,
      video: this.hasVideo ? { facingMode: 'user' } : false,
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
    return this.pc.localDescription?.sdp ?? '';
  }

  async createAnswer(remoteOfferSdp: string): Promise<string> {
    await this.ensureLocalMedia();
    await this.pc.setRemoteDescription(new RTCSessionDescription({ sdp: remoteOfferSdp, type: 'offer' }));
    await this.flushRemoteCandidates();
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return this.pc.localDescription?.sdp ?? '';
  }

  async applyRemoteAnswer(remoteAnswerSdp: string): Promise<void> {
    await this.pc.setRemoteDescription(new RTCSessionDescription({ sdp: remoteAnswerSdp, type: 'answer' }));
    await this.flushRemoteCandidates();
  }

  async addRemoteCandidate(candidate: RemoteCandidateInit): Promise<void> {
    if (!candidate.candidate) return;
    if (!this.pc.remoteDescription) {
      this.pendingRemoteCandidates.push(candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {
      // A candidate can legitimately arrive after the connection is already torn down —
      // never let that crash the call.
    }
  }

  private async flushRemoteCandidates(): Promise<void> {
    for (const candidate of this.pendingRemoteCandidates.splice(0)) {
      await this.addRemoteCandidate(candidate);
    }
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
    this.remoteStream?.release(false);
  }
}
