import type {
  ChatConversation,
  ChatConversationSummary,
  ChatMessage,
  ChatMessagePage,
} from './chat-types.js';

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
    beforeMs?: number,
  ): Promise<ChatMessagePage>;
  markRead(conversationId: string, publicId: string, readAtMs: number): Promise<void>;
}
