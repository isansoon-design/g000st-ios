import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { registerPushDevice } from '@/api/notifications';
import { env } from '@/config/env';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { getOrCreatePushDeviceId } from '@/services/notifications/device-id';

const CONVERSATION_ID_PATTERN = /^[a-f0-9]{64}$/;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function conversationIdFromResponse(
  response: Notifications.NotificationResponse | null | undefined,
): string | null {
  const value = response?.notification.request.content.data?.conversationId;
  return typeof value === 'string' && CONVERSATION_ID_PATTERN.test(value) ? value : null;
}

async function registerCurrentDevice(): Promise<void> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;

  const projectId =
    env.easProjectId ??
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (typeof projectId !== 'string' || !projectId) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('messages', {
      importance: Notifications.AndroidImportance.HIGH,
      name: 'Private messages',
      sound: 'default',
      vibrationPattern: [0, 250, 200, 250],
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  const permission =
    existing.granted ? existing : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return;

  const [deviceId, token] = await Promise.all([
    getOrCreatePushDeviceId(),
    Notifications.getExpoPushTokenAsync({ projectId }),
  ]);
  await registerPushDevice({
    deviceId,
    expoPushToken: token.data,
    platform: Platform.OS,
  });
}

export function NotificationsBootstrap() {
  const { status } = useAuth();

  useEffect(() => {
    if (status !== 'authenticated') return;

    void registerCurrentDevice().catch(() => undefined);
    const tokenSubscription = Notifications.addPushTokenListener(() => {
      void registerCurrentDevice().catch(() => undefined);
    });

    const openConversation = (response: Notifications.NotificationResponse | null | undefined) => {
      const conversationId = conversationIdFromResponse(response);
      if (!conversationId) return;
      router.push({
        pathname: '/(app)/(tabs)/chat',
        params: { conversationId, notificationRequestId: Date.now().toString() },
      });
    };

    openConversation(Notifications.getLastNotificationResponse());
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      openConversation,
    );

    return () => {
      responseSubscription.remove();
      tokenSubscription.remove();
    };
  }, [status]);

  return null;
}
