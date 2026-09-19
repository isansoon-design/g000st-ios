export type ChatConversation = Readonly<{
  createdAtMs: number;
  id: string;
  participants: readonly [string, string];
  updatedAtMs: number;
}>;

export type ChatConversationMemberSummary = Readonly<{
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
  unreadCount: number;
  updatedAtMs: number;
}>;

export type ChatConversationSummary = ChatConversationMemberSummary &
  Readonly<{ participantStatus: 'active' | 'deleted' }>;

export type ChatMessage = Readonly<{
  attachments?: readonly ChatAttachment[];
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
  type: 'text';
}>;

export type ChatAttachmentKind = 'document' | 'image' | 'video';

export type ChatAttachment = Readonly<{
  byteSize: number;
  contentType: string;
  fileName: string;
  id: string;
  kind: ChatAttachmentKind;
  objectKey: string;
}>;

export type ChatMessageCursor = Readonly<{
  createdAtMs: number;
  id: string;
}>;

export type ChatMessagePage = Readonly<{
  messages: readonly ChatMessage[];
  nextCursor?: string;
}>;

export type ChatReadState = Readonly<{
  lastReadAtMs?: number;
  lastReadMessageId?: string;
  unreadCount: number;
}>;
