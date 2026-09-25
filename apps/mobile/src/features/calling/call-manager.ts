import {
  addCallAnsweredListener,
  addCallEndedListener,
  addOutgoingCallStartedListener,
  addSetMutedActionListener,
  addVoIPPushTokenUpdatedListener,
  answerCall,
  endCall,
  failIncomingCallConnected,
  fulfillIncomingCallConnected,
  getVoIPPushToken,
  registerVoIPPush,
  reportCallEnded,
  reportIncomingCall,
  reportOutgoingCallConnected,
  setMuted,
  startOutgoingCall,
} from 'expo-callkit-telecom';
import { randomUUID } from 'expo-crypto';

import type { MediaStream } from '@livekit/react-native-webrtc';

import { issueTurnCredential, registerVoipToken } from '@/api/calling';
import type { CallMedia } from '@/domain/calling/types';
import type { IncomingRelayMessage } from '@/services/calling/signaling-socket';
import { SignalingSocket } from '@/services/calling/signaling-socket';
import { WebrtcCallSession } from '@/services/calling/webrtc-call-session';
import { getOrCreatePushDeviceId } from '@/services/notifications/device-id';

export type CallUiState =
  | Readonly<{ phase: 'idle' }>
  | Readonly<{ phase: 'ringing-outgoing'; peerPublicId: string; peerDisplayName?: string; media: CallMedia }>
  | Readonly<{ phase: 'ringing-incoming'; peerPublicId: string; peerDisplayName?: string; media: CallMedia }>
  | Readonly<{ phase: 'connecting'; peerPublicId: string; peerDisplayName?: string; media: CallMedia }>
  | Readonly<{
      phase: 'in-call';
      peerPublicId: string;
      peerDisplayName?: string;
      media: CallMedia;
      isMuted: boolean;
      isCameraOn: boolean;
      remoteStreamUrl?: string;
    }>;

type ActiveCall = {
  callId: string;
  nativeCallId: string;
  peerPublicId: string;
  peerDisplayName?: string;
  media: CallMedia;
  direction: 'outgoing' | 'incoming';
  session?: WebrtcCallSession;
  requestId?: string;
  pendingOfferSdp?: string;
  pendingCandidates: unknown[];
  isMuted: boolean;
  isCameraOn: boolean;
  remoteStream?: MediaStream;
};

const IDLE_STATE: CallUiState = { phase: 'idle' };

/**
 * Owns the full in-app calling lifecycle end to end: the signaling socket, the native
 * CallKit/Telecom session (via expo-callkit-telecom), and the WebRTC media session for
 * whichever single call is active. Deliberately a plain class rather than a hook — this
 * keeps the intricate event wiring (native events, signaling messages, WebRTC callbacks all
 * mutating the same call record) out of React's render cycle, where stale closures over
 * this much shared mutable state would be easy to get wrong.
 */
export class CallManager {
  private readonly signaling = new SignalingSocket();
  private readonly listeners = new Set<(state: CallUiState) => void>();
  private call: ActiveCall | null = null;
  private nativeSubscriptions: { remove: () => void }[] = [];
  private started = false;
  private cachedSnapshot: CallUiState = IDLE_STATE;

  start(): void {
    if (this.started) return;
    this.started = true;

    void this.signaling.connect();
    this.signaling.onMessage((message) => void this.handleRelayMessage(message));

    registerVoIPPush();
    this.nativeSubscriptions.push(
      addVoIPPushTokenUpdatedListener((event) => {
        if (!event.token) return;
        const tokenType = event.type === 'APNS_VOIP' ? 'APNS_VOIP' : 'FCM';
        void getOrCreatePushDeviceId().then((deviceId) => registerVoipToken(deviceId, tokenType, event.token!));
      }),
      addOutgoingCallStartedListener((event) => void this.handleOutgoingCallStarted(event.id)),
      addCallAnsweredListener((event) => void this.handleCallAnswered(event.id, event.requestId)),
      addCallEndedListener((event) => this.handleCallEndedLocally(event.id)),
      addSetMutedActionListener((event) => this.applyMuteFromSystem(event.id, event.isMuted)),
    );

    const existingToken = getVoIPPushToken();
    if (existingToken?.token) {
      void getOrCreatePushDeviceId().then((deviceId) =>
        registerVoipToken(deviceId, existingToken.type === 'APNS_VOIP' ? 'APNS_VOIP' : 'FCM', existingToken.token),
      );
    }
  }

  stop(): void {
    this.started = false;
    this.signaling.close();
    this.nativeSubscriptions.forEach((subscription) => subscription.remove());
    this.nativeSubscriptions = [];
    this.call?.session?.close();
    this.call = null;
    this.cachedSnapshot = IDLE_STATE;
  }

