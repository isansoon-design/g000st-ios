"use client";

import { useEffect, useRef } from "react";

import type { CallUiState } from "@/features/calling/call-manager";
import { useCalling } from "@/features/calling/use-calling";

function VideoSurface({ stream, muted, mirrored }: { stream?: MediaStream; muted: boolean; mirrored?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream ?? null;
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

function RoundButton({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button
      className="flex h-14 w-14 items-center justify-center rounded-full text-xl font-black text-white shadow-lg transition active:scale-95"
      onClick={onClick}
      style={{ background: color }}
      type="button"
    >
      {label}
    </button>
  );
}

function shortId(publicId: string): string {
  return `${publicId.slice(0, 12)}…${publicId.slice(-6)}`;
}

function CallOverlayComponent({
  state,
  onAnswer,
  onDecline,
  onHangUp,
  onToggleMute,
  onToggleCamera,
}: {
  state: CallUiState;
  onAnswer: () => void;
  onDecline: () => void;
  onHangUp: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
}) {
  if (state.phase === "idle") return null;

  const isVideo = state.media === "video";

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black text-white">
      {state.phase === "in-call" && isVideo && state.remoteStream ? (
        <VideoSurface muted={false} stream={state.remoteStream} />
      ) : (
        <div className="flex flex-1 items-center justify-center bg-[#111]">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/10 text-4xl">◎</div>
        </div>
      )}

      {state.phase === "in-call" && isVideo && state.isCameraOn && state.localStream ? (
        <div className="absolute right-4 top-4 h-32 w-24 overflow-hidden rounded-2xl border border-white/30 shadow-xl sm:h-40 sm:w-28">
          <VideoSurface mirrored muted stream={state.localStream} />
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-between px-6 py-10">
        <div className="pointer-events-auto text-center">
          <p className="font-mono text-lg font-black">{shortId(state.peerPublicId)}</p>
          <p className="mt-1 text-sm font-bold text-white/60">
            {state.phase === "ringing-outgoing" && "Calling…"}
            {state.phase === "ringing-incoming" && (state.media === "video" ? "Incoming video call" : "Incoming call")}
            {state.phase === "in-call" && (state.media === "video" ? "Video call" : "Voice call")}
          </p>
        </div>

        <div className="pointer-events-auto flex items-center gap-6">
          {state.phase === "ringing-incoming" ? (
            <>
              <RoundButton color="#E5484D" label="✕" onClick={onDecline} />
              <RoundButton color="#30A46C" label="✓" onClick={onAnswer} />
            </>
          ) : (
            <>
              {state.phase === "in-call" ? (
                <>
                  <RoundButton
                    color={state.isMuted ? "#FFFFFF" : "rgba(255,255,255,0.25)"}
                    label={state.isMuted ? "🔇" : "🎙"}
                    onClick={onToggleMute}
                  />
                  {state.media === "video" ? (
                    <RoundButton
                      color={state.isCameraOn ? "rgba(255,255,255,0.25)" : "#FFFFFF"}
                      label="📷"
                      onClick={onToggleCamera}
                    />
                  ) : null}
                </>
              ) : null}
              <RoundButton color="#E5484D" label="✕" onClick={onHangUp} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function CallOverlayHost() {
  const { state, answer, decline, hangUp, toggleMute, toggleCamera } = useCalling();

  return (
    <CallOverlayComponent
      onAnswer={answer}
      onDecline={decline}
      onHangUp={hangUp}
      onToggleCamera={toggleCamera}
      onToggleMute={toggleMute}
      state={state}
    />
  );
}
