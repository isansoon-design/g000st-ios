import { z } from 'zod';

export const contactSchema = z.object({
  addedAtMs: z.number(),
  avatarUrl: z.url().optional(),
  displayName: z.string().optional(),
  nickname: z.string().optional(),
  online: z.boolean(),
  publicId: z.string(),
});

export const contactListSchema = z.object({ items: z.array(contactSchema) });

export type Contact = z.infer<typeof contactSchema>;
