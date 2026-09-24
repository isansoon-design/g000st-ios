import { useEffect, useState } from 'react';

import { getSocialProfile } from '@/api/social';
import { CallOverlay } from '@/features/calling/components/call-overlay';
import { useCalling } from '@/features/calling/hooks/use-calling';

export function CallOverlayHost() {
  const { state, answer, decline, hangUp, toggleMute, toggleCamera } = useCalling();
  const peerPublicId = state.phase === 'idle' ? null : state.peerPublicId;
  const [peerProfile, setPeerProfile] = useState<{
    publicId: string;
    displayName?: string;
    avatarUrl?: string;
  } | null>(null);

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
    <CallOverlay
      state={state}
      onAnswer={answer}
      onDecline={decline}
      onHangUp={hangUp}
      onToggleMute={toggleMute}
      onToggleCamera={toggleCamera}
      peerProfile={peerProfile?.publicId === peerPublicId ? peerProfile : null}
    />
  );
}
