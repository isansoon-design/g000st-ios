import { File, UploadType } from 'expo-file-system';
import { z } from 'zod';

import axiosInstance from '@/api/axios';
import { resolvePostAuthors } from '@/api/post-authors';
import { getSocialProfile } from '@/api/social';
import { parseApiPayload } from '@/api/parse-api-payload';
import { marketCommentPageSchema, marketCommentResultSchema, marketLikeResultSchema, marketPostPageSchema, marketPostResultSchema, type MarketPostFields } from '@/domain/market/types';

const pendingMediaSchema = z.object({ byteSize: z.number().int().positive(), contentType: z.string(), fileName: z.string(), id: z.uuid(), objectKey: z.string() });
const uploadSchema = z.object({ upload: z.object({ media: pendingMediaSchema, headers: z.record(z.string(), z.string()), uploadUrl: z.url() }) });
export type PendingMarketMedia = z.infer<typeof pendingMediaSchema>;

export async function listMarketPosts(ownerId?: string, cursor?: string) { const response = await axiosInstance.get('/market/posts', { params: { ownerId, cursor, limit: 10 } }); const page = parseApiPayload(marketPostPageSchema, response.data); return { ...page, items: await resolvePostAuthors(page.items, getSocialProfile) }; }
export async function getMarketPost(postId: string) { const response = await axiosInstance.get(`/market/posts/${postId}`); return (await resolvePostAuthors([parseApiPayload(marketPostResultSchema, response.data).post], getSocialProfile))[0]; }
export async function createMarketPost(clientPostId: string, fields: MarketPostFields, media?: PendingMarketMedia[]) { const response = await axiosInstance.post('/market/posts', { clientPostId, ...fields, ...(media?.length ? { media } : {}) }); return (await resolvePostAuthors([parseApiPayload(marketPostResultSchema, response.data).post], getSocialProfile))[0]; }
export async function updateMarketPost(postId: string, fields: MarketPostFields) { const response = await axiosInstance.patch(`/market/posts/${postId}`, fields); return (await resolvePostAuthors([parseApiPayload(marketPostResultSchema, response.data).post], getSocialProfile))[0]; }
export async function deleteMarketPost(postId: string) { await axiosInstance.delete(`/market/posts/${postId}`); }
export async function reportMarketPost(postId: string) { await axiosInstance.post('/market/reports', { postId, reason: 'other' }); }
export async function toggleMarketLike(postId: string) { const response = await axiosInstance.post(`/market/posts/${postId}/like`); return parseApiPayload(marketLikeResultSchema, response.data); }
export async function listMarketComments(postId: string, cursor?: string) { const response = await axiosInstance.get(`/market/posts/${postId}/comments`, { params: { cursor, limit: 20 } }); return parseApiPayload(marketCommentPageSchema, response.data); }
export async function createMarketComment(postId: string, content: string) { const response = await axiosInstance.post(`/market/posts/${postId}/comments`, { content }); return parseApiPayload(marketCommentResultSchema, response.data).comment; }
export async function deleteMarketComment(postId: string, commentId: string) { await axiosInstance.delete(`/market/posts/${postId}/comments/${commentId}`); }
export async function uploadMarketMedia(input: Readonly<{ byteSize: number; clientPostId: string; contentType: string; fileName: string; uri: string }>) { const response = await axiosInstance.post('/market/uploads', { byteSize: input.byteSize, clientPostId: input.clientPostId, contentType: input.contentType, fileName: input.fileName }); const upload = parseApiPayload(uploadSchema, response.data).upload; const result = await new File(input.uri).upload(upload.uploadUrl, { headers: { ...upload.headers }, httpMethod: 'PUT', uploadType: UploadType.BINARY_CONTENT }); if (result.status < 200 || result.status >= 300) throw new Error(`Media upload failed (${result.status}).`); return upload.media; }
