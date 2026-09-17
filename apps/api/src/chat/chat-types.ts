export type ChatConversation = Readonly<{
  createdAtMs: number;
  id: string;
  participants: readonly [string, string];
  updatedAtMs: number;
}>;

export type ChatConversationSummary = Readonly<{
  conversationId: string;
  lastMessagePreview: string;
  lastMessageSenderId?: string;
  participantPublicId: string;
  unreadCount: number;
  updatedAtMs: number;
}>;

export type ChatMessage = Readonly<{
  clientMessageId: string;
  content: string;
  conversationId: string;
  createdAtMs: number;
  id: string;
  senderPublicId: string;
  type: 'text';
}>;

export type ChatMessagePage = Readonly<{
  messages: readonly ChatMessage[];
  nextBefore?: number;
}>;
