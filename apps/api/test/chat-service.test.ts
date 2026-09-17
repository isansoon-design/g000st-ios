import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type {
  AccountReservation,
  AuthStore,
  RecoveryCredentialRecord,
  ReserveAccountResult,
  RotateRefreshResult,
  SessionMaterial,
} from '../src/auth/auth-store.js';
import { CHAT_MESSAGE_RETENTION_MS } from '../src/chat/chat-policy.js';
import { ChatService } from '../src/chat/chat-service.js';
import type { ChatStore, OpenBurnMessageResult } from '../src/chat/chat-store.js';
import type {
  ChatConversation,
  ChatConversationSummary,
  ChatMessage,
  ChatMessagePage,
} from '../src/chat/chat-types.js';
import { ApiError } from '../src/http/api-error.js';

const USER_A = 'A'.repeat(50);
const USER_B = 'B'.repeat(50);
const USER_C = 'C'.repeat(50);
const NOW = 1_789_560_000_000;

class ActiveUsersStore implements AuthStore {
  constructor(private readonly activeUsers: ReadonlySet<string>) {}

  async isUserActive(publicId: string): Promise<boolean> {
    return this.activeUsers.has(publicId);
  }

  async createAccount(_reservation: AccountReservation): Promise<ReserveAccountResult> {
    throw new Error('Not used by ChatService tests.');
  }

  async createSession(
    _publicId: string,
    _material: SessionMaterial,
    _createdAtMs: number,
  ): Promise<void> {
    throw new Error('Not used by ChatService tests.');
  }

  async findActivePublicIdByAccessHash(
    _accessHash: string,
    _nowMs: number,
  ): Promise<string | null> {
    throw new Error('Not used by ChatService tests.');
  }

  async findRecoveryCredential(_lookupHash: string): Promise<RecoveryCredentialRecord | null> {
    throw new Error('Not used by ChatService tests.');
  }

  async rotateRefresh(
    _currentRefreshHash: string,
    _next: SessionMaterial,
    _rotatedAtMs: number,
  ): Promise<RotateRefreshResult> {
    throw new Error('Not used by ChatService tests.');
  }
}

class MemoryChatStore implements ChatStore {
  readonly conversations = new Map<string, ChatConversation>();
  readonly messages = new Map<string, ChatMessage[]>();
  readonly readBy = new Map<string, number>();

  async getOrCreateConversation(
    firstPublicId: string,
    secondPublicId: string,
    nowMs: number,
  ): Promise<ChatConversation> {
    const participants = [firstPublicId, secondPublicId].sort() as [string, string];
    const id = participants.join('--');
    const existing = this.conversations.get(id);
    if (existing) return existing;

    const conversation = { createdAtMs: nowMs, id, participants, updatedAtMs: nowMs } as const;
    this.conversations.set(id, conversation);
    return conversation;
  }

  async findConversation(conversationId: string): Promise<ChatConversation | null> {
    return this.conversations.get(conversationId) ?? null;
  }

  async listConversations(
    publicId: string,
    _limit: number,
  ): Promise<readonly ChatConversationSummary[]> {
    return [...this.conversations.values()]
      .filter((conversation) => conversation.participants.includes(publicId))
      .map((conversation) => ({
        conversationId: conversation.id,
        lastMessagePreview: '',
        participantPublicId: conversation.participants.find((id) => id !== publicId)!,
        unreadCount: 0,
        updatedAtMs: conversation.updatedAtMs,
      }));
  }

  async listMessages(
    conversationId: string,
    limit: number,
    nowMs: number,
    beforeMs?: number,
  ): Promise<ChatMessagePage> {
    const messages = (this.messages.get(conversationId) ?? [])
      .filter((message) => message.expiresAtMs > nowMs)
      .filter((message) => beforeMs === undefined || message.createdAtMs < beforeMs)
      .slice(-limit);
    return { messages };
  }

  async createTextMessage(message: ChatMessage): Promise<ChatMessage> {
    const messages = this.messages.get(message.conversationId) ?? [];
    const existing = messages.find((candidate) => candidate.id === message.id);
    if (existing) return existing;
    messages.push(message);
    this.messages.set(message.conversationId, messages);
    return message;
  }

  async openBurnMessage(
    conversationId: string,
    messageId: string,
    publicId: string,
    nowMs: number,
  ): Promise<OpenBurnMessageResult> {
    const message = this.messages
      .get(conversationId)
      ?.find((candidate) => candidate.id === messageId);
    if (!message || message.expiresAtMs <= nowMs) return { status: 'not_found' };
    if (!message.burnAfterReadSeconds || message.senderPublicId === publicId) {
      return { status: 'not_burnable' };
    }
    if (message.burnStartedAtMs !== undefined) return { message, status: 'opened' };

    const opened = {
      ...message,
      burnStartedAtMs: nowMs,
      expiresAtMs: Math.min(message.expiresAtMs, nowMs + message.burnAfterReadSeconds * 1_000),
    };
    const messages = this.messages.get(conversationId)!;
    messages[messages.indexOf(message)] = opened;
    return { message: opened, status: 'opened' };
  }

  async markRead(conversationId: string, publicId: string, readAtMs: number): Promise<void> {
    this.readBy.set(`${conversationId}:${publicId}`, readAtMs);
  }

