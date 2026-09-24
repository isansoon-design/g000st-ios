"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MAX_DURATION_MS = 5 * 60 * 1_000;

export type RecordedVoiceMessage = Readonly<{
  durationMs: number;
  file: File;
  previewUrl: string;
}>;

function preferredMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function extensionFor(type: string): string {
  return type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
}

export function useVoiceRecorder() {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const [durationMs, setDurationMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<RecordedVoiceMessage | null>(null);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const discard = useCallback(() => {
    if (recording) URL.revokeObjectURL(recording.previewUrl);
    setRecording(null);
    setDurationMs(0);
    setError(null);
  }, [recording]);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
    recorderRef.current = null;
    chunksRef.current = [];
    releaseStream();
    setIsRecording(false);
    setDurationMs(0);
    setError(null);
  }, [releaseStream]);

  const start = useCallback(async () => {
    if (isRecording || recording) return;
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Voice recording is not supported by this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = preferredMimeType();
      const recorder = new MediaRecorder(stream, {
        audioBitsPerSecond: 64_000,
        ...(mimeType ? { mimeType } : {}),
      });
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorderRef.current = recorder;
      streamRef.current = stream;
      startedAtRef.current = Date.now();
      setDurationMs(0);
      setIsRecording(true);
      recorder.start(250);
    } catch {
      releaseStream();
      setError("Microphone access is required to record a voice message.");
    }
  }, [isRecording, recording, releaseStream]);

  const stop = useCallback(async (): Promise<RecordedVoiceMessage | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return null;
    const elapsed = Math.max(1, Math.min(MAX_DURATION_MS, Date.now() - startedAtRef.current));
    const completed = new Promise<RecordedVoiceMessage | null>((resolve) => {
      recorder.onstop = () => {
        const recorderType = recorder.mimeType || "audio/webm";
        const contentType = recorderType.split(";", 1)[0] || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: recorderType });
        chunksRef.current = [];
        releaseStream();
        recorderRef.current = null;
        setIsRecording(false);
        if (!blob.size) {
          setError("No audio was captured. Please try again.");
          resolve(null);
          return;
        }
        const file = new File(
          [blob],
          `voice-${Date.now()}.${extensionFor(contentType)}`,
          { type: contentType },
        );
        const next = { durationMs: elapsed, file, previewUrl: URL.createObjectURL(blob) };
        setDurationMs(elapsed);
        setRecording(next);
        resolve(next);
      };
    });
    recorder.stop();
    return completed;
  }, [releaseStream]);

  useEffect(() => {
    if (!isRecording) return;
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      setDurationMs(Math.min(elapsed, MAX_DURATION_MS));
      if (elapsed >= MAX_DURATION_MS) void stop();
    }, 100);
    return () => window.clearInterval(timer);
  }, [isRecording, stop]);

  useEffect(() => () => {
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
    releaseStream();
  }, [releaseStream]);

  return { cancel, discard, durationMs, error, isRecording, recording, start, stop };
}
