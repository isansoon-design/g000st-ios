import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/features/auth/hooks/use-auth';
import { copyText } from '@/services/device/clipboard';

export function useIdentityScreen() {
  const { signOut, user } = useAuth();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMessage(message);
    toastTimer.current = setTimeout(() => setToastMessage(null), 3_000);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const copyPublicId = useCallback(async () => {
    if (!user?.publicId) return;
    await copyText(user.publicId);
    showToast('Public ID copied.');
  }, [showToast, user]);

  return {
    copyPublicId,
    publicId: user?.publicId ?? '',
    signOut,
    toastMessage,
  };
}