  subscribe(listener: (state: CallUiState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * `useSyncExternalStore` requires this to return the SAME reference across calls
   * whenever nothing has actually changed — returning a freshly allocated object every
   * time (even with identical field values) makes React think the store is perpetually
   * changing and triggers a "Maximum update depth exceeded" infinite render loop. The
   * snapshot is therefore computed once in `emit()` and cached, never recomputed here.
   */
  getSnapshot(): CallUiState {
    return this.cachedSnapshot;
  }

  private computeSnapshot(): CallUiState {
    if (!this.call) return IDLE_STATE;
    const { peerPublicId, peerDisplayName, media, direction } = this.call;

    if (direction === 'outgoing' && !this.call.session) return { phase: 'ringing-outgoing', peerPublicId, peerDisplayName, media };
    if (direction === 'incoming' && !this.call.requestId) return { phase: 'ringing-incoming', peerPublicId, peerDisplayName, media };
    if (!this.call.session) return { phase: 'connecting', peerPublicId, peerDisplayName, media };

    return {
      phase: 'in-call',
      peerPublicId,
      peerDisplayName,
      media,
      isMuted: this.call.isMuted,
      isCameraOn: this.call.isCameraOn,
      ...(this.call.remoteStream?.getVideoTracks().length
        ? { remoteStreamUrl: this.call.remoteStream.toURL() }
        : {}),
    };
  }

  async callUser(peerPublicId: string, peerDisplayName: string | undefined, media: CallMedia): Promise<void> {
    if (this.call) return;

    const callId = randomUUID();
    const nativeCallId = await startOutgoingCall(
      { id: peerPublicId, displayName: peerDisplayName },
      { hasVideo: media === 'video' },
    );

    this.call = {
      callId,
      nativeCallId,
      peerPublicId,
      peerDisplayName,
      media,
      direction: 'outgoing',
      pendingCandidates: [],
      isMuted: false,
      isCameraOn: media === 'video',
    };
    this.emit();
  }

  async answer(): Promise<void> {
    if (!this.call || this.call.direction !== 'incoming') return;
    await answerCall(this.call.nativeCallId);
  }

  async decline(): Promise<void> {
    if (!this.call) return;
    const call = this.call;
    this.signaling.send({ type: 'call-reject', callId: call.callId, toPublicId: call.peerPublicId });
    this.scheduleEndGuard(call.callId);
    await endCall(call.nativeCallId);
  }

  async hangUp(): Promise<void> {
    if (!this.call) return;
    const call = this.call;
    this.signaling.send({ type: 'call-end', callId: call.callId, toPublicId: call.peerPublicId });
    this.scheduleEndGuard(call.callId);
    await endCall(call.nativeCallId);
  }

  /**
   * `endCall()` only requests the OS end the call; the actual local teardown normally
   * happens when the native side reports it back via `addCallEndedListener`. If that
   * round trip never arrives (seen in testing: the close button did nothing), this
   * guard force-clears local state after a short grace period rather than leaving the
   * user stuck on an unresponsive call screen.
   */
  private scheduleEndGuard(callId: string): void {
    setTimeout(() => {
      if (this.call?.callId === callId) this.teardownLocal();
    }, 4_000);
  }

  toggleMute(): void {
    if (!this.call) return;
    void setMuted(this.call.nativeCallId, !this.call.isMuted);
  }

  toggleCamera(): void {
    if (!this.call?.session) return;
    this.call.isCameraOn = !this.call.isCameraOn;
    this.call.session.setCameraEnabled(this.call.isCameraOn);
    this.emit();
  }

  private async handleRelayMessage(message: IncomingRelayMessage): Promise<void> {
    if (message.type === 'call-invite') {
      await this.handleIncomingInvite(message);
      return;
    }
    if (!this.call || message.callId !== this.call.callId) return;

    if (message.type === 'call-offer' && message.sdp) {
      this.call.pendingOfferSdp = message.sdp;
      if (this.call.requestId) await this.beginAnsweringMedia();
    } else if (message.type === 'call-answer' && message.sdp) {
      await this.call.session?.applyRemoteAnswer(message.sdp);
      await reportOutgoingCallConnected(this.call.nativeCallId);
      this.emit();
    } else if (message.type === 'ice-candidate' && message.candidate) {
      if (this.call.session) await this.call.session.addRemoteCandidate(message.candidate as never);
      else this.call.pendingCandidates.push(message.candidate);
    } else if (message.type === 'call-reject' || message.type === 'call-end') {
      const nativeCallId = this.call.nativeCallId;
      this.teardownLocal();
      await reportCallEnded(nativeCallId, 'remoteEnded');
    }
  }

  private async handleIncomingInvite(message: IncomingRelayMessage): Promise<void> {
    if (this.call) return; // Already on a call — a real product would offer call-waiting; out of scope for now.

    this.call = {
      callId: message.callId,
      nativeCallId: '',
      peerPublicId: message.fromPublicId,
      media: message.media ?? 'audio',
      direction: 'incoming',
      pendingCandidates: [],
      isMuted: false,
      isCameraOn: message.media === 'video',
    };

    await reportIncomingCall({
      eventId: randomUUID(),
      serverCallId: message.callId,
      caller: { id: message.fromPublicId },
      hasVideo: message.media === 'video',
      startedAt: new Date().toISOString(),
    });
  }

  private async handleOutgoingCallStarted(nativeCallId: string): Promise<void> {
    const call = this.call;
    if (!call || call.nativeCallId !== nativeCallId) return;

    const pendingLocalCandidates: unknown[] = [];
    let offerSent = false;
    const session = new WebrtcCallSession(call.media === 'video', await this.safeTurnCredential(), {
      onLocalCandidate: (candidate) => {
        if (!offerSent) pendingLocalCandidates.push(candidate);
        else this.signaling.send({ type: 'ice-candidate', callId: call.callId, toPublicId: call.peerPublicId, candidate });
      },
      onRemoteStream: (stream) => {
        call.remoteStream = stream;
        this.emit();
      },
      onConnectionStateChange: () => this.emit(),
    });
    call.session = session;

    const sdp = await session.createOffer();
    this.signaling.send({ type: 'call-invite', callId: call.callId, toPublicId: call.peerPublicId, media: call.media });
    this.signaling.send({ type: 'call-offer', callId: call.callId, toPublicId: call.peerPublicId, sdp });
    offerSent = true;
    for (const candidate of pendingLocalCandidates) {
      this.signaling.send({ type: 'ice-candidate', callId: call.callId, toPublicId: call.peerPublicId, candidate });
    }
    this.emit();
  }

  private async handleCallAnswered(nativeCallId: string, requestId: string): Promise<void> {
    if (!this.call) return;
    this.call.nativeCallId = nativeCallId;
    this.call.requestId = requestId;
    this.emit();

    if (this.call.pendingOfferSdp) await this.beginAnsweringMedia();
  }

  private async beginAnsweringMedia(): Promise<void> {
    const call = this.call;
    const offerSdp = call?.pendingOfferSdp;
    const requestId = call?.requestId;
    if (!call || !offerSdp || !requestId) return;

    try {
      const pendingLocalCandidates: unknown[] = [];
      let answerSent = false;
      const session = new WebrtcCallSession(call.media === 'video', await this.safeTurnCredential(), {
        onLocalCandidate: (candidate) => {
          if (!answerSent) pendingLocalCandidates.push(candidate);
          else this.signaling.send({ type: 'ice-candidate', callId: call.callId, toPublicId: call.peerPublicId, candidate });
        },
        onRemoteStream: (stream) => {
          call.remoteStream = stream;
          this.emit();
        },
        onConnectionStateChange: () => this.emit(),
      });
      call.session = session;

      const answerSdp = await session.createAnswer(offerSdp);
      for (const candidate of call.pendingCandidates) await session.addRemoteCandidate(candidate as never);
      call.pendingCandidates = [];

      this.signaling.send({ type: 'call-answer', callId: call.callId, toPublicId: call.peerPublicId, sdp: answerSdp });
      answerSent = true;
      for (const candidate of pendingLocalCandidates) {
        this.signaling.send({ type: 'ice-candidate', callId: call.callId, toPublicId: call.peerPublicId, candidate });
      }
      await fulfillIncomingCallConnected(requestId);
      this.emit();
    } catch {
      await failIncomingCallConnected(call.nativeCallId, requestId);
      this.teardownLocal();
    }
  }

  private handleCallEndedLocally(nativeCallId: string): void {
    if (!this.call || this.call.nativeCallId !== nativeCallId) return;
    const call = this.call;
    this.signaling.send({ type: 'call-end', callId: call.callId, toPublicId: call.peerPublicId });
    this.teardownLocal();
  }

  private applyMuteFromSystem(nativeCallId: string, isMuted: boolean): void {
    if (!this.call || this.call.nativeCallId !== nativeCallId) return;
    this.call.isMuted = isMuted;
    this.call.session?.setMuted(isMuted);
    this.emit();
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
      // TURN not configured yet, or the request failed — direct peer-to-peer via public
      // STUN still works for the common case; only the relay-needed minority of calls fail.
      return undefined;
    }
  }

  private emit(): void {
    this.cachedSnapshot = this.computeSnapshot();
    this.listeners.forEach((listener) => listener(this.cachedSnapshot));
  }
}

export const callManager = new CallManager();
