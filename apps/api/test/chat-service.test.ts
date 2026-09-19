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
import { encodeChatCursor } from '../src/chat/chat-cursor.js';
import { CHAT_MESSAGE_RETENTION_MS } from '../src/chat/chat-policy.js';
import { ChatService } from '../src/chat/chat-service.js';
import type {
  ChatStore,
  CreateTextMessageResult,
  OpenBurnMessageResult,
} from '../src/chat/chat-store.js';
import type {
  ChatConversation,
  ChatConversationMemberSummary,
  ChatMessage,
  ChatMessageCursor,
  ChatMessagePage,
  ChatReadState,
} from '../src/chat/chat-types.js';
import { ApiError } from '../src/http/api-error.js';

const USER_A = 'A'.repeat(50);
const USER_B = 'B'.repeat(50);
const USER_C = 'C'.repeat(50);
const NOW = 1_789_560_000_000;

class ActiveUsersStore implements AuthStore {
  constructor(private readonly activeUsers: Set<string>) {}

  deactivate(publicId: string): void {
    this.activeUsers.delete(publicId);
  }

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
  readonly members = new Map<string, ChatConversationMemberSummary>();
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
    for (const publicId of participants) {
      this.members.set(`${publicId}:${id}`, {
        conversationId: id,
        lastMessagePreview: '',
        participantPublicId: participants.find((candidate) => candidate !== publicId)!,
        unreadCount: 0,
        updatedAtMs: nowMs,
      });
    }
    return conversation;
  }

  async findConversation(conversationId: string): Promise<ChatConversation | null> {
    return this.conversations.get(conversationId) ?? null;
  }

  async findConversationMember(
    publicId: string,
    conversationId: string,
  ): Promise<ChatConversationMemberSummary | null> {
    return this.members.get(`${publicId}:${conversationId}`) ?? null;
  }

  async findMessage(conversationId: string, messageId: string): Promise<ChatMessage | null> {
    return (this.messages.get(conversationId) ?? []).find((message) => message.id === messageId) ?? null;
  }

  async listConversations(
    publicId: string,
    limit: number,
    nowMs: number,
  ): Promise<readonly ChatConversationMemberSummary[]> {
    return [...this.members.entries()]
      .filter(([key]) => key.startsWith(`${publicId}:`))
      .map(([key, summary]) => {
        if (summary.unreadCount === 0) return summary;

        const unread = (this.messages.get(summary.conversationId) ?? [])
          .filter(
            (message) =>
              message.expiresAtMs > nowMs &&
              message.senderPublicId === summary.participantPublicId &&
              (summary.lastReadAtMs === undefined ||
                summary.lastReadMessageId === undefined ||
                message.createdAtMs > summary.lastReadAtMs ||
                (message.createdAtMs === summary.lastReadAtMs &&
                  message.id > summary.lastReadMessageId)),
          )
          .sort(
            (left, right) =>
              left.createdAtMs - right.createdAtMs || left.id.localeCompare(right.id),
          );
        const firstUnread = unread[0];
        const {
          firstUnreadCreatedAtMs: _firstUnreadCreatedAtMs,
          firstUnreadExpiresAtMs: _firstUnreadExpiresAtMs,
          firstUnreadMessageId: _firstUnreadMessageId,
          ...withoutUnreadAnchor
        } = summary;
        const reconciled = {
          ...withoutUnreadAnchor,
          ...(firstUnread
            ? {
                firstUnreadCreatedAtMs: firstUnread.createdAtMs,
                firstUnreadExpiresAtMs: firstUnread.expiresAtMs,
                firstUnreadMessageId: firstUnread.id,
              }
            : {}),
          unreadCount: unread.length,
        };
        this.members.set(key, reconciled);
        return reconciled;
      })
      .slice(0, limit);
  }

  async listMessages(
    conversationId: string,
    limit: number,
    nowMs: number,
    cursor?: ChatMessageCursor,
  ): Promise<ChatMessagePage> {
    const descending = (this.messages.get(conversationId) ?? [])
      .filter((message) => message.expiresAtMs > nowMs)
      .sort(
        (left, right) =>
          right.createdAtMs - left.createdAtMs || right.id.localeCompare(left.id),
      )
      .filter(
        (message) =>
          cursor === undefined ||
          message.createdAtMs < cursor.createdAtMs ||
          (message.createdAtMs === cursor.createdAtMs && message.id < cursor.id),
      );
    const page = descending.slice(0, limit);
    const oldest = page.at(-1);
    return {
      messages: page.reverse(),
      ...(descending.length > limit && oldest
        ? { nextCursor: encodeChatCursor({ createdAtMs: oldest.createdAtMs, id: oldest.id }) }
        : {}),
    };
  }

  async createTextMessage(message: ChatMessage): Promise<CreateTextMessageResult> {
    const messages = this.messages.get(message.conversationId) ?? [];
    const existing = messages.find((candidate) => candidate.id === message.id);
    if (existing) return { created: false, message: existing };

    const conversation = this.conversations.get(message.conversationId)!;
    const recipientPublicId = conversation.participants.find(
      (candidate) => candidate !== message.senderPublicId,
    )!;
    const recipientKey = `${recipientPublicId}:${message.conversationId}`;
    const recipient = this.members.get(recipientKey)!;
    const common = {
      lastMessageCreatedAtMs: message.createdAtMs,
      lastMessageId: message.id,
      lastMessagePreview: message.burnAfterReadSeconds ? 'Burn message' : 'Message',
      lastMessageSenderId: message.senderPublicId,
      updatedAtMs: message.createdAtMs,
    };
    this.members.set(recipientKey, {
      ...recipient,
      ...common,
      ...(recipient.unreadCount
        ? {}
        : {
            firstUnreadCreatedAtMs: message.createdAtMs,
            firstUnreadExpiresAtMs: message.expiresAtMs,
            firstUnreadMessageId: message.id,
          }),
      unreadCount: recipient.unreadCount + 1,
    });
    const senderKey = `${message.senderPublicId}:${message.conversationId}`;
    this.members.set(senderKey, { ...this.members.get(senderKey)!, ...common });
    messages.push(message);
    this.messages.set(message.conversationId, messages);
    return { created: true, message };
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

  async markRead(
    conversationId: string,
    publicId: string,
    readAtMs: number,
  ): Promise<ChatReadState> {
    const key = `${publicId}:${conversationId}`;
    const summary = this.members.get(key)!;
    const state: ChatReadState = {
      ...(summary.lastMessageCreatedAtMs === undefined
        ? {}
        : { lastReadAtMs: summary.lastMessageCreatedAtMs }),
      ...(summary.lastMessageId === undefined
        ? {}
        : { lastReadMessageId: summary.lastMessageId }),
      unreadCount: 0,
    };
    const {
      firstUnreadCreatedAtMs: _firstUnreadCreatedAtMs,
      firstUnreadExpiresAtMs: _firstUnreadExpiresAtMs,
      firstUnreadMessageId: _firstUnreadMessageId,
      ...withoutUnreadAnchor
    } = summary;
    this.members.set(key, {
      ...withoutUnreadAnchor,
      ...state,
      lastReadObservedAtMs: readAtMs,
    });
    this.readBy.set(key, readAtMs);
    return state;
  }

  async purgeExpiredMessages(nowMs: number, limit: number): Promise<readonly ChatMessage[]> {
    const deleted: ChatMessage[] = [];
    for (const [conversationId, messages] of this.messages) {
      const remaining = messages.filter((message) => {
        if (deleted.length >= limit || message.expiresAtMs > nowMs) return true;
        deleted.push(message);
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
  const notifications: Array<{ conversationId: string; recipientPublicId: string }> = [];
  const service = new ChatService(chatStore, authStore, () => nowMs, {
    async notifyNewMessage(input) {
      notifications.push(input);
    },
  });
  return {
    advance: (milliseconds: number) => {
      nowMs += milliseconds;
    },
    authStore,
    chatStore,
    notifications,
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
    const { chatStore, notifications, service } = createFixture();
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
    assert.deepEqual(notifications, [
      { conversationId: conversation.id, recipientPublicId: USER_B },
    ]);
  });

  it('paginates deterministically when messages share the same timestamp', async () => {
    const { service } = createFixture();
    const conversation = await service.startConversation(USER_A, USER_B);
    for (let index = 1; index <= 5; index += 1) {
      await service.sendTextMessage(USER_A, conversation.id, {
        clientMessageId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        content: `Message ${index}`,
      });
    }

    const newest = await service.listMessages(USER_A, conversation.id, 2);
    const middle = await service.listMessages(USER_A, conversation.id, 2, newest.nextCursor);
    const oldest = await service.listMessages(USER_A, conversation.id, 2, middle.nextCursor);
    const ids = [...oldest.messages, ...middle.messages, ...newest.messages].map(
      (message) => message.id,
    );

    assert.equal(new Set(ids).size, 5);
    assert.equal(ids.length, 5);
    await assert.rejects(
      () => service.listMessages(USER_A, conversation.id, 2, 'not-a-cursor'),
      expectApiError('INVALID_CURSOR'),
    );
  });

  it('keeps chat history but disables sending when the other account is deleted', async () => {
    const { authStore, service } = createFixture();
    const conversation = await service.startConversation(USER_A, USER_B);
    await service.sendTextMessage(USER_B, conversation.id, { content: 'Before deletion' });

    authStore.deactivate(USER_B);
    const summaries = await service.listConversations(USER_A, 30);
    assert.equal(summaries[0]?.participantStatus, 'deleted');
    assert.equal((await service.listMessages(USER_A, conversation.id, 50)).messages.length, 1);
    await assert.rejects(
      () => service.sendTextMessage(USER_A, conversation.id, { content: 'After deletion' }),
      expectApiError('PARTICIPANT_UNAVAILABLE'),
    );
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
    assert.equal((await chatStore.purgeExpiredMessages(NOW + 5_001, 100)).length, 1);
    assert.equal(chatStore.messages.get(conversation.id)?.length, 0);
  });

  it('records the first unread message and atomically clears the conversation unread state', async () => {
    const { advance, chatStore, service } = createFixture();
    const conversation = await service.startConversation(USER_A, USER_B);
    const first = await service.sendTextMessage(USER_A, conversation.id, { content: 'First' });
    advance(1);
    await service.sendTextMessage(USER_A, conversation.id, { content: 'Second' });

    const unread = (await service.listConversations(USER_B, 30))[0];
    assert.equal(unread?.unreadCount, 2);
    assert.equal(unread?.firstUnreadMessageId, first.id);
    assert.equal(
      (await service.listMessages(USER_A, conversation.id, 50)).messages[0]?.readAtMs,
      undefined,
    );

    const readState = await service.markRead(USER_B, conversation.id);
    const read = (await service.listConversations(USER_B, 30))[0];
    assert.equal(readState.unreadCount, 0);
    assert.equal(read?.unreadCount, 0);
    assert.equal(read?.firstUnreadMessageId, undefined);
    assert.equal(chatStore.readBy.get(`${USER_B}:${conversation.id}`), NOW + 1);
    assert.equal(
      (await service.listMessages(USER_A, conversation.id, 50)).messages[0]?.readAtMs,
      NOW + 1,
    );
  });

  it('repairs the unread count and anchor after older unread messages expire', async () => {
    const { advance, service } = createFixture();
    const conversation = await service.startConversation(USER_A, USER_B);
    await service.sendTextMessage(USER_A, conversation.id, { content: 'Expires first' });
    advance(1_000);
    const remaining = await service.sendTextMessage(USER_A, conversation.id, {
      content: 'Still retained',
    });
    advance(CHAT_MESSAGE_RETENTION_MS - 500);

    const summary = (await service.listConversations(USER_B, 30))[0];
    assert.equal(summary?.unreadCount, 1);
    assert.equal(summary?.firstUnreadMessageId, remaining.id);
  });
});

const randomMessageId = '018f6f5d-58e4-7a30-8df8-5f237c0666bc';
