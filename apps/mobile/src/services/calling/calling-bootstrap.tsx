import { useEffect } from 'react';

import { useAuth } from '@/features/auth/hooks/use-auth';
import { callManager } from '@/features/calling/call-manager';

export function CallingBootstrap() {
  const { status } = useAuth();

  useEffect(() => {
    if (status !== 'authenticated') return;

    callManager.start();
    return () => callManager.stop();
  }, [status]);

  return null;
}
