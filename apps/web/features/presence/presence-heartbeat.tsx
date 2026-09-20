"use client";

import { useEffect } from "react";

import { sendHeartbeat } from "@/app/api/presence";

const HEARTBEAT_INTERVAL_MS = 45 * 1_000;

export function PresenceHeartbeat() {
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const beat = () => void sendHeartbeat().catch(() => undefined);

    const start = () => {
      if (timer) return;
      beat();
      timer = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    };

    const stop = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    };

    if (document.visibilityState === "visible") start();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      stop();
    };
  }, []);

  return null;
}
