import { createHash } from 'node:crypto';

import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';

import { CHAT_MESSAGE_RETENTION_MS } from './chat-policy.js';
import type { ChatStore, OpenBurnMessageResult } from './chat-store.js';
import type {
  ChatConversation,
  ChatConversationSummary,
  ChatMessage,
  ChatMessagePage,
} from './chat-types.js';

type StoredConversation = Readonly<{
  createdAtMs: number;
  participants: readonly [string, string];
  updatedAtMs: number;
}>;

type StoredConversationSummary = Omit<ChatConversationSummary, 'conversationId'>;

export class FirestoreChatStore implements ChatStore {
  constructor(
    private readonly db: Firestore,
    private readonly collectionPrefix: string,
  ) {}

  async getOrCreateConversation(
    firstPublicId: string,
    secondPublicId: string,
    nowMs: number,
  ): Promise<ChatConversation> {
    const participants = [firstPublicId, secondPublicId].sort() as [string, string];
    const conversationId = createHash('sha256').update(participants.join('\0')).digest('hex');
    const conversationRef = this.conversations().doc(conversationId);

    return await this.db.runTransaction(async (transaction) => {
      const existing = await transaction.get(conversationRef);
      if (existing.exists) return this.toConversation(existing.id, existing.data());

      const conversation: StoredConversation = {
        createdAtMs: nowMs,
        participants,
        updatedAtMs: nowMs,
      };
      transaction.create(conversationRef, conversation);

      for (const publicId of participants) {
        const participantPublicId = participants.find((candidate) => candidate !== publicId)!;
        transaction.create(this.memberConversation(publicId, conversationId), {
          lastMessagePreview: '',
          participantPublicId,
          unreadCount: 0,
          updatedAtMs: nowMs,
        } satisfies StoredConversationSummary);
      }

      return { ...conversation, id: conversationId };
    });
  }

  async findConversation(conversationId: string): Promise<ChatConversation | null> {
    const snapshot = await this.conversations().doc(conversationId).get();
    return snapshot.exists ? this.toConversation(snapshot.id, snapshot.data()) : null;
  }

