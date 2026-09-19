import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const CONVERSATION_ID_PATTERN = /^[a-f0-9]{64}$/;

let focusedConversationId: string | null = null;

export function conversationIdFromNotification(
  notification: Notifications.Notification | null | undefined,
): string | null {
  const value = notification?.request.content.data?.conversationId;
  return typeof value === "string" && CONVERSATION_ID_PATTERN.test(value)
    ? value
    : null;
}

export function isFocusedConversationNotification(
  notification: Notifications.Notification,
): boolean {
  const conversationId = conversationIdFromNotification(notification);
  return conversationId !== null && conversationId === focusedConversationId;
}

export function focusConversationNotifications(
  conversationId: string,
): () => void {
  focusedConversationId = conversationId;

  return () => {
    if (focusedConversationId === conversationId) {
      focusedConversationId = null;
    }
  };
}

export async function dismissConversationNotifications(
  conversationId: string,
): Promise<void> {
  if (Platform.OS !== "android" && Platform.OS !== "ios") return;

  const presentedNotifications =
    await Notifications.getPresentedNotificationsAsync();
  const matchingNotificationIds = presentedNotifications
    .filter(
      (notification) =>
        conversationIdFromNotification(notification) === conversationId,
    )
    .map((notification) => notification.request.identifier);

  await Promise.all(
    matchingNotificationIds.map((notificationId) =>
      Notifications.dismissNotificationAsync(notificationId),
    ),
  );
}
