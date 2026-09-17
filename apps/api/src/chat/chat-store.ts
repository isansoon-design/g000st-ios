import type {
  ChatConversation,
  ChatConversationSummary,
  ChatMessage,
  ChatMessagePage,
} from './chat-types.js';

export type OpenBurnMessageResult =
  | Readonly<{ message: ChatMessage; status: 'opened' }>
  | Readonly<{ status: 'not_burnable' }>
  | Readonly<{ status: 'not_found' }>;

export interface ChatStore {
  createTextMessage(message: ChatMessage): Promise<ChatMessage>;
  findConversation(conversationId: string): Promise<ChatConversation | null>;
  getOrCreateConversation(
    firstPublicId: string,
    secondPublicId: string,
    nowMs: number,
  ): Promise<ChatConversation>;
  listConversations(publicId: string, limit: number): Promise<readonly ChatConversationSummary[]>;
  listMessages(
    conversationId: string,
    limit: number,
    nowMs: number,
    beforeMs?: number,
  ): Promise<ChatMessagePage>;
  markRead(conversationId: string, publicId: string, readAtMs: number): Promise<void>;
  openBurnMessage(
    conversationId: string,
    messageId: string,
    publicId: string,
    nowMs: number,
  ): Promise<OpenBurnMessageResult>;
  purgeExpiredMessages(nowMs: number, limit: number): Promise<number>;
}
