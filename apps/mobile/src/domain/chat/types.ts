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
  lastMessagePreview: z.string(),
  lastMessageSenderId: g000stIdSchema.optional(),
  participantPublicId: g000stIdSchema,
  unreadCount: z.number().int().nonnegative(),
  updatedAtMs: z.number().int().positive(),
});

export const chatMessageSchema = z.object({
  clientMessageId: z.string().uuid(),
  content: z.string().min(1).max(4_000),
  conversationId: conversationIdSchema,
  createdAtMs: z.number().int().positive(),
  id: z.string().uuid(),
  senderPublicId: g000stIdSchema,
  type: z.literal('text'),
});

export const chatConversationListSchema = z.object({
  conversations: z.array(chatConversationSummarySchema),
});

export const startChatConversationResultSchema = z.object({
  conversation: chatConversationSchema,
});

export const chatMessagePageSchema = z.object({
  messages: z.array(chatMessageSchema),
  nextBefore: z.number().int().positive().optional(),
});

export const sendChatMessageResultSchema = z.object({
  message: chatMessageSchema,
});

export type ChatConversation = Readonly<z.infer<typeof chatConversationSchema>>;
export type ChatConversationSummary = Readonly<z.infer<typeof chatConversationSummarySchema>>;
export type ChatMessage = Readonly<z.infer<typeof chatMessageSchema>>;
export type ChatMessagePage = Readonly<z.infer<typeof chatMessagePageSchema>>;
