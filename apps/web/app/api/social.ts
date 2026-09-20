import axios from './axios';

export type SocialVisibility = 'anonymous' | 'public';
export type SocialAuthor = { publicId?: string; displayName: string; avatarUrl?: string };
export type SocialPost = { id: string; ownerPublicId?: string; author: SocialAuthor; content: string; media?: SocialMedia[]; visibility: SocialVisibility; createdAtMs: number; updatedAtMs: number; editedAtMs?: number; likeCount: number; commentCount: number; likedByViewer: boolean; campedByViewer: boolean; ownedByViewer: boolean };
export type SocialComment = { id: string; postId: string; ownerPublicId?: string; author: SocialAuthor; content: string; visibility: SocialVisibility; createdAtMs: number; ownedByViewer: boolean };
export type SocialAlert = { id: string; kind: 'like' | 'comment' | 'camp'; actor: SocialAuthor; postId?: string; commentId?: string; createdAtMs: number; readAtMs?: number };
export type SocialProfile = { publicId: string; displayName?: string; avatarUrl?: string; country?: string; age?: number; sex?: 'male' | 'female'; hobby?: string; bio?: string; updatedAtMs: number; campedByViewer: boolean };
export type SocialPage<T> = { items: T[]; nextCursor?: string };
export type SocialMedia = { byteSize: number; contentType: string; fileName: string; id: string; kind: 'image' | 'video'; url: string };
export type PendingSocialMedia = { byteSize: number; contentType: string; fileName: string; id: string; objectKey: string };
export type PendingAvatarMedia = { byteSize: number; contentType: string; fileName: string; id: string; objectKey: string };

export async function listSocialPosts(cursor?: string, ownerId?: string) { const { data } = await axios.get<SocialPage<SocialPost>>('/social/posts', { params: { cursor, limit: 10, ownerId } }); return data; }
export async function createSocialPost(clientPostId: string, content: string, visibility: SocialVisibility, media?: PendingSocialMedia[]) { const { data } = await axios.post<{ post: SocialPost }>('/social/posts', { clientPostId, content, visibility, ...(media?.length ? { media } : {}) }); return data.post; }
export async function uploadSocialMedia(clientPostId: string, file: File): Promise<PendingSocialMedia> { const { data } = await axios.post<{ upload: { media: PendingSocialMedia; headers: Record<string, string>; uploadUrl: string } }>('/social/uploads', { byteSize: file.size, clientPostId, contentType: file.type, fileName: file.name }); const uploaded = await fetch(data.upload.uploadUrl, { method: 'PUT', headers: data.upload.headers, body: file }); if (!uploaded.ok) throw new Error('Media upload failed.'); return data.upload.media; }
export async function updateSocialPost(postId: string, content: string) { const { data } = await axios.patch<{ post: SocialPost }>(`/social/posts/${postId}`, { content }); return data.post; }
export async function deleteSocialPost(postId: string) { await axios.delete(`/social/posts/${postId}`); }
export async function toggleSocialLike(postId: string) { const { data } = await axios.post<{ liked: boolean; likeCount: number }>(`/social/posts/${postId}/like`); return data; }
export async function listSocialComments(postId: string) { const { data } = await axios.get<SocialPage<SocialComment>>(`/social/posts/${postId}/comments`, { params: { limit: 50 } }); return data.items; }
export async function createSocialComment(postId: string, content: string, visibility: SocialVisibility) { const { data } = await axios.post<{ comment: SocialComment }>(`/social/posts/${postId}/comments`, { content, visibility }); return data.comment; }
export async function deleteSocialComment(postId: string, commentId: string) { await axios.delete(`/social/posts/${postId}/comments/${commentId}`); }
export async function toggleSocialCamp(publicId: string) { const { data } = await axios.post<{ camped: boolean }>(`/social/profiles/${publicId}/camp`); return data; }
export async function getSocialProfile(publicId: string) { const { data } = await axios.get<{ profile: SocialProfile }>(`/social/profiles/${publicId}`); return data.profile; }
export async function uploadAvatarMedia(file: File): Promise<PendingAvatarMedia> { const { data } = await axios.post<{ upload: { media: PendingAvatarMedia; headers: Record<string, string>; uploadUrl: string } }>('/social/avatar-uploads', { byteSize: file.size, contentType: file.type, fileName: file.name }); const uploaded = await fetch(data.upload.uploadUrl, { method: 'PUT', headers: data.upload.headers, body: file }); if (!uploaded.ok) throw new Error('Photo upload failed.'); return data.upload.media; }
export async function updateSocialProfile(profile: Partial<Omit<SocialProfile, 'publicId' | 'updatedAtMs' | 'campedByViewer' | 'avatarUrl'>> & { avatarMedia?: PendingAvatarMedia }) { const { data } = await axios.put<{ profile: SocialProfile }>('/social/profile', profile); return data.profile; }
export async function listSocialAlerts() { const { data } = await axios.get<SocialPage<SocialAlert>>('/social/alerts', { params: { limit: 50 } }); return data.items; }
export async function markSocialAlertsRead() { await axios.post('/social/alerts/read'); }
export async function reportSocialPost(postId: string, reason: string, details?: string) { await axios.post('/social/reports', { postId, reason, ...(details ? { details } : {}) }); }
