import { randomUUID } from 'node:crypto';

import type { AuthStore } from '../auth/auth-store.js';
import { ApiError } from '../http/api-error.js';
import { decodeChatCursor } from './chat-cursor.js';
import {
  CHAT_BURN_AFTER_READ_SECONDS,
  CHAT_MESSAGE_RETENTION_MS,
} from './chat-policy.js';
import type { ChatNotifier } from '../notifications/notification-service.js';
import type { ChatStore } from './chat-store.js';
import type { MediaService, PendingAttachmentInput } from '../media/media-service.js';
import type {
  ChatConversation,
  ChatConversationMemberSummary,
  ChatConversationSummary,
  ChatMessage,
  ChatMessagePage,
  ChatReadState,
} from './chat-types.js';

const MAX_MESSAGE_LENGTH = 4_000;

export class ChatService {
  constructor(
    private readonly store: ChatStore,
    private readonly authStore: AuthStore,
    private readonly now: () => number = Date.now,
    private readonly notifier?: ChatNotifier,
    private readonly mediaService?: MediaService,
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
    const summaries = await this.store.listConversations(publicId, limit, this.now());
    return await Promise.all(
      summaries.map(async (summary) => ({
        ...summary,
        participantStatus: (await this.authStore.isUserActive(summary.participantPublicId))
          ? ('active' as const)
          : ('deleted' as const),
      })),
    );
  }

  async listMessages(
    publicId: string,
    conversationId: string,
    limit: number,
    cursorValue?: string,
  ): Promise<ChatMessagePage> {
    const conversation = await this.requireParticipant(publicId, conversationId);
    const participantPublicId = conversation.participants.find((id) => id !== publicId)!;
    const [page, participantSummary] = await Promise.all([
      this.store.listMessages(
        conversationId,
        limit,
        this.now(),
        decodeChatCursor(cursorValue),
      ),
      this.store.findConversationMember(participantPublicId, conversationId),
    ]);

    return {
      ...page,
      messages: page.messages.map((message) =>
        this.forViewer(message, publicId, participantSummary),
      ),
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
    return await this.sendMessage(publicId, conversationId, input);
  }

  async sendMessage(
    publicId: string,
    conversationId: string,
    input: Readonly<{
      attachments?: readonly PendingAttachmentInput[];
      burnAfterRead?: boolean;
      clientMessageId?: string;
      content?: string;
    }>,
  ): Promise<ChatMessage> {
    const conversation = await this.requireParticipant(publicId, conversationId);
    const recipientPublicId = conversation.participants.find((id) => id !== publicId)!;
    if (!(await this.authStore.isUserActive(recipientPublicId))) {
      throw new ApiError(
        410,
        'PARTICIPANT_UNAVAILABLE',
        'This account is no longer available.',
      );
    }

    const content = input.content?.trim() ?? '';
    if ((!content && !input.attachments?.length) || content.length > MAX_MESSAGE_LENGTH) {
      throw new ApiError(
        400,
        'INVALID_MESSAGE',
        `Messages must contain text or attachments, with text up to ${MAX_MESSAGE_LENGTH} characters.`,
      );
    }

    const nowMs = this.now();
    const clientMessageId = input.clientMessageId ?? randomUUID();
    const attachments = input.attachments?.length
      ? await this.requireMedia().promoteAttachments({
          attachments: input.attachments,
          conversationId,
          messageId: clientMessageId,
          publicId,
        })
      : undefined;
    const message: ChatMessage = {
      ...(attachments ? { attachments } : {}),
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

    const result = await this.store.createTextMessage(message);
    const stored = result.message;
    if (
      stored.senderPublicId !== publicId ||
      stored.content !== content ||
      JSON.stringify(stored.attachments ?? []) !== JSON.stringify(attachments ?? []) ||
      Boolean(stored.burnAfterReadSeconds) !== Boolean(input.burnAfterRead)
    ) {
      throw new ApiError(409, 'MESSAGE_ID_CONFLICT', 'This message retry does not match the original.');
    }
    if (stored.expiresAtMs <= nowMs) {
      throw new ApiError(410, 'MESSAGE_EXPIRED', 'This message has expired.');
    }

    if (result.created && this.notifier) {
      void this.notifier
        .notifyNewMessage({ conversationId, recipientPublicId })
        .catch(() => undefined);
    }

    return stored;
  }

  async createUpload(
    publicId: string,
    input: Readonly<{
      byteSize: number;
      clientMessageId: string;
      contentType: string;
      conversationId: string;
      fileName: string;
    }>,
  ) {
    await this.requireParticipant(publicId, input.conversationId);
    return await this.requireMedia().createUpload({ ...input, publicId });
  }

  async getAttachmentDownload(
    publicId: string,
    conversationId: string,
    messageId: string,
    attachmentId: string,
  ) {
    await this.requireParticipant(publicId, conversationId);
    const message = await this.store.findMessage(conversationId, messageId);
    if (!message || message.expiresAtMs <= this.now()) {
      throw new ApiError(404, 'MESSAGE_NOT_FOUND', 'Message not found or already expired.');
    }
    const attachment = message.attachments?.find((item) => item.id === attachmentId);
    if (!attachment) throw new ApiError(404, 'ATTACHMENT_NOT_FOUND', 'Attachment not found.');
    return await this.requireMedia().getDownloadUrl(attachment);
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

  async markRead(publicId: string, conversationId: string): Promise<ChatReadState> {
    await this.requireParticipant(publicId, conversationId);
    return await this.store.markRead(conversationId, publicId, this.now());
  }

  private forViewer(
    message: ChatMessage,
    publicId: string,
    participantSummary: ChatConversationMemberSummary | null,
  ): ChatMessage {
    const locked = Boolean(
      message.burnAfterReadSeconds &&
        message.senderPublicId !== publicId &&
        message.burnStartedAtMs === undefined,
    );

    const readAtMs =
      message.senderPublicId === publicId &&
      participantSummary?.lastReadAtMs !== undefined &&
      participantSummary.lastReadMessageId !== undefined &&
      (message.createdAtMs < participantSummary.lastReadAtMs ||
        (message.createdAtMs === participantSummary.lastReadAtMs &&
          message.id <= participantSummary.lastReadMessageId))
        ? (participantSummary.lastReadObservedAtMs ?? participantSummary.lastReadAtMs)
        : undefined;
    const visible = locked
      ? { ...message, content: '', locked: true }
      : { ...message, locked: false };
    return readAtMs === undefined ? visible : { ...visible, readAtMs };
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

  private requireMedia(): MediaService {
    if (!this.mediaService) {
      throw new ApiError(503, 'MEDIA_UNAVAILABLE', 'Media storage is not available.');
    }
    return this.mediaService;
  }
}
