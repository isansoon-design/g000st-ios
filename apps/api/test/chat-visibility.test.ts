import assert from 'node:assert/strict';
import { it } from 'node:test';

import type { AuthStore } from '../src/auth/auth-store.js';
import { CHAT_PRIVATE_MESSAGE_MOBILE_VISIBILITY_MS, MARKET_CHAT_MESSAGE_RETENTION_MS, isLegacyTwoHourMessage } from '../src/chat/chat-policy.js';
import { ChatService } from '../src/chat/chat-service.js';
import type { ChatStore } from '../src/chat/chat-store.js';
import type { ChatConversation, ChatConversationMemberSummary, ChatMessage } from '../src/chat/chat-types.js';

const nowMs = 1_789_560_000_000;
const senderPublicId = 'A'.repeat(50);
const recipientPublicId = 'B'.repeat(50);
const conversationId = 'a'.repeat(64);
const conversation: ChatConversation = {
  createdAtMs: nowMs - CHAT_PRIVATE_MESSAGE_MOBILE_VISIBILITY_MS - 1,
  id: conversationId,
  kind: 'private',
  participants: [senderPublicId, recipientPublicId],
  updatedAtMs: nowMs,
};

const oldMessage: ChatMessage = {
  clientMessageId: '11111111-1111-4111-8111-111111111111',
  content: 'Old message',
  conversationId,
  createdAtMs: nowMs - CHAT_PRIVATE_MESSAGE_MOBILE_VISIBILITY_MS - 1,
  id: '11111111-1111-4111-8111-111111111111',
  locked: false,
  senderPublicId,
  type: 'text',
};
const recentMessage: ChatMessage = {
  ...oldMessage,
  clientMessageId: '22222222-2222-4222-8222-222222222222',
  content: 'Recent message',
  createdAtMs: nowMs,
  id: '22222222-2222-4222-8222-222222222222',
};

it('retains private messages on web and limits mobile messages and unread counts to two hours', async () => {
  const summary: ChatConversationMemberSummary = {
    conversationId,
    firstUnreadCreatedAtMs: oldMessage.createdAtMs,
    firstUnreadMessageId: oldMessage.id,
    kind: 'private',
    lastMessageCreatedAtMs: recentMessage.createdAtMs,
    lastMessageId: recentMessage.id,
    lastMessagePreview: 'Message',
    lastMessageSenderId: senderPublicId,
    participantPublicId: senderPublicId,
    unreadCount: 2,
    updatedAtMs: nowMs,
  };
  const store = {
    async findConversation() { return conversation; },
    async findConversationMember() { return null; },
    async listConversations() { return [summary]; },
    async listMessages(_conversationId: string, _limit: number, _nowMs: number, _cursor?: unknown, visibleAfterMs?: number) {
      return {
        messages: [oldMessage, recentMessage].filter((message) =>
          visibleAfterMs === undefined || message.createdAtMs > visibleAfterMs),
      };
    },
  } as unknown as ChatStore;
  const authStore = { async isUserActive() { return true; } } as unknown as AuthStore;
  const service = new ChatService(store, authStore, () => nowMs);

  assert.deepEqual((await service.listMessages(recipientPublicId, conversationId, 50)).messages.map((message) => message.id), [oldMessage.id, recentMessage.id]);
  assert.deepEqual((await service.listMessages(recipientPublicId, conversationId, 50, undefined, 'mobile')).messages.map((message) => message.id), [recentMessage.id]);
  assert.equal((await service.listConversations(recipientPublicId, 30))[0]?.unreadCount, 2);
  const mobileSummary = (await service.listConversations(recipientPublicId, 30, 'mobile'))[0];
  assert.equal(mobileSummary?.unreadCount, 1);
  assert.equal(mobileSummary?.firstUnreadMessageId, recentMessage.id);
});

it('recognizes old two-hour deadlines without treating opened burn messages as permanent', () => {
  assert.equal(isLegacyTwoHourMessage({ createdAtMs: nowMs, expiresAtMs: nowMs + CHAT_PRIVATE_MESSAGE_MOBILE_VISIBILITY_MS }), true);
  assert.equal(isLegacyTwoHourMessage({ createdAtMs: nowMs, expiresAtMs: nowMs + CHAT_PRIVATE_MESSAGE_MOBILE_VISIBILITY_MS, burnStartedAtMs: nowMs + 1 }), false);
});

it('stores private messages without a two-hour expiry and keeps Market expiry at 30 days', async () => {
  let activeConversation = conversation;
  const store = {
    async findConversation() { return activeConversation; },
    async createTextMessage(message: ChatMessage) { return { created: true, message }; },
  } as unknown as ChatStore;
  const authStore = { async isUserActive() { return true; } } as unknown as AuthStore;
  const service = new ChatService(store, authStore, () => nowMs);

  const regular = await service.sendTextMessage(senderPublicId, conversationId, { content: 'Regular' });
  const burn = await service.sendTextMessage(senderPublicId, conversationId, { content: 'Burn', burnAfterRead: true });
  assert.equal(regular.expiresAtMs, undefined);
  assert.equal(burn.expiresAtMs, undefined);
  assert.equal(burn.burnAfterReadSeconds, 60);

  activeConversation = { ...conversation, kind: 'market' };
  const market = await service.sendTextMessage(senderPublicId, conversationId, { content: 'Market', burnAfterRead: true });
  assert.equal(market.expiresAtMs, nowMs + MARKET_CHAT_MESSAGE_RETENTION_MS);
  assert.equal(market.burnAfterReadSeconds, undefined);
});
