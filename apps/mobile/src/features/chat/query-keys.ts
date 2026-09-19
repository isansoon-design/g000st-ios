export const chatConversationsQueryKey = ["chat", "conversations"] as const;

export function chatMessagesQueryKey(conversationId: string) {
  return ["chat", "messages", conversationId] as const;
}
