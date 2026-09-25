import { z } from 'zod';

import { g000stIdSchema } from '@/domain/auth/types';

const conversationIdSchema = z.string().length(64).regex(/^[a-f0-9]+$/);

export const chatConversationSchema = z.object({
  createdAtMs: z.number().int().positive(),
  id: conversationIdSchema,
  participants: z.tuple([g000stIdSchema, g000stIdSchema]),
  updatedAtMs: z.number().int().positive(),
});

export const chatConversationSummarySchema = z.object({
  conversationId: conversationIdSchema,
  firstUnreadCreatedAtMs: z.number().int().positive().optional(),
  firstUnreadExpiresAtMs: z.number().int().positive().optional(),
  firstUnreadMessageId: z.string().uuid().optional(),
  lastMessageCreatedAtMs: z.number().int().positive().optional(),
  lastMessageId: z.string().uuid().optional(),
  lastMessagePreview: z.string(),
  lastMessageSenderId: g000stIdSchema.optional(),
  lastReadAtMs: z.number().int().positive().optional(),
  lastReadMessageId: z.string().uuid().optional(),
  lastReadObservedAtMs: z.number().int().positive().optional(),
  participantDisplayName: z.string().optional(),
  participantPublicId: g000stIdSchema,
  participantStatus: z.enum(['active', 'deleted']),
  unreadCount: z.number().int().nonnegative(),
  updatedAtMs: z.number().int().positive(),
});

export const chatMessageSchema = z.object({
  attachments: z
    .array(
      z.object({
        byteSize: z.number().int().positive(),
        contentType: z.string().min(1),
        durationMs: z.number().int().min(1).max(5 * 60 * 1_000).optional(),
        fileName: z.string().min(1),
        id: z.string().uuid(),
        kind: z.enum(['audio', 'document', 'image', 'video']),
        objectKey: z.string().min(1),
      }),
    )
    .max(3)
    .optional(),
  burnAfterReadSeconds: z.literal(5).optional(),
  burnStartedAtMs: z.number().int().positive().optional(),
  clientMessageId: z.string().uuid(),
  content: z.string().max(4_000),
  conversationId: conversationIdSchema,
  createdAtMs: z.number().int().positive(),
  editedAtMs: z.number().int().positive().optional(),
  expiresAtMs: z.number().int().positive(),
  id: z.string().uuid(),
  locked: z.boolean(),
  readAtMs: z.number().int().positive().optional(),
  senderPublicId: g000stIdSchema,
  type: z.enum(['text', 'voice']),
});

export const chatConversationListSchema = z.object({
  conversations: z.array(chatConversationSummarySchema),
});

export const startChatConversationResultSchema = z.object({
  conversation: chatConversationSchema,
});

export const chatMessagePageSchema = z.object({
  messages: z.array(chatMessageSchema),
  nextCursor: z.string().min(1).optional(),
});

export const sendChatMessageResultSchema = z.object({
  message: chatMessageSchema,
});

export type ChatConversation = Readonly<z.infer<typeof chatConversationSchema>>;
export type ChatConversationSummary = Readonly<z.infer<typeof chatConversationSummarySchema>>;
export type ChatMessage = Readonly<z.infer<typeof chatMessageSchema>>;
export type ChatMessagePage = Readonly<z.infer<typeof chatMessagePageSchema>>;
