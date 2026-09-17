import axiosInstance from '@/api/axios';
import { parseApiPayload } from '@/api/parse-api-payload';
import {
  chatConversationListSchema,
  chatMessagePageSchema,
  sendChatMessageResultSchema,
  startChatConversationResultSchema,
} from '@/domain/chat/types';

export async function listChatConversations() {
  const response = await axiosInstance.get('/chat/conversations');
  return parseApiPayload(chatConversationListSchema, response.data).conversations;
}

export async function startChatConversation(participantPublicId: string) {
  const response = await axiosInstance.post('/chat/conversations', { participantPublicId });
  return parseApiPayload(startChatConversationResultSchema, response.data).conversation;
}

export async function listChatMessages(conversationId: string) {
  const response = await axiosInstance.get(`/chat/conversations/${conversationId}/messages`);
  return parseApiPayload(chatMessagePageSchema, response.data);
}

export async function sendChatTextMessage(
  conversationId: string,
  content: string,
  clientMessageId: string,
  burnAfterRead: boolean,
) {
  const response = await axiosInstance.post(`/chat/conversations/${conversationId}/messages`, {
    burnAfterRead,
    clientMessageId,
    content,
  });
  return parseApiPayload(sendChatMessageResultSchema, response.data).message;
}

export async function openChatBurnMessage(conversationId: string, messageId: string) {
  const response = await axiosInstance.post(
    `/chat/conversations/${conversationId}/messages/${messageId}/open`,
  );
  return parseApiPayload(sendChatMessageResultSchema, response.data).message;
}

export async function markChatConversationRead(conversationId: string): Promise<void> {
  await axiosInstance.post(`/chat/conversations/${conversationId}/read`);
}
