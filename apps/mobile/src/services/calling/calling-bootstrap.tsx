import { useEffect } from 'react';
import { addCallSessionAddedListener, addVoIPPushTokenUpdatedListener, getActiveCallSession, getVoIPPushToken, type CallSession } from 'expo-callkit-telecom';

import { listBeaconPages } from '@/api/auth';
import { registerVoipToken } from '@/api/calling';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { callManager } from '@/features/calling/call-manager';
import { getOrCreatePushDeviceId } from '@/services/notifications/device-id';

export function CallingBootstrap() {
  const { activePublicId, setActivePublicId, status, user } = useAuth();

  useEffect(() => {
    if (status !== 'authenticated' || !user) return;
    let current = true;
    const ensureIncomingActor = async (session: CallSession | null): Promise<boolean> => {
      if (!session || session.origin !== 'incoming' || session.status === 'ended') return false;
      const recipient = session.incomingCallEvent?.metadata?.recipientPublicId;
      if (typeof recipient !== 'string' || recipient === activePublicId) return false;
      const pages = await listBeaconPages();
      if (!current || (recipient !== user.publicId && !pages.some((page) => page.publicId === recipient))) return false;
      setActivePublicId(recipient);
      return true;
    };
    const registerPages = async (token: string, type: 'APNS_VOIP' | 'FCM') => {
      const [pages, deviceId] = await Promise.all([listBeaconPages(), getOrCreatePushDeviceId()]);
      if (!current) return;
      await Promise.all(pages.map((page) => registerVoipToken(deviceId, type, token, page.publicId)));
    };
    const subscription = addCallSessionAddedListener((event) => { void ensureIncomingActor(event.session).catch(() => undefined); });
    const tokenSubscription = addVoIPPushTokenUpdatedListener((event) => {
      if (event.token) void registerPages(event.token, event.type === 'APNS_VOIP' ? 'APNS_VOIP' : 'FCM').catch(() => undefined);
    });
    void (async () => {
      try {
        if (await ensureIncomingActor(await getActiveCallSession()) || !current) return;
      } catch { /* Continue with the selected identity. */ }
      callManager.start();
      const token = getVoIPPushToken();
      if (token?.token) void registerPages(token.token, token.type === 'APNS_VOIP' ? 'APNS_VOIP' : 'FCM').catch(() => undefined);
    })();
    return () => { current = false; subscription.remove(); tokenSubscription.remove(); callManager.stop(); };
  }, [activePublicId, setActivePublicId, status, user]);

  return null;
}
