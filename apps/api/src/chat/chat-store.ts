import type {
  ChatConversation,
  ChatConversationMemberSummary,
  ChatMessage,
  ChatMessageCursor,
  ChatMessagePage,
  ChatReadState,
} from './chat-types.js';

export type OpenBurnMessageResult =
  | Readonly<{ message: ChatMessage; status: 'opened' }>
  | Readonly<{ status: 'not_burnable' }>
  | Readonly<{ status: 'not_found' }>;

export type CreateTextMessageResult = Readonly<{
  created: boolean;
  message: ChatMessage;
}>;

export type EditMessageResult =
  | Readonly<{ status: 'updated'; message: ChatMessage }>
  | Readonly<{ status: 'not_found' | 'forbidden' | 'not_editable' }>;

export interface ChatStore {
  createTextMessage(message: ChatMessage): Promise<CreateTextMessageResult>;
  findMessage(conversationId: string, messageId: string): Promise<ChatMessage | null>;
  editMessage(conversationId: string, messageId: string, senderPublicId: string, content: string, nowMs: number): Promise<EditMessageResult>;
  findConversation(conversationId: string): Promise<ChatConversation | null>;
  findConversationMember(
    publicId: string,
    conversationId: string,
  ): Promise<ChatConversationMemberSummary | null>;
  getOrCreateConversation(
    firstPublicId: string,
    secondPublicId: string,
    nowMs: number,
  ): Promise<ChatConversation>;
  listConversations(
    publicId: string,
    limit: number,
    nowMs: number,
  ): Promise<readonly ChatConversationMemberSummary[]>;
  listMessages(
    conversationId: string,
    limit: number,
    nowMs: number,
    cursor?: ChatMessageCursor,
  ): Promise<ChatMessagePage>;
  markRead(conversationId: string, publicId: string, readAtMs: number): Promise<ChatReadState>;
  openBurnMessage(
    conversationId: string,
    messageId: string,
    publicId: string,
    nowMs: number,
  ): Promise<OpenBurnMessageResult>;
  purgeExpiredMessages(nowMs: number, limit: number): Promise<readonly ChatMessage[]>;
}
