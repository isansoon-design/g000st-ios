import { CallOverlay } from '@/features/calling/components/call-overlay';
import { useCalling } from '@/features/calling/hooks/use-calling';

export function CallOverlayHost() {
  const { state, answer, decline, hangUp, toggleMute, toggleCamera } = useCalling();

  return (
    <CallOverlay
      state={state}
      onAnswer={answer}
      onDecline={decline}
      onHangUp={hangUp}
      onToggleMute={toggleMute}
      onToggleCamera={toggleCamera}
    />
  );
}
