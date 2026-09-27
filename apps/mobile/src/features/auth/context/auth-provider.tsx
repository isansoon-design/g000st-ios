import { type PropsWithChildren, useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { unregisterPushDevice } from '@/api/notifications';
import { listBeaconPages } from '@/api/auth';
import { unregisterVoipToken } from '@/api/calling';
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
import { setActingPublicId } from '@/services/session/acting-identity';

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [activePublicId, setActivePublicIdState] = useState<string | null>(null);

  const setActivePublicId = useCallback((publicId: string) => {
    setActingPublicId(publicId);
    setActivePublicIdState(publicId);
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    let active = true;

    const restorePersistedSession = async () => {
      try {
        const persisted = await sessionStorage.get();
        if (!active) return;

        setUser(persisted?.user ?? null);
        setActingPublicId(persisted?.user.publicId ?? null);
        setActivePublicIdState(persisted?.user.publicId ?? null);
        setStatus(persisted ? 'authenticated' : 'anonymous');
      } catch {
        if (!active) return;
        setUser(null);
        setActingPublicId(null);
        setActivePublicIdState(null);
        setStatus('anonymous');
      }
    };

    void restorePersistedSession();

    const unsubscribe = subscribeToSessionCleared(() => {
      if (!active) return;
      setUser(null);
      setActingPublicId(null);
      setActivePublicIdState(null);
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
    setActingPublicId(result.user.publicId);
    emitSessionChanged();
    setUser(result.user);
    setActivePublicIdState(result.user.publicId);
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
        const pages = await listBeaconPages();
        const actors = [current?.user.publicId, ...pages.map((page) => page.publicId)].filter((id): id is string => !!id);
        await Promise.allSettled(actors.flatMap((publicId) => [
          unregisterPushDevice(deviceId, publicId),
          unregisterVoipToken(deviceId, publicId),
        ]));
      } catch {
        // Signing out locally must still succeed if the device is offline.
      }
    }
    await sessionStorage.clear();
    setActingPublicId(null);
    setActivePublicIdState(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ activePublicId, setActivePublicId, completeAuthentication, signOut, status, user }),
    [activePublicId, setActivePublicId, completeAuthentication, signOut, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
