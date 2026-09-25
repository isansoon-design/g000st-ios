export type ChatConversation = Readonly<{
  createdAtMs: number;
  id: string;
  participants: readonly [string, string];
  updatedAtMs: number;
}>;

export type ChatConversationSummary = Readonly<{
  conversationId: string;
  firstUnreadCreatedAtMs?: number;
  firstUnreadExpiresAtMs?: number;
  firstUnreadMessageId?: string;
  lastMessageCreatedAtMs?: number;
  lastMessageId?: string;
  lastMessagePreview: string;
  lastMessageSenderId?: string;
  lastReadAtMs?: number;
  lastReadMessageId?: string;
  lastReadObservedAtMs?: number;
  participantDisplayName?: string;
  participantPublicId: string;
  participantStatus: "active" | "deleted";
  unreadCount: number;
  updatedAtMs: number;
}>;

export type ChatMessage = Readonly<{
  attachments?: readonly ChatAttachment[];
  burnAfterReadSeconds?: 5;
  burnStartedAtMs?: number;
  clientMessageId: string;
  content: string;
  conversationId: string;
  createdAtMs: number;
  editedAtMs?: number;
  expiresAtMs: number;
  id: string;
  locked: boolean;
  readAtMs?: number;
  senderPublicId: string;
  type: "text" | "voice";
}>;

export type ChatAttachment = Readonly<{
  byteSize: number;
  contentType: string;
  durationMs?: number;
  fileName: string;
  id: string;
  kind: "audio" | "document" | "image" | "video";
  objectKey: string;
}>;

export type ChatMessagePage = Readonly<{
  messages: readonly ChatMessage[];
  nextCursor?: string;
}>;
