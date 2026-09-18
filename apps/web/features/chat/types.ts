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
  participantPublicId: string;
  participantStatus: "active" | "deleted";
  unreadCount: number;
  updatedAtMs: number;
}>;

export type ChatMessage = Readonly<{
  burnAfterReadSeconds?: 5;
  burnStartedAtMs?: number;
  clientMessageId: string;
  content: string;
  conversationId: string;
  createdAtMs: number;
  expiresAtMs: number;
  id: string;
  locked: boolean;
  readAtMs?: number;
  senderPublicId: string;
  type: "text";
}>;

export type ChatMessagePage = Readonly<{
  messages: readonly ChatMessage[];
  nextCursor?: string;
}>;