  async listConversations(
    publicId: string,
    limit: number,
  ): Promise<readonly ChatConversationSummary[]> {
    const snapshot = await this.memberConversations(publicId)
      .orderBy('updatedAtMs', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map((document) => ({
      ...(document.data() as StoredConversationSummary),
      conversationId: document.id,
    }));
  }

  async listMessages(
    conversationId: string,
    limit: number,
    nowMs: number,
    beforeMs?: number,
  ): Promise<ChatMessagePage> {
    let query = this.messages(conversationId).orderBy('createdAtMs', 'desc');
    if (beforeMs !== undefined) query = query.where('createdAtMs', '<', beforeMs);

    const fetchLimit = Math.min(limit * 5, 500);
    const snapshot = await query.limit(fetchLimit).get();
    const descending = snapshot.docs
      .map((document) => document.data() as ChatMessage)
      .filter((message) => message.expiresAtMs > nowMs)
      .slice(0, limit);
    const nextBefore = descending.length === limit ? descending.at(-1)?.createdAtMs : undefined;

    return {
      messages: descending.reverse(),
      ...(nextBefore === undefined ? {} : { nextBefore }),
    };
  }

  async createTextMessage(message: ChatMessage): Promise<ChatMessage> {
    const conversationRef = this.conversations().doc(message.conversationId);
    const messageRef = this.messages(message.conversationId).doc(message.id);

    return await this.db.runTransaction(async (transaction) => {
      const [conversationSnapshot, existingMessage] = await Promise.all([
        transaction.get(conversationRef),
        transaction.get(messageRef),
      ]);

      if (!conversationSnapshot.exists) throw new Error('Conversation disappeared.');
      if (existingMessage.exists) return existingMessage.data() as ChatMessage;

      const conversation = this.toConversation(
        conversationSnapshot.id,
        conversationSnapshot.data(),
      );
      if (!conversation.participants.includes(message.senderPublicId)) {
        throw new Error('Sender is not a conversation participant.');
      }

      const recipientPublicId = conversation.participants.find(
        (participant) => participant !== message.senderPublicId,
      )!;
      const summary = {
        lastMessagePreview: message.burnAfterReadSeconds ? 'Burn message' : 'Message',
        lastMessageSenderId: message.senderPublicId,
        updatedAtMs: message.createdAtMs,
      };

      transaction.create(messageRef, {
        ...message,
        expiresAt: Timestamp.fromMillis(message.expiresAtMs),
      });
      transaction.update(conversationRef, { updatedAtMs: message.createdAtMs });
      transaction.set(
        this.memberConversation(message.senderPublicId, message.conversationId),
        { ...summary, participantPublicId: recipientPublicId },
        { merge: true },
      );
      transaction.set(
        this.memberConversation(recipientPublicId, message.conversationId),
        {
          ...summary,
          participantPublicId: message.senderPublicId,
          unreadCount: FieldValue.increment(1),
        },
        { merge: true },
      );

      return message;
    });
  }

  async openBurnMessage(
    conversationId: string,
    messageId: string,
    publicId: string,
    nowMs: number,
  ): Promise<OpenBurnMessageResult> {
    const messageRef = this.messages(conversationId).doc(messageId);

    return await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(messageRef);
      if (!snapshot.exists) return { status: 'not_found' };

      const message = snapshot.data() as ChatMessage;
      if (message.expiresAtMs <= nowMs) {
        transaction.delete(messageRef);
        return { status: 'not_found' };
      }
      if (!message.burnAfterReadSeconds || message.senderPublicId === publicId) {
        return { status: 'not_burnable' };
      }
      if (message.burnStartedAtMs !== undefined) {
        return { message: { ...message, locked: false }, status: 'opened' };
      }

      const expiresAtMs = Math.min(
        message.expiresAtMs,
        nowMs + message.burnAfterReadSeconds * 1_000,
      );
      const opened = { ...message, burnStartedAtMs: nowMs, expiresAtMs, locked: false };
      transaction.update(messageRef, {
        burnStartedAtMs: nowMs,
        expiresAt: Timestamp.fromMillis(expiresAtMs),
        expiresAtMs,
        locked: false,
      });
      return { message: opened, status: 'opened' };
    });
  }

  async markRead(conversationId: string, publicId: string, readAtMs: number): Promise<void> {
    await this.memberConversation(publicId, conversationId).set(
      { lastReadAtMs: readAtMs, unreadCount: 0 },
      { merge: true },
    );
  }

  async purgeExpiredMessages(nowMs: number, limit: number): Promise<number> {
    const [explicitlyExpired, retentionExpired] = await Promise.all([
      this.db.collectionGroup('messages').where('expiresAtMs', '<=', nowMs).limit(limit).get(),
      this.db
        .collectionGroup('messages')
        .where('createdAtMs', '<=', nowMs - CHAT_MESSAGE_RETENTION_MS)
        .limit(limit)
        .get(),
    ]);
    const expired = new Map(
      [...explicitlyExpired.docs, ...retentionExpired.docs]
        .slice(0, limit)
        .map((document) => [document.ref.path, document] as const),
    );
    if (expired.size === 0) return 0;

    const batch = this.db.batch();
    for (const document of expired.values()) batch.delete(document.ref);
    await batch.commit();
    return expired.size;
  }

  private conversations() {
    return this.db.collection(`${this.collectionPrefix}_chat_conversations`);
  }

  private messages(conversationId: string) {
    return this.conversations().doc(conversationId).collection('messages');
  }

  private memberConversations(publicId: string) {
    return this.db
      .collection(`${this.collectionPrefix}_chat_members`)
      .doc(publicId)
      .collection('conversations');
  }

  private memberConversation(publicId: string, conversationId: string) {
    return this.memberConversations(publicId).doc(conversationId);
  }

  private toConversation(
    id: string,
    data: FirebaseFirestore.DocumentData | undefined,
  ): ChatConversation {
    if (
      !data ||
      !Array.isArray(data.participants) ||
      data.participants.length !== 2 ||
      typeof data.createdAtMs !== 'number' ||
      typeof data.updatedAtMs !== 'number'
    ) {
      throw new Error(`Invalid chat conversation: ${id}`);
    }

    return {
      createdAtMs: data.createdAtMs,
      id,
      participants: data.participants as [string, string],
      updatedAtMs: data.updatedAtMs,
    };
  }
}
