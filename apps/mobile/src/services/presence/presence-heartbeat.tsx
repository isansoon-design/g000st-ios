import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { sendHeartbeat } from '@/api/presence';
import { useAuth } from '@/features/auth/hooks/use-auth';

const HEARTBEAT_INTERVAL_MS = 45 * 1_000;

function reportHeartbeatError(error: unknown): void {
  if (!__DEV__) return;
  console.warn(
    '[presence] Heartbeat failed:',
    error instanceof Error ? error.message : error,
  );
}

export function PresenceHeartbeat() {
  const { status } = useAuth();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (status !== 'authenticated') return;

    const beat = () => void sendHeartbeat().catch(reportHeartbeatError);

    beat();
    timerRef.current = setInterval(beat, HEARTBEAT_INTERVAL_MS);

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        beat();
        if (!timerRef.current) timerRef.current = setInterval(beat, HEARTBEAT_INTERVAL_MS);
      } else if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    });

    return () => {
      subscription.remove();
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [status]);

  return null;
}
