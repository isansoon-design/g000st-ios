"use client";

import { useCallback, useSyncExternalStore } from "react";

import { callManager, type CallUiState } from "@/features/calling/call-manager";
import type { CallMedia } from "@/features/calling/types";

export function useCalling() {
  const state: CallUiState = useSyncExternalStore(
    (listener) => callManager.subscribe(listener),
    () => callManager.getSnapshot(),
    () => ({ phase: "idle" }) as CallUiState,
  );

  const callUser = useCallback((peerPublicId: string, media: CallMedia) => callManager.callUser(peerPublicId, media), []);
  const answer = useCallback(() => callManager.answer(), []);
  const decline = useCallback(() => callManager.decline(), []);
  const hangUp = useCallback(() => callManager.hangUp(), []);
  const toggleMute = useCallback(() => callManager.toggleMute(), []);
  const toggleCamera = useCallback(() => callManager.toggleCamera(), []);

  return { state, callUser, answer, decline, hangUp, toggleMute, toggleCamera };
}
