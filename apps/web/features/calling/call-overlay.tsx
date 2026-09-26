"use client";

import { useEffect, useRef, useState } from "react";

import { getSocialProfile } from "@/app/api/social";
import type { CallUiState } from "@/features/calling/call-manager";
import { listenForRingtoneUnlock, startIncomingCallRingtone } from "@/features/calling/incoming-call-ringtone";
import { useCalling } from "@/features/calling/use-calling";

function VideoSurface({ stream, muted, mirrored }: { stream?: MediaStream; muted: boolean; mirrored?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.srcObject = stream ?? null;
    if (stream) void ref.current.play().catch(() => undefined);
  }, [stream]);

  return (
    <video
      autoPlay
      className={`h-full w-full object-cover ${mirrored ? "-scale-x-100" : ""}`}
      muted={muted}
      playsInline
      ref={ref}
    />
  );
}

function RemoteAudio({ stream }: { stream?: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null);
  const audioTrackIds = stream?.getAudioTracks().map((track) => track.id).join(",");

  useEffect(() => {
    if (!ref.current) return;
    ref.current.srcObject = stream ?? null;
    if (audioTrackIds) void ref.current.play().catch(() => undefined);
  }, [stream, audioTrackIds]);

  return <audio autoPlay ref={ref} />;
}

function RoundButton({
  accessibilityLabel,
  label,
  color,
  foreground = "#FFFFFF",
  onClick,
}: {
  accessibilityLabel: string;
  label: string;
  color: string;
  foreground?: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={accessibilityLabel}
      className="flex h-14 w-14 items-center justify-center rounded-full text-xl font-black text-white shadow-lg transition active:scale-95"
      onClick={onClick}
      style={{ background: color, color: foreground }}
      title={accessibilityLabel}
      type="button"
    >
      {label}
    </button>
  );
}

function shortId(publicId: string): string {
  return `${publicId.slice(0, 12)}…${publicId.slice(-6)}`;
}

function initials(displayName: string | undefined): string {
  const value = displayName?.trim();
  if (!value) return "◎";
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function CallDuration({ answeredAtMs }: { answeredAtMs: number }) {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [answeredAtMs]);

  const totalSeconds = Math.max(0, Math.floor((now - answeredAtMs) / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const duration = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return <p className="text-sm font-bold text-white/70">{duration}</p>;
}

function CallOverlayComponent({
  state,
  onAnswer,
  onDecline,
  onHangUp,
  onToggleMute,
  onToggleCamera,
  peerProfile,
}: {
  state: CallUiState;
  onAnswer: () => void;
  onDecline: () => void;
  onHangUp: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  peerProfile: { displayName?: string; avatarUrl?: string } | null;
}) {
  if (state.phase === "idle") return null;

  const isVideo = state.media === "video";
  const hasRemoteVideo = state.phase === "in-call" && isVideo && Boolean(state.remoteStream?.getVideoTracks().length);
  const displayName = peerProfile?.displayName;
  const avatarUrl = peerProfile?.avatarUrl;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-black text-white">
      {state.phase === "in-call" ? <RemoteAudio stream={state.remoteStream} /> : null}
      {avatarUrl && !hasRemoteVideo ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-45 blur-3xl"
            src={avatarUrl}
          />
          <div className="absolute inset-0 bg-black/65" />
        </>
      ) : null}

      {hasRemoteVideo ? (
        <VideoSurface muted stream={state.remoteStream} />
      ) : (
        <div className="relative flex flex-1 items-center justify-center">
          <div className="flex h-36 w-36 items-center justify-center overflow-hidden rounded-full border-2 border-white/30 bg-white/10 text-4xl shadow-2xl sm:h-40 sm:w-40">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={displayName || "Call participant"} className="h-full w-full object-cover" src={avatarUrl} />
            ) : (
              <span className="font-black text-white/80">{initials(displayName)}</span>
            )}
          </div>
        </div>
      )}

      {state.phase === "in-call" && isVideo && state.isCameraOn && state.localStream ? (
        <div className="absolute right-4 top-4 h-32 w-24 overflow-hidden rounded-2xl border border-white/30 shadow-xl sm:h-40 sm:w-28">
          <VideoSurface mirrored muted stream={state.localStream} />
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-between px-6 py-10">
        <div className="pointer-events-auto text-center">
          <p className="text-lg font-black">{displayName || shortId(state.peerPublicId)}</p>
          {state.phase === "in-call" ? <CallDuration answeredAtMs={state.answeredAtMs} /> : null}
          <p className="mt-1 text-sm font-bold text-white/60">
            {state.phase === "ringing-outgoing" && "Calling…"}
            {state.phase === "ringing-incoming" && (state.media === "video" ? "Incoming video call" : "Incoming call")}
            {state.phase === "in-call" && (state.media === "video" ? "Video call" : "Voice call")}
          </p>
        </div>

        <div className="pointer-events-auto flex items-center gap-6">
          {state.phase === "ringing-incoming" ? (
            <>
              <RoundButton accessibilityLabel="Decline call" color="#E5484D" label="✕" onClick={onDecline} />
              <RoundButton accessibilityLabel="Answer call" color="#30A46C" label="✓" onClick={onAnswer} />
            </>
          ) : (
            <>
              {state.phase === "in-call" ? (
                <>
                  <RoundButton
                    accessibilityLabel={state.isMuted ? "Unmute microphone" : "Mute microphone"}
                    color={state.isMuted ? "#FFFFFF" : "rgba(255,255,255,0.25)"}
                    foreground={state.isMuted ? "#111111" : "#FFFFFF"}
                    label={state.isMuted ? "🔇" : "🎙"}
                    onClick={onToggleMute}
                  />
                  {state.media === "video" ? (
                    <RoundButton
                      accessibilityLabel={state.isCameraOn ? "Turn camera off" : "Turn camera on"}
                      color={state.isCameraOn ? "rgba(255,255,255,0.25)" : "#FFFFFF"}
                      foreground={state.isCameraOn ? "#FFFFFF" : "#111111"}
                      label="📷"
                      onClick={onToggleCamera}
                    />
                  ) : null}
                </>
              ) : null}
              <RoundButton accessibilityLabel="End call" color="#E5484D" label="✕" onClick={onHangUp} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function CallOverlayHost() {
  const { state, answer, decline, hangUp, toggleMute, toggleCamera } = useCalling();
  const peerPublicId = state.phase === "idle" ? null : state.peerPublicId;
  const [peerProfile, setPeerProfile] = useState<{
    publicId: string;
    displayName?: string;
    avatarUrl?: string;
  } | null>(null);

  useEffect(() => listenForRingtoneUnlock(), []);

  useEffect(() => {
    if (state.phase === "ringing-incoming") return startIncomingCallRingtone();
  }, [state.phase]);

  useEffect(() => {
    if (!peerPublicId) return;

    let cancelled = false;
    void getSocialProfile(peerPublicId)
      .then((profile) => {
        if (!cancelled) {
          setPeerProfile({
            publicId: peerPublicId,
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
          });
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [peerPublicId]);

  return (
    <CallOverlayComponent
      onAnswer={answer}
      onDecline={decline}
      onHangUp={hangUp}
      onToggleCamera={toggleCamera}
      onToggleMute={toggleMute}
      peerProfile={peerProfile?.publicId === peerPublicId ? peerProfile : null}
      state={state}
    />
  );
}
