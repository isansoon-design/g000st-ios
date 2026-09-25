import axios from "@/app/api/axios";
import type {
  ChatAttachment,
  ChatConversation,
  ChatConversationSummary,
  ChatMessage,
  ChatMessagePage,
} from "@/features/chat/types";

export type PendingChatAttachment = Omit<ChatAttachment, "kind">;

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

export async function sendChatMessage(
  conversationId: string,
  content: string,
  burnAfterRead: boolean,
  clientMessageId: string,
  attachments?: readonly PendingChatAttachment[],
): Promise<ChatMessage> {
  const response = await axios.post<{ message: ChatMessage }>(
    `/chat/conversations/${conversationId}/messages`,
    { burnAfterRead, clientMessageId, content, ...(attachments?.length ? { attachments } : {}) },
  );
  return response.data.message;
}

export async function createChatAttachmentUpload(input: Readonly<{
  byteSize: number;
  clientMessageId: string;
  contentType: string;
  conversationId: string;
  durationMs?: number;
  fileName: string;
}>) {
  const response = await axios.post<{
    upload: { attachment: PendingChatAttachment; headers: Record<string, string>; uploadUrl: string };
  }>("/media/uploads", input);
  return response.data.upload;
}

export async function getChatAttachmentDownload(
  conversationId: string,
  messageId: string,
  attachmentId: string,
): Promise<string> {
  const response = await axios.get<{ attachment: { downloadUrl: string } }>(
    `/chat/conversations/${conversationId}/messages/${messageId}/attachments/${attachmentId}`,
  );
  return response.data.attachment.downloadUrl;
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

export async function editChatMessage(conversationId: string, messageId: string, content: string): Promise<ChatMessage> {
  const response = await axios.patch<{ message: ChatMessage }>(`/chat/conversations/${conversationId}/messages/${messageId}`, { content });
  return response.data.message;
}

export async function markChatConversationRead(conversationId: string): Promise<void> {
  await axios.post(`/chat/conversations/${conversationId}/read`);
}
