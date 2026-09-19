import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { listChatConversations } from '@/api/chat';
import { registerPushDevice } from '@/api/notifications';
import { env } from '@/config/env';
import { useAuth } from '@/features/auth/hooks/use-auth';
import {
  chatConversationsQueryKey,
  chatMessagesQueryKey,
} from '@/features/chat/query-keys';
import {
  conversationIdFromNotification,
  isFocusedConversationNotification,
} from '@/services/notifications/chat-notification-presentation';
import { getOrCreatePushDeviceId } from '@/services/notifications/device-id';

let registrationInFlight: Promise<void> | null = null;

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const isFocusedConversation =
      isFocusedConversationNotification(notification);

    return {
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: !isFocusedConversation,
      shouldShowList: !isFocusedConversation,
    };
  },
});

function reportRegistrationError(error: unknown): void {
  if (!__DEV__) return;
  console.warn(
    '[notifications] Push registration failed:',
    error instanceof Error ? error.message : error,
  );
}

async function registerCurrentDevice(
  devicePushToken?: Notifications.DevicePushToken,
): Promise<void> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;

  const projectId =
    env.easProjectId ??
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (typeof projectId !== 'string' || !projectId) {
    throw new Error(
      'Missing EAS project ID. Set EXPO_PUBLIC_EAS_PROJECT_ID or link this app to an EAS project.',
    );
  }

  if (Platform.OS === 'android') {
    const currentChannel =
      await Notifications.getNotificationChannelAsync('messages');
    if (currentChannel?.sound === 'custom') {
      await Notifications.deleteNotificationChannelAsync('messages');
    }
    await Notifications.setNotificationChannelAsync('messages', {
      importance: Notifications.AndroidImportance.MAX,
      name: 'Private messages',
      vibrationPattern: [0, 250, 200, 250],
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  const permission =
    existing.granted ? existing : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return;

  const [deviceId, token] = await Promise.all([
    getOrCreatePushDeviceId(),
    Notifications.getExpoPushTokenAsync({
      ...(devicePushToken ? { devicePushToken } : {}),
      projectId,
    }),
  ]);
  await registerPushDevice({
    deviceId,
    expoPushToken: token.data,
    platform: Platform.OS,
  });
}

function registerCurrentDeviceOnce(
  devicePushToken?: Notifications.DevicePushToken,
): Promise<void> {
  if (registrationInFlight) return registrationInFlight;

  registrationInFlight = registerCurrentDevice(devicePushToken).finally(() => {
    registrationInFlight = null;
  });
  return registrationInFlight;
}

export function NotificationsBootstrap() {
  const { status } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (status !== 'authenticated') return;

    let isActive = true;

    void registerCurrentDeviceOnce().catch(reportRegistrationError);
    const tokenSubscription = Notifications.addPushTokenListener((devicePushToken) => {
      void registerCurrentDeviceOnce(devicePushToken).catch(reportRegistrationError);
    });

    const refreshChat = (notification: Notifications.Notification) => {
      const conversationId = conversationIdFromNotification(notification);
      void queryClient.invalidateQueries({ queryKey: chatConversationsQueryKey });
      if (conversationId) {
        void queryClient.invalidateQueries({
          queryKey: chatMessagesQueryKey(conversationId),
        });
      }
    };

    const openConversation = async (
      response: Notifications.NotificationResponse | null | undefined,
    ) => {
      if (
        !response ||
        response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER
      ) {
        return;
      }

      const conversationId = conversationIdFromNotification(response.notification);
      if (!conversationId) return;

      try {
        await queryClient.fetchQuery({
          queryKey: chatConversationsQueryKey,
          queryFn: listChatConversations,
          staleTime: 0,
        });
      } catch {
        // Navigation still works offline and the chat screen exposes its retry state.
      }
      if (!isActive) return;

      void queryClient.invalidateQueries({
        queryKey: chatMessagesQueryKey(conversationId),
      });
      router.push({
        pathname: '/(app)/(tabs)/chat',
        params: {
          conversationId,
          notificationRequestId: response.notification.request.identifier,
        },
      });
      Notifications.clearLastNotificationResponse();
    };

    const notificationSubscription =
      Notifications.addNotificationReceivedListener(refreshChat);
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        void openConversation(response);
      },
    );
    void openConversation(Notifications.getLastNotificationResponse());

    return () => {
      isActive = false;
      notificationSubscription.remove();
      responseSubscription.remove();
      tokenSubscription.remove();
    };
  }, [queryClient, status]);

  return null;
}
