import { z } from 'zod';

export const socialVisibilitySchema = z.enum(['anonymous', 'public']);
const authorSchema = z.object({ publicId: z.string().optional(), displayName: z.string(), avatarUrl: z.url().optional() });
const socialMediaSchema = z.object({ byteSize: z.number().int().positive(), contentType: z.string(), fileName: z.string(), id: z.uuid(), kind: z.enum(['image', 'video']), url: z.url() });
export const socialPostSchema = z.object({ id: z.uuid(), ownerPublicId: z.string().optional(), author: authorSchema, content: z.string(), media: z.array(socialMediaSchema).max(2).optional(), visibility: socialVisibilitySchema, createdAtMs: z.number(), updatedAtMs: z.number(), editedAtMs: z.number().optional(), likeCount: z.number().int(), commentCount: z.number().int(), likedByViewer: z.boolean(), campedByViewer: z.boolean(), ownedByViewer: z.boolean() });
export const socialCommentSchema = z.object({ id: z.uuid(), postId: z.uuid(), ownerPublicId: z.string().optional(), author: authorSchema, content: z.string(), visibility: socialVisibilitySchema, createdAtMs: z.number(), ownedByViewer: z.boolean() });
export const socialAlertSchema = z.object({ id: z.uuid(), kind: z.enum(['like', 'comment', 'camp']), actor: authorSchema, postId: z.uuid().optional(), commentId: z.uuid().optional(), createdAtMs: z.number(), readAtMs: z.number().optional() });
export const socialPostPageSchema = z.object({ items: z.array(socialPostSchema), nextCursor: z.string().optional() });
export const socialCommentPageSchema = z.object({ items: z.array(socialCommentSchema), nextCursor: z.string().optional() });
export const socialAlertPageSchema = z.object({ items: z.array(socialAlertSchema), nextCursor: z.string().optional() });
export const socialPostResultSchema = z.object({ post: socialPostSchema });
export const socialCommentResultSchema = z.object({ comment: socialCommentSchema });
export const socialLikeResultSchema = z.object({ liked: z.boolean(), likeCount: z.number().int() });
export const socialCampResultSchema = z.object({ camped: z.boolean() });
export const socialProfileSchema = z.object({ publicId: z.string(), displayName: z.string().optional(), avatarUrl: z.url().optional(), country: z.string().optional(), age: z.number().int().optional(), sex: z.enum(['male', 'female']).optional(), hobby: z.string().optional(), bio: z.string().optional(), updatedAtMs: z.number(), campedByViewer: z.boolean().optional() });
export const socialProfileResultSchema = z.object({ profile: socialProfileSchema });

export type SocialVisibility = z.infer<typeof socialVisibilitySchema>;
export type SocialPost = z.infer<typeof socialPostSchema>;
export type SocialComment = z.infer<typeof socialCommentSchema>;
export type SocialAlert = z.infer<typeof socialAlertSchema>;
export type SocialProfile = z.infer<typeof socialProfileSchema>;
