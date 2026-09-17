import { randomUUID } from 'node:crypto';

import type { AuthStore } from '../auth/auth-store.js';
import { ApiError } from '../http/api-error.js';
import type { ChatStore } from './chat-store.js';
import type {
  ChatConversation,
  ChatConversationSummary,
  ChatMessage,
  ChatMessagePage,
} from './chat-types.js';

const MAX_MESSAGE_LENGTH = 4_000;

export class ChatService {
  constructor(
    private readonly store: ChatStore,
    private readonly authStore: AuthStore,
    private readonly now: () => number = Date.now,
  ) {}

  async startConversation(
    publicId: string,
    participantPublicId: string,
  ): Promise<ChatConversation> {
    if (publicId === participantPublicId) {
      throw new ApiError(400, 'INVALID_PARTICIPANT', 'You cannot chat with your own account.');
    }

    if (!(await this.authStore.isUserActive(participantPublicId))) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'No active user has that Public ID.');
    }

    return await this.store.getOrCreateConversation(publicId, participantPublicId, this.now());
  }

  async listConversations(
    publicId: string,
    limit: number,
  ): Promise<readonly ChatConversationSummary[]> {
    return await this.store.listConversations(publicId, limit);
  }

  async listMessages(
    publicId: string,
    conversationId: string,
    limit: number,
    beforeMs?: number,
  ): Promise<ChatMessagePage> {
    await this.requireParticipant(publicId, conversationId);
    return await this.store.listMessages(conversationId, limit, beforeMs);
  }

  async sendTextMessage(
    publicId: string,
    conversationId: string,
    input: Readonly<{ clientMessageId?: string; content: string }>,
  ): Promise<ChatMessage> {
    await this.requireParticipant(publicId, conversationId);
    const content = input.content.trim();

    if (!content || content.length > MAX_MESSAGE_LENGTH) {
      throw new ApiError(
        400,
        'INVALID_MESSAGE',
        `Messages must contain between 1 and ${MAX_MESSAGE_LENGTH} characters.`,
      );
    }

    const clientMessageId = input.clientMessageId ?? randomUUID();
    const message: ChatMessage = {
      clientMessageId,
      content,
      conversationId,
      createdAtMs: this.now(),
      id: clientMessageId,
      senderPublicId: publicId,
      type: 'text',
    };

    return await this.store.createTextMessage(message);
  }

  async markRead(publicId: string, conversationId: string): Promise<void> {
    await this.requireParticipant(publicId, conversationId);
    await this.store.markRead(conversationId, publicId, this.now());
  }

  private async requireParticipant(
    publicId: string,
    conversationId: string,
  ): Promise<ChatConversation> {
    const conversation = await this.store.findConversation(conversationId);
    if (!conversation || !conversation.participants.includes(publicId)) {
      throw new ApiError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
    }

    return conversation;
  }
}
