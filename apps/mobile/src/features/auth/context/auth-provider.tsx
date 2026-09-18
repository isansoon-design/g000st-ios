import { type PropsWithChildren, useCallback, useEffect, useMemo, useState } from 'react';

import { unregisterPushDevice } from '@/api/notifications';
import type { AuthenticationResult, AuthenticatedUser } from '@/domain/auth/types';
import {
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
} from '@/features/auth/context/auth-context';
import { subscribeToSessionCleared } from '@/services/session/session-events';
import { getPushDeviceId } from '@/services/notifications/device-id';
import { sessionStorage } from '@/services/session/session-storage';

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthenticatedUser | null>(null);

  useEffect(() => {
    let active = true;

    const restorePersistedSession = async () => {
      try {
        const persisted = await sessionStorage.get();
        if (!active) return;

        setUser(persisted?.user ?? null);
        setStatus(persisted ? 'authenticated' : 'anonymous');
      } catch {
        if (!active) return;
        setUser(null);
        setStatus('anonymous');
      }
    };

    void restorePersistedSession();

    const unsubscribe = subscribeToSessionCleared(() => {
      if (!active) return;
      setUser(null);
      setStatus('anonymous');
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const completeAuthentication = useCallback(async (result: AuthenticationResult) => {
    await sessionStorage.save({ tokens: result.session, user: result.user });
    setUser(result.user);
    setStatus('authenticated');
  }, []);

  const signOut = useCallback(async () => {
    const deviceId = await getPushDeviceId();
    if (deviceId) {
      try {
        await unregisterPushDevice(deviceId);
      } catch {
        // Signing out locally must still succeed if the device is offline.
      }
    }
    await sessionStorage.clear();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ completeAuthentication, signOut, status, user }),
    [completeAuthentication, signOut, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
