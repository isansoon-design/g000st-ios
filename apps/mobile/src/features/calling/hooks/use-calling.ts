import { useCallback, useSyncExternalStore } from 'react';

import { callManager, type CallUiState } from '@/features/calling/call-manager';
import type { CallMedia } from '@/domain/calling/types';

export function useCalling() {
  const state: CallUiState = useSyncExternalStore(
    (listener) => callManager.subscribe(listener),
    () => callManager.getSnapshot(),
  );

  const callUser = useCallback(
    (peerPublicId: string, peerDisplayName: string | undefined, media: CallMedia) =>
      callManager.callUser(peerPublicId, peerDisplayName, media),
    [],
  );
  const answer = useCallback(() => callManager.answer(), []);
  const decline = useCallback(() => callManager.decline(), []);
  const hangUp = useCallback(() => callManager.hangUp(), []);
  const toggleMute = useCallback(() => callManager.toggleMute(), []);
  const toggleCamera = useCallback(() => callManager.toggleCamera(), []);

  return { state, callUser, answer, decline, hangUp, toggleMute, toggleCamera };
}
