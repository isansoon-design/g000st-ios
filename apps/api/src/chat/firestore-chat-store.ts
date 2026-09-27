import { createHash } from 'node:crypto';

import { FieldPath, FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';

import { encodeChatCursor } from './chat-cursor.js';
import { isLegacyTwoHourMessage } from './chat-policy.js';
import type {
  ChatStore,
  CreateTextMessageResult,
  OpenBurnMessageResult,
} from './chat-store.js';
import type {
  ChatConversation,
  ChatConversationMemberSummary,
  ChatMessage,
  ChatMessageCursor,
  ChatMessagePage,
  ChatReadState,
} from './chat-types.js';

type StoredConversation = Readonly<{
  createdAtMs: number;
  kind: 'private' | 'market';
  marketPostId?: string;
  participants: readonly [string, string];
  updatedAtMs: number;
}>;

type StoredConversationSummary = Omit<ChatConversationMemberSummary, 'conversationId'> & {
  hiddenAtMs?: number;
};

export class FirestoreChatStore implements ChatStore {
  constructor(
    private readonly db: Firestore,
    private readonly collectionPrefix: string,
  ) {}

  async getOrCreateConversation(
    firstPublicId: string,
    secondPublicId: string,
    nowMs: number,
    marketPostId?: string,
  ): Promise<ChatConversation> {
    const participants = [firstPublicId, secondPublicId].sort() as [string, string];
    const conversationId = createHash('sha256')
      .update(marketPostId ? `market\0${marketPostId}\0${participants.join('\0')}` : participants.join('\0'))
      .digest('hex');
    const conversationRef = this.conversations().doc(conversationId);

    return await this.db.runTransaction(async (transaction) => {
      const existing = await transaction.get(conversationRef);
      if (existing.exists) {
        transaction.set(this.memberConversation(firstPublicId, conversationId), {
          hiddenAtMs: FieldValue.delete(),
        }, { merge: true });
        return this.toConversation(existing.id, existing.data());
      }

      const conversation: StoredConversation = {
        createdAtMs: nowMs,
        kind: marketPostId ? 'market' : 'private',
        ...(marketPostId ? { marketPostId } : {}),
        participants,
        updatedAtMs: nowMs,
      };
      transaction.create(conversationRef, conversation);

      for (const publicId of participants) {
        const participantPublicId = participants.find((candidate) => candidate !== publicId)!;
        transaction.create(this.memberConversation(publicId, conversationId), {
          kind: conversation.kind,
          ...(marketPostId ? { marketPostId } : {}),
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

  async findConversationMember(
    publicId: string,
    conversationId: string,
  ): Promise<ChatConversationMemberSummary | null> {
    const snapshot = await this.memberConversation(publicId, conversationId).get();
    return snapshot.exists
      ? {
          ...(snapshot.data() as StoredConversationSummary),
          conversationId,
          kind: (snapshot.data() as StoredConversationSummary).kind ?? 'private',
        }
      : null;
  }

  async hideConversation(conversationId: string, publicId: string, nowMs: number): Promise<void> {
    const memberRef = this.memberConversation(publicId, conversationId);
    await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(memberRef);
      if (!snapshot.exists) throw new Error('Conversation membership disappeared.');
      const summary = snapshot.data() as StoredConversationSummary;
      transaction.set(memberRef, {
        hiddenAtMs: nowMs,
        firstUnreadCreatedAtMs: FieldValue.delete(),
        firstUnreadExpiresAtMs: FieldValue.delete(),
        firstUnreadMessageId: FieldValue.delete(),
        lastReadObservedAtMs: nowMs,
        ...(summary.lastMessageCreatedAtMs === undefined ? {} : { lastReadAtMs: summary.lastMessageCreatedAtMs }),
        ...(summary.lastMessageId === undefined ? {} : { lastReadMessageId: summary.lastMessageId }),
        unreadCount: 0,
      }, { merge: true });
    });
  }

  async findMessage(conversationId: string, messageId: string): Promise<ChatMessage | null> {
    const snapshot = await this.messages(conversationId).doc(messageId).get();
    return snapshot.exists ? this.toMessage(snapshot.id, snapshot.data()) : null;
  }

  async listConversations(
    publicId: string,
    limit: number,
    nowMs: number,
  ): Promise<readonly ChatConversationMemberSummary[]> {
    const visible: ChatConversationMemberSummary[] = [];
    let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
    while (visible.length < limit) {
      let query = this.memberConversations(publicId).orderBy('updatedAtMs', 'desc');
      if (cursor) query = query.startAfter(cursor);
      const snapshot = await query.limit(Math.max(limit, 50)).get();
      for (const document of snapshot.docs) {
        const { hiddenAtMs, ...summary } = document.data() as StoredConversationSummary;
        if (hiddenAtMs !== undefined) continue;
        visible.push({
          ...summary,
          conversationId: document.id,
          kind: summary.kind ?? 'private',
        });
        if (visible.length === limit) break;
      }
      if (snapshot.size < Math.max(limit, 50) || visible.length === limit) break;
      cursor = snapshot.docs.at(-1);
    }
    return await Promise.all(visible.map((summary) => this.reconcileUnreadSummary(publicId, summary, nowMs)));
  }

  async listMessages(
    conversationId: string,
    limit: number,
    nowMs: number,
    cursor?: ChatMessageCursor,
    visibleAfterMs?: number,
  ): Promise<ChatMessagePage> {
    const visible: ChatMessage[] = [];
    const batchSize = Math.min(Math.max(limit * 2, 50), 200);
    let scanCursor = cursor;
    let exhausted = false;

    while (visible.length < limit + 1 && !exhausted) {
      let query = this.messages(conversationId)
        .orderBy('createdAtMs', 'desc')
        .orderBy(FieldPath.documentId(), 'desc');
      if (scanCursor) query = query.startAfter(scanCursor.createdAtMs, scanCursor.id);

      const snapshot = await query.limit(batchSize).get();
      exhausted = snapshot.size < batchSize;

      for (const document of snapshot.docs) {
        const message = this.toMessage(document.id, document.data());
        scanCursor = { createdAtMs: message.createdAtMs, id: message.id };
        if (visibleAfterMs !== undefined && message.createdAtMs <= visibleAfterMs) {
          exhausted = true;
          break;
        }
        if (message.expiresAtMs === undefined || message.expiresAtMs > nowMs) visible.push(message);
        if (visible.length >= limit + 1) break;
      }

      if (snapshot.empty) exhausted = true;
    }

    const descendingPage = visible.slice(0, limit);
    const oldest = descendingPage.at(-1);
    return {
      messages: descendingPage.reverse(),
      ...(visible.length > limit && oldest
        ? { nextCursor: encodeChatCursor({ createdAtMs: oldest.createdAtMs, id: oldest.id }) }
        : {}),
    };
  }

  async createTextMessage(message: ChatMessage): Promise<CreateTextMessageResult> {
    const conversationRef = this.conversations().doc(message.conversationId);
    const messageRef = this.messages(message.conversationId).doc(message.id);

    return await this.db.runTransaction(async (transaction) => {
      const conversationSnapshot = await transaction.get(conversationRef);
      if (!conversationSnapshot.exists) throw new Error('Conversation disappeared.');

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
      const recipientMemberRef = this.memberConversation(
        recipientPublicId,
        message.conversationId,
      );
      const [existingMessage, recipientMember] = await Promise.all([
        transaction.get(messageRef),
        transaction.get(recipientMemberRef),
      ]);
      if (existingMessage.exists) {
        return {
          created: false,
          message: this.toMessage(existingMessage.id, existingMessage.data()),
        };
      }

      const recipientSummary = recipientMember.data() as StoredConversationSummary | undefined;
      const summary = {
        lastMessageCreatedAtMs: message.createdAtMs,
        lastMessageId: message.id,
        lastMessagePreview: this.messagePreview(message),
        lastMessageSenderId: message.senderPublicId,
        updatedAtMs: message.createdAtMs,
      };

      transaction.create(messageRef, {
        ...message,
        ...(message.expiresAtMs === undefined ? {} : { expiresAt: Timestamp.fromMillis(message.expiresAtMs) }),
      });
      transaction.update(conversationRef, { updatedAtMs: message.createdAtMs });
      transaction.set(
        this.memberConversation(message.senderPublicId, message.conversationId),
        { ...summary, hiddenAtMs: FieldValue.delete(), participantPublicId: recipientPublicId },
        { merge: true },
      );
      transaction.set(
        recipientMemberRef,
        {
          ...summary,
          hiddenAtMs: FieldValue.delete(),
          ...(recipientSummary?.unreadCount
            ? {}
            : {
                firstUnreadCreatedAtMs: message.createdAtMs,
                ...(message.expiresAtMs === undefined ? {} : { firstUnreadExpiresAtMs: message.expiresAtMs }),
                firstUnreadMessageId: message.id,
              }),
          participantPublicId: message.senderPublicId,
          unreadCount: FieldValue.increment(1),
        },
        { merge: true },
      );

      return { created: true, message };
    });
  }

  async editMessage(conversationId: string, messageId: string, senderPublicId: string, content: string, nowMs: number) {
    const messageRef = this.messages(conversationId).doc(messageId);
    return this.db.runTransaction(async (transaction) => {
      const messageSnapshot = await transaction.get(messageRef);
      if (!messageSnapshot.exists) return { status: 'not_found' as const };
      const message = this.toMessage(messageSnapshot.id, messageSnapshot.data());
      if (message.expiresAtMs !== undefined && message.expiresAtMs <= nowMs) return { status: 'not_found' as const };
      if (message.senderPublicId !== senderPublicId) return { status: 'forbidden' as const };
      if (message.type !== 'text' || message.attachments?.length || message.burnAfterReadSeconds || message.locked) return { status: 'not_editable' as const };
      const next = { ...message, content, editedAtMs: nowMs };
      transaction.update(messageRef, { content, editedAtMs: nowMs });
      return { status: 'updated' as const, message: next };
    });
  }

  async deleteMessage(conversationId: string, messageId: string, senderPublicId: string, nowMs: number) {
    const conversationRef = this.conversations().doc(conversationId);
    const messageRef = this.messages(conversationId).doc(messageId);
    return this.db.runTransaction(async (transaction) => {
      const [messageSnapshot, conversationSnapshot] = await Promise.all([
        transaction.get(messageRef),
        transaction.get(conversationRef),
      ]);
      if (!messageSnapshot.exists || !conversationSnapshot.exists) return { status: 'not_found' as const };
      const message = this.toMessage(messageSnapshot.id, messageSnapshot.data());
      if (message.expiresAtMs !== undefined && message.expiresAtMs <= nowMs) return { status: 'not_found' as const };
      if (message.senderPublicId !== senderPublicId) return { status: 'forbidden' as const };

      const conversation = this.toConversation(conversationSnapshot.id, conversationSnapshot.data());
      const memberRefs = conversation.participants.map((id) => this.memberConversation(id, conversationId));
      const members = await Promise.all(memberRefs.map((ref) => transaction.get(ref)));
      const updates = members.map((snapshot, index) => {
        const summary = snapshot.data() as StoredConversationSummary | undefined;
        if (!summary) return null;
        const publicId = conversation.participants[index];
        const wasUnread = publicId !== senderPublicId && summary.unreadCount > 0 &&
          (summary.lastReadAtMs === undefined || summary.lastReadMessageId === undefined ||
            message.createdAtMs > summary.lastReadAtMs ||
            (message.createdAtMs === summary.lastReadAtMs && message.id > summary.lastReadMessageId));
        const unreadCount = wasUnread ? Math.max(0, summary.unreadCount - 1) : summary.unreadCount;
        return {
          ...(summary.lastMessageId === messageId ? { lastMessage: true } : {}),
          ...(wasUnread ? {
            unreadCount,
            ...(unreadCount > 0
              ? { firstUnreadExpiresAtMs: 0 }
              : {
                  firstUnreadCreatedAtMs: FieldValue.delete(),
                  firstUnreadExpiresAtMs: FieldValue.delete(),
                  firstUnreadMessageId: FieldValue.delete(),
                }),
          } : {}),
        };
      });
      const replacingLast = updates.some((update) => update?.lastMessage);
      let previous: ChatMessage | undefined;
      let cursor: ChatMessageCursor | undefined;
      while (replacingLast && !previous) {
        let query = this.messages(conversationId)
          .orderBy('createdAtMs', 'desc')
          .orderBy(FieldPath.documentId(), 'desc');
        if (cursor) query = query.startAfter(cursor.createdAtMs, cursor.id);
        const snapshot = await transaction.get(query.limit(100));
        previous = snapshot.docs
          .map((document) => this.toMessage(document.id, document.data()))
          .find((candidate) => candidate.id !== messageId && (candidate.expiresAtMs === undefined || candidate.expiresAtMs > nowMs));
        const last = snapshot.docs.at(-1);
        if (!last || snapshot.size < 100) break;
        cursor = { createdAtMs: last.get('createdAtMs') as number, id: last.id };
      }

      transaction.delete(messageRef);
      members.forEach((snapshot, index) => {
        const update = updates[index];
        if (!snapshot.exists || !update) return;
        const { lastMessage: _lastMessage, ...unreadUpdate } = update;
        if (!update.lastMessage && Object.keys(unreadUpdate).length === 0) return;
        transaction.set(memberRefs[index]!, {
          ...unreadUpdate,
          ...(update.lastMessage ? previous
            ? {
                lastMessageCreatedAtMs: previous.createdAtMs,
                lastMessageId: previous.id,
                lastMessagePreview: this.messagePreview(previous),
                lastMessageSenderId: previous.senderPublicId,
                updatedAtMs: previous.createdAtMs,
              }
            : {
                lastMessageCreatedAtMs: FieldValue.delete(),
                lastMessageId: FieldValue.delete(),
                lastMessagePreview: '',
                lastMessageSenderId: FieldValue.delete(),
                updatedAtMs: conversation.createdAtMs,
              } : {}),
        }, { merge: true });
      });
      if (replacingLast) transaction.update(conversationRef, { updatedAtMs: previous?.createdAtMs ?? conversation.createdAtMs });
      return { status: 'deleted' as const, message };
    });
  }

  async openBurnMessage(
    conversationId: string,
    messageId: string,
    publicId: string,
    nowMs: number,
  ): Promise<OpenBurnMessageResult> {
    const messageRef = this.messages(conversationId).doc(messageId);
    const memberRef = this.memberConversation(publicId, conversationId);

    return await this.db.runTransaction(async (transaction) => {
      const [snapshot, memberSnapshot] = await Promise.all([
        transaction.get(messageRef),
        transaction.get(memberRef),
      ]);
      if (!snapshot.exists) return { status: 'not_found' };

      const message = this.toMessage(snapshot.id, snapshot.data());
      if (message.expiresAtMs !== undefined && message.expiresAtMs <= nowMs) {
        transaction.delete(messageRef);
        return { status: 'not_found' };
      }
      if (!message.burnAfterReadSeconds || message.senderPublicId === publicId) {
        return { status: 'not_burnable' };
      }
      if (message.burnStartedAtMs !== undefined) {
        return { message: { ...message, locked: false }, status: 'opened' };
      }

      const expiresAtMs = nowMs + message.burnAfterReadSeconds * 1_000;
      const opened = { ...message, burnStartedAtMs: nowMs, expiresAtMs, locked: false };
      transaction.update(messageRef, {
        burnStartedAtMs: nowMs,
        expiresAt: Timestamp.fromMillis(expiresAtMs),
        expiresAtMs,
        locked: false,
      });
      if (
        memberSnapshot.exists &&
        (memberSnapshot.data() as StoredConversationSummary).firstUnreadMessageId === message.id
      ) {
        transaction.set(memberRef, { firstUnreadExpiresAtMs: expiresAtMs }, { merge: true });
      }
      return { message: opened, status: 'opened' };
    });
  }

  async markRead(
    conversationId: string,
    publicId: string,
    readAtMs: number,
  ): Promise<ChatReadState> {
    const memberRef = this.memberConversation(publicId, conversationId);

    return await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(memberRef);
      if (!snapshot.exists) throw new Error('Conversation membership disappeared.');

      const summary = snapshot.data() as StoredConversationSummary;
      const state: ChatReadState = {
        ...(summary.lastMessageCreatedAtMs === undefined
          ? {}
          : { lastReadAtMs: summary.lastMessageCreatedAtMs }),
        ...(summary.lastMessageId === undefined
          ? {}
          : { lastReadMessageId: summary.lastMessageId }),
        unreadCount: 0,
      };
      transaction.set(
        memberRef,
        {
          firstUnreadCreatedAtMs: FieldValue.delete(),
          firstUnreadExpiresAtMs: FieldValue.delete(),
          firstUnreadMessageId: FieldValue.delete(),
          lastReadObservedAtMs: readAtMs,
          ...(state.lastReadAtMs === undefined ? {} : { lastReadAtMs: state.lastReadAtMs }),
          ...(state.lastReadMessageId === undefined
            ? {}
            : { lastReadMessageId: state.lastReadMessageId }),
          unreadCount: 0,
        },
        { merge: true },
      );
      return state;
    });
  }

  async purgeExpiredMessages(nowMs: number, limit: number): Promise<readonly ChatMessage[]> {
    // Clear legacy two-hour deadlines before Firestore TTL can remove messages retained for web.
    const candidates = await this.db.collectionGroup('messages')
      .where('expiresAtMs', '<=', nowMs + 60_000)
      .limit(limit)
      .get();
    if (candidates.empty) return [];

    const messages: ChatMessage[] = [];
    const batch = this.db.batch();
    let hasWrites = false;
    for (const document of candidates.docs) {
      const data = document.data();
      if (isLegacyTwoHourMessage(data as ChatMessage)) {
        batch.update(document.ref, {
          expiresAt: FieldValue.delete(),
          expiresAtMs: FieldValue.delete(),
        });
        hasWrites = true;
      } else if (typeof data.expiresAtMs === 'number' && data.expiresAtMs <= nowMs) {
        messages.push(this.toMessage(document.id, data));
        batch.delete(document.ref);
        hasWrites = true;
      }
    }
    if (hasWrites) await batch.commit();
    return messages;
  }

  private async reconcileUnreadSummary(
    publicId: string,
    summary: ChatConversationMemberSummary,
    nowMs: number,
  ): Promise<ChatConversationMemberSummary> {
    if (
      summary.unreadCount === 0 ||
      (summary.firstUnreadMessageId !== undefined &&
        (summary.firstUnreadExpiresAtMs === undefined || summary.firstUnreadExpiresAtMs > nowMs))
    ) {
      return summary;
    }

    const unread: ChatMessage[] = [];
    const batchSize = 200;
    let scanCursor: ChatMessageCursor | undefined =
      summary.lastReadAtMs === undefined || summary.lastReadMessageId === undefined
        ? undefined
        : { createdAtMs: summary.lastReadAtMs, id: summary.lastReadMessageId };

    while (true) {
      let query = this.messages(summary.conversationId)
        .orderBy('createdAtMs', 'asc')
        .orderBy(FieldPath.documentId(), 'asc');
      if (scanCursor) query = query.startAfter(scanCursor.createdAtMs, scanCursor.id);

      const snapshot = await query.limit(batchSize).get();
      for (const document of snapshot.docs) {
        const message = this.toMessage(document.id, document.data());
        scanCursor = { createdAtMs: message.createdAtMs, id: message.id };
        if (
          (message.expiresAtMs === undefined || message.expiresAtMs > nowMs) &&
          message.senderPublicId === summary.participantPublicId
        ) {
          unread.push(message);
        }
      }
      if (snapshot.size < batchSize) break;
    }

    const firstUnread = unread[0];
    const reconciled: ChatConversationMemberSummary = {
      ...summary,
      ...(firstUnread
        ? {
            firstUnreadCreatedAtMs: firstUnread.createdAtMs,
            firstUnreadExpiresAtMs: firstUnread.expiresAtMs,
            firstUnreadMessageId: firstUnread.id,
          }
        : {
            firstUnreadCreatedAtMs: undefined,
            firstUnreadExpiresAtMs: undefined,
            firstUnreadMessageId: undefined,
          }),
      unreadCount: unread.length,
    };
    const memberRef = this.memberConversation(publicId, summary.conversationId);

    return await this.db.runTransaction(async (transaction) => {
      const currentSnapshot = await transaction.get(memberRef);
      if (!currentSnapshot.exists) return reconciled;

      const current = currentSnapshot.data() as StoredConversationSummary;
      if (
        current.updatedAtMs !== summary.updatedAtMs ||
        current.lastMessageId !== summary.lastMessageId
      ) {
        return { ...current, conversationId: summary.conversationId, kind: current.kind ?? 'private' };
      }

      transaction.set(
        memberRef,
        firstUnread
          ? {
              firstUnreadCreatedAtMs: firstUnread.createdAtMs,
              firstUnreadExpiresAtMs: firstUnread.expiresAtMs === undefined ? FieldValue.delete() : firstUnread.expiresAtMs,
              firstUnreadMessageId: firstUnread.id,
              unreadCount: unread.length,
            }
          : {
              firstUnreadCreatedAtMs: FieldValue.delete(),
              firstUnreadExpiresAtMs: FieldValue.delete(),
              firstUnreadMessageId: FieldValue.delete(),
              unreadCount: 0,
            },
        { merge: true },
      );
      return reconciled;
    });
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
      kind: data.kind === 'market' ? 'market' : 'private',
      ...(typeof data.marketPostId === 'string' ? { marketPostId: data.marketPostId } : {}),
      participants: data.participants as [string, string],
      updatedAtMs: data.updatedAtMs,
    };
  }

  private toMessage(
    id: string,
    data: FirebaseFirestore.DocumentData | undefined,
  ): ChatMessage {
    if (!data || typeof data.createdAtMs !== 'number') {
      throw new Error(`Invalid chat message: ${id}`);
    }

    return {
      ...(data as ChatMessage),
      ...(isLegacyTwoHourMessage(data as ChatMessage) ? { expiresAtMs: undefined } : {}),
      id,
      locked: false,
    };
  }

  private messagePreview(message: ChatMessage): string {
    if (message.burnAfterReadSeconds) return 'Burn message';
    const first = message.attachments?.[0];
    if (!first) return 'Message';
    if (message.attachments.length > 1) return `${message.attachments.length} attachments`;
    return first.kind === 'image'
      ? 'Photo'
      : first.kind === 'video'
        ? 'Video'
        : first.kind === 'audio'
          ? 'Voice message'
          : 'Document';
  }
}