  async purgeExpiredMessages(nowMs: number, limit: number): Promise<number> {
    let deleted = 0;
    for (const [conversationId, messages] of this.messages) {
      const remaining = messages.filter((message) => {
        if (deleted >= limit || message.expiresAtMs > nowMs) return true;
        deleted += 1;
        return false;
      });
      this.messages.set(conversationId, remaining);
    }
    return deleted;
  }
}

function expectApiError(code: string) {
  return (error: unknown): boolean => error instanceof ApiError && error.code === code;
}

function createFixture() {
  let nowMs = NOW;
  const chatStore = new MemoryChatStore();
  const authStore = new ActiveUsersStore(new Set([USER_A, USER_B, USER_C]));
  const service = new ChatService(chatStore, authStore, () => nowMs);
  return {
    advance: (milliseconds: number) => {
      nowMs += milliseconds;
    },
    chatStore,
    service,
  };
}

describe('ChatService', () => {
  it('creates one private conversation for the same two users', async () => {
    const { service } = createFixture();
    const first = await service.startConversation(USER_A, USER_B);
    const second = await service.startConversation(USER_B, USER_A);

    assert.equal(first.id, second.id);
    assert.deepEqual(first.participants, [USER_A, USER_B]);
  });

  it('rejects self-chat and an unavailable participant', async () => {
    const { service } = createFixture();

    await assert.rejects(
      () => service.startConversation(USER_A, USER_A),
      expectApiError('INVALID_PARTICIPANT'),
    );
    await assert.rejects(
      () => service.startConversation(USER_A, 'Z'.repeat(50)),
      expectApiError('USER_NOT_FOUND'),
    );
  });

  it('prevents a third user from reading, sending, opening, or marking read', async () => {
    const { service } = createFixture();
    const conversation = await service.startConversation(USER_A, USER_B);

    await assert.rejects(
      () => service.listMessages(USER_C, conversation.id, 50),
      expectApiError('CONVERSATION_NOT_FOUND'),
    );
    await assert.rejects(
      () => service.sendTextMessage(USER_C, conversation.id, { content: 'Intrusion' }),
      expectApiError('CONVERSATION_NOT_FOUND'),
    );
    await assert.rejects(
      () => service.openBurnMessage(USER_C, conversation.id, randomMessageId),
      expectApiError('CONVERSATION_NOT_FOUND'),
    );
    await assert.rejects(
      () => service.markRead(USER_C, conversation.id),
      expectApiError('CONVERSATION_NOT_FOUND'),
    );
  });

  it('stores messages for two hours and deduplicates matching retries', async () => {
    const { chatStore, service } = createFixture();
    const conversation = await service.startConversation(USER_A, USER_B);
    const clientMessageId = '018f6f5d-58e4-7a30-8df8-5f237c0666bb';

    const first = await service.sendTextMessage(USER_A, conversation.id, {
      clientMessageId,
      content: '  Hello privately  ',
    });
    const retried = await service.sendTextMessage(USER_A, conversation.id, {
      clientMessageId,
      content: '  Hello privately  ',
    });

    assert.equal(first.content, 'Hello privately');
    assert.equal(first.expiresAtMs, NOW + CHAT_MESSAGE_RETENTION_MS);
    assert.equal(retried.id, first.id);
    assert.equal(chatStore.messages.get(conversation.id)?.length, 1);
  });

  it('hides a burn message until its recipient opens it and removes it after five seconds', async () => {
    const { advance, chatStore, service } = createFixture();
    const conversation = await service.startConversation(USER_A, USER_B);
    const sent = await service.sendTextMessage(USER_A, conversation.id, {
      burnAfterRead: true,
      content: 'Secret for five seconds',
    });

    const senderPage = await service.listMessages(USER_A, conversation.id, 50);
    const recipientPage = await service.listMessages(USER_B, conversation.id, 50);
    assert.equal(senderPage.messages[0]?.content, 'Secret for five seconds');
    assert.equal(recipientPage.messages[0]?.content, '');
    assert.equal(recipientPage.messages[0]?.locked, true);

    const opened = await service.openBurnMessage(USER_B, conversation.id, sent.id);
    assert.equal(opened.content, 'Secret for five seconds');
    assert.equal(opened.expiresAtMs, NOW + 5_000);

    advance(5_001);
    const expiredPage = await service.listMessages(USER_B, conversation.id, 50);
    assert.equal(expiredPage.messages.length, 0);
    assert.equal(await chatStore.purgeExpiredMessages(NOW + 5_001, 100), 1);
    assert.equal(chatStore.messages.get(conversation.id)?.length, 0);
  });

  it('rejects empty messages and records a participant read marker', async () => {
    const { chatStore, service } = createFixture();
    const conversation = await service.startConversation(USER_A, USER_B);

    await assert.rejects(
      () => service.sendTextMessage(USER_A, conversation.id, { content: '   ' }),
      expectApiError('INVALID_MESSAGE'),
    );
    await service.markRead(USER_B, conversation.id);
    assert.equal(chatStore.readBy.get(`${conversation.id}:${USER_B}`), NOW);
  });
});

const randomMessageId = '018f6f5d-58e4-7a30-8df8-5f237c0666bc';
