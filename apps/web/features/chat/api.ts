import axios from "@/app/api/axios";
import type {
  ChatConversation,
  ChatConversationSummary,
  ChatMessage,
  ChatMessagePage,
} from "@/features/chat/types";

export async function listChatConversations(): Promise<readonly ChatConversationSummary[]> {
  const response = await axios.get<{ conversations: ChatConversationSummary[] }>(
    "/chat/conversations",
  );
  return response.data.conversations;
}

export async function startChatConversation(
  participantPublicId: string,
): Promise<ChatConversation> {
  const response = await axios.post<{ conversation: ChatConversation }>("/chat/conversations", {
    participantPublicId,
  });
  return response.data.conversation;
}

export async function listChatMessages(
  conversationId: string,
  cursor?: string,
): Promise<ChatMessagePage> {
  const response = await axios.get<ChatMessagePage>(
    `/chat/conversations/${conversationId}/messages`,
    { params: { cursor, limit: 50 } },
  );
  return response.data;
}

export async function sendChatTextMessage(
  conversationId: string,
  content: string,
  burnAfterRead: boolean,
): Promise<ChatMessage> {
  const response = await axios.post<{ message: ChatMessage }>(
    `/chat/conversations/${conversationId}/messages`,
    { burnAfterRead, clientMessageId: crypto.randomUUID(), content },
  );
  return response.data.message;
}

export async function openChatBurnMessage(
  conversationId: string,
  messageId: string,
): Promise<ChatMessage> {
  const response = await axios.post<{ message: ChatMessage }>(
    `/chat/conversations/${conversationId}/messages/${messageId}/open`,
  );
  return response.data.message;
}

export async function markChatConversationRead(conversationId: string): Promise<void> {
  await axios.post(`/chat/conversations/${conversationId}/read`);
}
