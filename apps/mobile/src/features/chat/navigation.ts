export function chatConversationHref(conversationId: string, notificationRequestId?: string) {
  return {
    pathname: '/(app)/(tabs)/chat/[conversationId]' as const,
    params: {
      conversationId,
      ...(notificationRequestId ? { notificationRequestId } : {}),
    },
  };
}
