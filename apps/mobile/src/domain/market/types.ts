import { z } from 'zod';

const authorSchema = z.object({ publicId: z.string(), displayName: z.string(), avatarUrl: z.url().optional() });
const mediaSchema = z.object({ byteSize: z.number().int().positive(), contentType: z.string(), fileName: z.string(), id: z.uuid(), kind: z.enum(['image', 'video']), url: z.url() });
export const marketPostSchema = z.object({ id: z.uuid(), ownerPublicId: z.string(), author: authorSchema, content: z.string(), price: z.number().nonnegative(), currency: z.string().length(3), quantity: z.number().int().positive(), city: z.string(), media: z.array(mediaSchema).max(2).optional(), createdAtMs: z.number(), updatedAtMs: z.number(), editedAtMs: z.number().optional(), likeCount: z.number().int(), commentCount: z.number().int(), likedByViewer: z.boolean(), ownedByViewer: z.boolean() });
export const marketCommentSchema = z.object({ id: z.uuid(), postId: z.uuid(), ownerPublicId: z.string(), author: authorSchema, content: z.string(), createdAtMs: z.number(), ownedByViewer: z.boolean() });
export const marketPostPageSchema = z.object({ items: z.array(marketPostSchema), nextCursor: z.string().optional() });
export const marketCommentPageSchema = z.object({ items: z.array(marketCommentSchema), nextCursor: z.string().optional() });
export const marketPostResultSchema = z.object({ post: marketPostSchema });
export const marketCommentResultSchema = z.object({ comment: marketCommentSchema });
export const marketLikeResultSchema = z.object({ liked: z.boolean(), likeCount: z.number().int() });
export type MarketPost = z.infer<typeof marketPostSchema>;
export type MarketComment = z.infer<typeof marketCommentSchema>;
export type MarketPostFields = Pick<MarketPost, 'content' | 'price' | 'currency' | 'quantity' | 'city'>;
