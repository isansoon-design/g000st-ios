"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TelnyxRTC, type Call } from "@telnyx/webrtc";

import { authorizeExternalCall, issueWebrtcCredential } from "@/app/api/mobile";
import { ApiError } from "@/app/api/api-error";

export type ExternalCallStatus = "idle" | "connecting" | "ringing" | "active" | "ended" | "error";

/**
 * Wraps the Telnyx WebRTC JS SDK for placing external (PSTN) calls straight from the browser —
 * there is no server-side call placement; the server only pre-authorizes on balance
 * (POST /telephony/calls) and issues a short-lived, server-signed credential
 * (POST /telephony/webrtc-credential) that this hook registers with directly. Billing
 * attribution on the backend comes from the credential's `clientState`, passed through
 * unmodified — never construct that value here.
 */
export function useExternalCall() {
  const [status, setStatus] = useState<ExternalCallStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const clientRef = useRef<TelnyxRTC | null>(null);
  const callRef = useRef<Call | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = document.createElement("audio");
    audio.autoplay = true;
    document.body.appendChild(audio);
    audioElementRef.current = audio;

    return () => {
      callRef.current?.hangup();
      clientRef.current?.disconnect();
      audio.remove();
    };
  }, []);

  const teardown = useCallback(() => {
    clientRef.current?.disconnect();
    clientRef.current = null;
    callRef.current = null;
    setIsMuted(false);
  }, []);

  const placeCall = useCallback(
    async (toE164: string) => {
      setErrorMessage(null);
      setErrorCode(null);
      setStatus("connecting");

      try {
        await authorizeExternalCall(toE164);
        const credential = await issueWebrtcCredential();

        const client = new TelnyxRTC({ login_token: credential.loginToken });
        clientRef.current = client;

        client.on("telnyx.error", (error: unknown) => {
          const message = (error as { message?: string } | undefined)?.message;
          setErrorMessage(message ?? "Call connection failed.");
          setStatus("error");
          teardown();
        });

        client.on("telnyx.notification", (notification: { type: string; call?: Call }) => {
          if (notification.type !== "callUpdate" || !notification.call) return;

          const state = notification.call.state;
          if (state === "new" || state === "trying" || state === "requesting" || state === "recovering") {
            setStatus("connecting");
          } else if (state === "ringing" || state === "answering" || state === "early") {
            setStatus("ringing");
          } else if (state === "active" || state === "held") {
            setStatus("active");
          } else if (state === "hangup" || state === "destroy" || state === "purge") {
            setStatus("ended");
            teardown();
          }
        });

        client.on("telnyx.ready", () => {
          callRef.current = client.newCall({
            destinationNumber: toE164,
            audio: true,
            clientState: credential.clientState,
            remoteElement: audioElementRef.current ?? undefined,
          });
        });

        client.connect();
      } catch (error) {
        const apiError = error instanceof ApiError ? error : null;
        setErrorMessage(apiError?.message ?? "Could not start the call.");
        setErrorCode(apiError?.code ?? null);
        setStatus("error");
        teardown();
      }
    },
    [teardown],
  );

  const hangup = useCallback(() => {
    callRef.current?.hangup();
    teardown();
    setStatus("ended");
  }, [teardown]);

  const toggleMute = useCallback(() => {
    if (!callRef.current) return;
    callRef.current.toggleAudioMute();
    setIsMuted((previous) => !previous);
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setErrorMessage(null);
    setErrorCode(null);
  }, []);

  return { status, errorMessage, errorCode, isMuted, placeCall, hangup, toggleMute, reset };
}
