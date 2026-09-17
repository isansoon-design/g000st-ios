import { randomUUID } from 'node:crypto';

import type { AuthStore } from '../auth/auth-store.js';
import { ApiError } from '../http/api-error.js';
import {
  CHAT_BURN_AFTER_READ_SECONDS,
  CHAT_MESSAGE_RETENTION_MS,
} from './chat-policy.js';
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
    const page = await this.store.listMessages(conversationId, limit, this.now(), beforeMs);

    return {
      ...page,
      messages: page.messages.map((message) => this.forViewer(message, publicId)),
    };
  }

  async sendTextMessage(
    publicId: string,
    conversationId: string,
    input: Readonly<{
      burnAfterRead?: boolean;
      clientMessageId?: string;
      content: string;
    }>,
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

    const nowMs = this.now();
    const clientMessageId = input.clientMessageId ?? randomUUID();
    const message: ChatMessage = {
      ...(input.burnAfterRead
        ? { burnAfterReadSeconds: CHAT_BURN_AFTER_READ_SECONDS }
        : {}),
      clientMessageId,
      content,
      conversationId,
      createdAtMs: nowMs,
      expiresAtMs: nowMs + CHAT_MESSAGE_RETENTION_MS,
      id: clientMessageId,
      locked: false,
      senderPublicId: publicId,
      type: 'text',
    };

    const stored = await this.store.createTextMessage(message);
    if (
      stored.senderPublicId !== publicId ||
      stored.content !== content ||
      Boolean(stored.burnAfterReadSeconds) !== Boolean(input.burnAfterRead)
    ) {
      throw new ApiError(409, 'MESSAGE_ID_CONFLICT', 'This message retry does not match the original.');
    }
    if (stored.expiresAtMs <= nowMs) {
      throw new ApiError(410, 'MESSAGE_EXPIRED', 'This message has expired.');
    }

    return stored;
  }

  async openBurnMessage(
    publicId: string,
    conversationId: string,
    messageId: string,
  ): Promise<ChatMessage> {
    await this.requireParticipant(publicId, conversationId);
    const result = await this.store.openBurnMessage(
      conversationId,
      messageId,
      publicId,
      this.now(),
    );

    if (result.status === 'not_found') {
      throw new ApiError(404, 'MESSAGE_NOT_FOUND', 'Message not found or already expired.');
    }
    if (result.status === 'not_burnable') {
      throw new ApiError(400, 'MESSAGE_NOT_BURNABLE', 'This burn message cannot be opened here.');
    }

    return { ...result.message, locked: false };
  }

  async markRead(publicId: string, conversationId: string): Promise<void> {
    await this.requireParticipant(publicId, conversationId);
    await this.store.markRead(conversationId, publicId, this.now());
  }

  private forViewer(message: ChatMessage, publicId: string): ChatMessage {
    const locked = Boolean(
      message.burnAfterReadSeconds &&
        message.senderPublicId !== publicId &&
        message.burnStartedAtMs === undefined,
    );

    return locked ? { ...message, content: '', locked: true } : { ...message, locked: false };
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
