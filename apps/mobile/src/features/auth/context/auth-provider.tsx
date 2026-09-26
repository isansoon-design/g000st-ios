import { type PropsWithChildren, useCallback, useEffect, useMemo, useState } from 'react';

import { unregisterPushDevice } from '@/api/notifications';
import { getSocialProfile } from '@/api/social';
import type { AuthenticationResult, AuthenticatedUser } from '@/domain/auth/types';
import {
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
} from '@/features/auth/context/auth-context';
import { emitSessionChanged, subscribeToSessionCleared } from '@/services/session/session-events';
import { getPushDeviceId } from '@/services/notifications/device-id';
import { sessionStorage } from '@/services/session/session-storage';
import { recoveryIdStorage } from '@/services/session/recovery-id-storage';
import { savedAccounts } from '@/services/session/saved-accounts';

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

  const completeAuthentication = useCallback(async (result: AuthenticationResult, recoveryId: string) => {
    await sessionStorage.save({ tokens: result.session, user: result.user });
    try {
      await savedAccounts.save(result.user.publicId, recoveryId);
      await recoveryIdStorage.save(result.user.publicId, recoveryId);
    } catch (error) {
      await sessionStorage.clear();
      throw error;
    }
    emitSessionChanged();
    setUser(result.user);
    setStatus('authenticated');
    void getSocialProfile(result.user.publicId).then((profile) => savedAccounts.updateProfile(profile)).catch(() => undefined);
  }, []);

  const signOut = useCallback(async (forgetAccount = false) => {
    const current = await sessionStorage.get();
    if (current && !forgetAccount) {
      const recoveryId = await recoveryIdStorage.get(current.user.publicId);
      if (recoveryId) await savedAccounts.save(current.user.publicId, recoveryId);
    }
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
