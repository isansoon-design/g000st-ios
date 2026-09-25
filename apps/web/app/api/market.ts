import axios from './axios';

export type MarketAuthor = { publicId: string; displayName: string; avatarUrl?: string };
export type MarketMedia = { id: string; kind: 'image' | 'video'; url: string; fileName: string; contentType: string; byteSize: number };
export type MarketPost = { id: string; ownerPublicId: string; author: MarketAuthor; content: string; price: number; currency: string; quantity: number; city: string; allowCalls?: boolean; allowVideoCalls?: boolean; media?: MarketMedia[]; createdAtMs: number; updatedAtMs: number; editedAtMs?: number; likeCount: number; commentCount: number; likedByViewer: boolean; ownedByViewer: boolean };
export type MarketComment = { id: string; postId: string; ownerPublicId: string; author: MarketAuthor; content: string; createdAtMs: number; ownedByViewer: boolean };
export type MarketPage<T> = { items: T[]; nextCursor?: string };
export type MarketPostFields = Pick<MarketPost, 'content' | 'price' | 'currency' | 'quantity' | 'city'> & { allowCalls: boolean; allowVideoCalls: boolean };
export type PendingMarketMedia = { byteSize: number; contentType: string; fileName: string; id: string; objectKey: string };

export async function listMarketPosts(cursor?: string, ownerId?: string) { const { data } = await axios.get<MarketPage<MarketPost>>('/market/posts', { params: { cursor, ownerId, limit: 10 } }); return data; }
export async function createMarketPost(clientPostId: string, fields: MarketPostFields, media?: PendingMarketMedia[]) { const { data } = await axios.post<{ post: MarketPost }>('/market/posts', { clientPostId, ...fields, ...(media?.length ? { media } : {}) }); return data.post; }
export async function updateMarketPost(postId: string, fields: MarketPostFields) { const { data } = await axios.patch<{ post: MarketPost }>(`/market/posts/${postId}`, fields); return data.post; }
export async function deleteMarketPost(postId: string) { await axios.delete(`/market/posts/${postId}`); }
export async function toggleMarketLike(postId: string) { const { data } = await axios.post<{ liked: boolean; likeCount: number }>(`/market/posts/${postId}/like`); return data; }
export async function listMarketComments(postId: string, cursor?: string) { const { data } = await axios.get<MarketPage<MarketComment>>(`/market/posts/${postId}/comments`, { params: { cursor, limit: 20 } }); return data; }
export async function createMarketComment(postId: string, content: string) { const { data } = await axios.post<{ comment: MarketComment }>(`/market/posts/${postId}/comments`, { content }); return data.comment; }
export async function deleteMarketComment(postId: string, commentId: string) { await axios.delete(`/market/posts/${postId}/comments/${commentId}`); }
export async function uploadMarketMedia(clientPostId: string, file: File): Promise<PendingMarketMedia> { const { data } = await axios.post<{ upload: { media: PendingMarketMedia; headers: Record<string, string>; uploadUrl: string } }>('/market/uploads', { byteSize: file.size, clientPostId, contentType: file.type, fileName: file.name }); const result = await fetch(data.upload.uploadUrl, { method: 'PUT', headers: data.upload.headers, body: file }); if (!result.ok) throw new Error('Media upload failed.'); return data.upload.media; }
