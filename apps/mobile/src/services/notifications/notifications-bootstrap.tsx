import Constants from 'expo-constants';
import { useAudioPlayer } from 'expo-audio';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { listChatConversations } from '@/api/chat';
import { listBeaconPages } from '@/api/auth';
import { registerPushDevice } from '@/api/notifications';
import { env } from '@/config/env';
import { useAuth } from '@/features/auth/hooks/use-auth';
import {
  chatConversationsQueryKey,
  chatMessagesQueryKey,
} from '@/features/chat/query-keys';
import { chatConversationHref } from '@/features/chat/navigation';
import {
  conversationIdFromNotification,
  isFocusedConversationNotification,
} from '@/services/notifications/chat-notification-presentation';
import { getOrCreatePushDeviceId } from '@/services/notifications/device-id';
import { iosFcmToken, iosFirebaseMessaging } from './ios-firebase';
import { openNotificationPath } from '@/features/notifications/notification-navigation';

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const isFocusedConversation =
      isFocusedConversationNotification(notification);

    return {
      shouldPlaySound: !isFocusedConversation,
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
  ownerPublicId: string,
  devicePushToken?: Notifications.DevicePushToken,
): Promise<void> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
  const platform = Platform.OS;

  const projectId =
    env.easProjectId ??
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
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
    await Notifications.setNotificationChannelAsync('activity', {
      importance: Notifications.AndroidImportance.DEFAULT,
      name: 'Activity and account updates',
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  const permission =
    existing.granted ? existing : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return;

  const deviceId = await getOrCreatePushDeviceId();
  const fcmToken = platform === 'android'
    ? String((devicePushToken ?? await Notifications.getDevicePushTokenAsync()).data)
    : await iosFcmToken().catch(() => null);
  const expoToken = !fcmToken && typeof projectId === 'string' && projectId
    ? (await Notifications.getExpoPushTokenAsync({ projectId })).data : null;
  if (!fcmToken && !expoToken) return;
  const pages = await listBeaconPages();
  await Promise.all([ownerPublicId, ...pages.map((page) => page.publicId)].map((actorPublicId) => registerPushDevice({
    deviceId,
    ...(fcmToken ? { fcmToken } : { expoPushToken: expoToken! }),
    platform,
  }, actorPublicId)));
}

export function NotificationsBootstrap() {
  const { activePublicId, setActivePublicId, status, user } = useAuth();
  const queryClient = useQueryClient();
  const pendingResponse = useRef<Notifications.NotificationResponse | null>(null);
  const focusedMessagePlayer = useAudioPlayer(require('../../../assets/sounds/focused-message.wav'));

  useEffect(() => {
    if (status !== 'authenticated' || !user) return;

    let isActive = true;

    void registerCurrentDevice(user.publicId).catch(reportRegistrationError);
    const tokenSubscription = Notifications.addPushTokenListener((devicePushToken) => {
      void registerCurrentDevice(user.publicId, devicePushToken).catch(reportRegistrationError);
    });

    const refreshChat = (notification: Notifications.Notification) => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      const conversationId = conversationIdFromNotification(notification);
      if (isFocusedConversationNotification(notification)) {
        void focusedMessagePlayer.seekTo(0)
          .then(() => focusedMessagePlayer.play())
          .catch(() => undefined);
      }
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

      const recipientId = response.notification.request.content.data?.recipientPublicId;
      if (typeof recipientId === 'string' && recipientId !== activePublicId) {
        const pages = await listBeaconPages().catch(() => []);
        if (recipientId !== user.publicId && !pages.some((page) => page.publicId === recipientId)) return;
        pendingResponse.current = response;
        setActivePublicId(recipientId);
        return;
      }

      const conversationId = conversationIdFromNotification(response.notification);
      if (!conversationId) {
        const path = response.notification.request.content.data?.path;
        if (typeof path === 'string') openNotificationPath(path);
        Notifications.clearLastNotificationResponse();
        return;
      }

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
      router.push(chatConversationHref(conversationId, response.notification.request.identifier), { withAnchor: true });
      Notifications.clearLastNotificationResponse();
    };

    const notificationSubscription =
      Notifications.addNotificationReceivedListener(refreshChat);
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        void openConversation(response);
      },
    );
    const resume = pendingResponse.current;
    pendingResponse.current = null;
    void openConversation(resume ?? Notifications.getLastNotificationResponse());

    let firebaseCleanup: (() => void) | null = null;
    void (async () => {
      const messaging = await iosFirebaseMessaging();
      if (!messaging || !isActive) return;
      const { onMessage, onTokenRefresh, onNotificationOpenedApp, getInitialNotification } = await import('@react-native-firebase/messaging');
      const toResponse = (message: { messageId?: string; data?: Record<string, string | object> }) => ({
        actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
        notification: { request: { identifier: message.messageId ?? 'fcm', content: { data: message.data ?? {} } } },
      } as Notifications.NotificationResponse);
      const removeMessage = onMessage(messaging, (message) => {
        if (!isActive) return;
        const response = toResponse(message);
        refreshChat(response.notification);
        if (!isFocusedConversationNotification(response.notification)) void Notifications.scheduleNotificationAsync({
          content: { title: message.notification?.title ?? 'g000st', body: message.notification?.body ?? 'You have a new notification.', data: message.data, sound: 'default' }, trigger: null,
        }).catch(() => undefined);
      });
      const removeToken = onTokenRefresh(messaging, () => { if (isActive) void registerCurrentDevice(user.publicId).catch(reportRegistrationError); });
      const removeOpened = onNotificationOpenedApp(messaging, (message) => { if (isActive) void openConversation(toResponse(message)); });
      firebaseCleanup = () => { removeMessage(); removeToken(); removeOpened(); };
      const initial = await getInitialNotification(messaging);
      if (initial && isActive) void openConversation(toResponse(initial));
      if (!isActive) firebaseCleanup();
    })().catch(reportRegistrationError);

    return () => {
      isActive = false;
      notificationSubscription.remove();
      responseSubscription.remove();
      tokenSubscription.remove();
      firebaseCleanup?.();
    };
  }, [activePublicId, focusedMessagePlayer, queryClient, setActivePublicId, status, user]);

  return null;
}
