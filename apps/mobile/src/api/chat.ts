import axiosInstance from '@/api/axios';
import { parseApiPayload } from '@/api/parse-api-payload';
import {
  chatConversationListSchema,
  chatMessagePageSchema,
  sendChatMessageResultSchema,
  startChatConversationResultSchema,
} from '@/domain/chat/types';
import type { PendingChatAttachment } from '@/api/media';
import { z } from 'zod';

const attachmentDownloadSchema = z.object({
  attachment: z.object({ downloadUrl: z.url() }),
});

export async function listChatConversations() {
  const response = await axiosInstance.get('/chat/conversations');
  return parseApiPayload(chatConversationListSchema, response.data).conversations;
}

export async function startChatConversation(participantPublicId: string) {
  const response = await axiosInstance.post('/chat/conversations', { participantPublicId });
  return parseApiPayload(startChatConversationResultSchema, response.data).conversation;
}

export async function listChatMessages(conversationId: string, cursor?: string) {
  const response = await axiosInstance.get(`/chat/conversations/${conversationId}/messages`, {
    params: { cursor, limit: 50 },
  });
  return parseApiPayload(chatMessagePageSchema, response.data);
}

export async function sendChatMessage(
  conversationId: string,
  content: string,
  clientMessageId: string,
  burnAfterRead: boolean,
  attachments?: readonly PendingChatAttachment[],
) {
  const response = await axiosInstance.post(`/chat/conversations/${conversationId}/messages`, {
    burnAfterRead,
    clientMessageId,
    content,
    ...(attachments?.length ? { attachments } : {}),
  });
  return parseApiPayload(sendChatMessageResultSchema, response.data).message;
}

export async function openChatBurnMessage(conversationId: string, messageId: string) {
  const response = await axiosInstance.post(
    `/chat/conversations/${conversationId}/messages/${messageId}/open`,
  );
  return parseApiPayload(sendChatMessageResultSchema, response.data).message;
}

export async function editChatMessage(conversationId: string, messageId: string, content: string) {
  const response = await axiosInstance.patch(`/chat/conversations/${conversationId}/messages/${messageId}`, { content });
  return parseApiPayload(sendChatMessageResultSchema, response.data).message;
}

export async function markChatConversationRead(conversationId: string): Promise<void> {
  await axiosInstance.post(`/chat/conversations/${conversationId}/read`);
}

export async function getChatAttachmentDownload(
  conversationId: string,
  messageId: string,
  attachmentId: string,
): Promise<string> {
  const response = await axiosInstance.get(
    `/chat/conversations/${conversationId}/messages/${messageId}/attachments/${attachmentId}`,
  );
  return parseApiPayload(attachmentDownloadSchema, response.data).attachment.downloadUrl;
}
