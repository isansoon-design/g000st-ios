import { z } from 'zod';

export const callMediaSchema = z.enum(['audio', 'video']);
export const callStatusSchema = z.enum(['ringing', 'in_progress', 'ended', 'missed', 'rejected']);

export const turnCredentialSchema = z.object({
  urls: z.array(z.string()),
  username: z.string(),
  credential: z.string(),
  expiresAtMs: z.number(),
});

export const callHistoryEntrySchema = z.object({
  id: z.string(),
  callerPublicId: z.string(),
  calleePublicId: z.string(),
  media: callMediaSchema,
  status: callStatusSchema,
  startedAtMs: z.number(),
  answeredAtMs: z.number().optional(),
  endedAtMs: z.number().optional(),
});

export const callHistoryPageSchema = z.object({
  items: z.array(callHistoryEntrySchema),
  nextCursor: z.string().optional(),
});

export type CallMedia = z.infer<typeof callMediaSchema>;
export type CallStatus = z.infer<typeof callStatusSchema>;
export type TurnCredential = z.infer<typeof turnCredentialSchema>;
export type CallHistoryEntry = z.infer<typeof callHistoryEntrySchema>;
