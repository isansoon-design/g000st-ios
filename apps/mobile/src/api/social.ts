import { File, UploadType } from "expo-file-system";
import { z } from "zod";

import axiosInstance from "@/api/axios";
import { resolvePostAuthors } from "@/api/post-authors";
import { parseApiPayload } from "@/api/parse-api-payload";
import {
    socialAlertPageSchema,
    socialCampResultSchema,
    socialCommentPageSchema,
    socialCommentResultSchema,
    socialLikeResultSchema,
    socialPostPageSchema,
    socialPostResultSchema,
    socialProfileResultSchema,
    socialSuggestionsSchema,
    type SocialProfile,
    type SocialVisibility,
} from "@/domain/social/types";

export async function listSocialPosts(ownerId?: string, cursor?: string, publicOnly = false) {
  const response = await axiosInstance.get("/social/posts", {
    params: { cursor, limit: 10, ownerId, ...(publicOnly ? { publicOnly: 'true' } : {}) },
  });
  const page = parseApiPayload(socialPostPageSchema, response.data);
  return { ...page, items: await resolvePostAuthors(page.items, getSocialProfile) };
}
export async function getSocialPost(postId: string) {
  const response = await axiosInstance.get(`/social/posts/${postId}`);
  return (await resolvePostAuthors([parseApiPayload(socialPostResultSchema, response.data).post], getSocialProfile))[0];
}
const pendingSocialMediaSchema = z.object({
  byteSize: z.number().int().positive(),
  contentType: z.string(),
  fileName: z.string(),
  id: z.uuid(),
  objectKey: z.string(),
});
const socialUploadSchema = z.object({
  upload: z.object({
    media: pendingSocialMediaSchema,
    headers: z.record(z.string(), z.string()),
    uploadUrl: z.url(),
  }),
});
export type PendingSocialMedia = z.infer<typeof pendingSocialMediaSchema>;
export async function createSocialPost(
  clientPostId: string,
  content: string,
  visibility: SocialVisibility,
  media?: PendingSocialMedia[],
  sharedPostId?: string,
  actingPublicId?: string,
  shareToSocial = true,
) {
  const response = await axiosInstance.post("/social/posts", {
    clientPostId,
    content,
    visibility,
    ...(shareToSocial ? {} : { shareToSocial }),
    ...(media?.length ? { media } : {}),
    ...(sharedPostId ? { sharedPostId } : {}),
  }, { headers: actingPublicId ? { 'X-Acting-Public-Id': actingPublicId } : undefined });
  return (await resolvePostAuthors([parseApiPayload(socialPostResultSchema, response.data).post], getSocialProfile))[0];
}
export async function shareSocialPostToSocial(postId: string, actingPublicId?: string) {
  const response = await axiosInstance.post(`/social/posts/${postId}/share-to-social`, undefined, {
    headers: actingPublicId ? { 'X-Acting-Public-Id': actingPublicId } : undefined,
  });
  return (await resolvePostAuthors([parseApiPayload(socialPostResultSchema, response.data).post], getSocialProfile))[0];
}
export async function uploadSocialMedia(
  input: Readonly<{
    byteSize: number;
    clientPostId: string;
    contentType: string;
    fileName: string;
    uri: string;
  }>,
  actingPublicId?: string,
) {
  const response = await axiosInstance.post("/social/uploads", {
    byteSize: input.byteSize,
    clientPostId: input.clientPostId,
    contentType: input.contentType,
    fileName: input.fileName,
  }, { headers: actingPublicId ? { 'X-Acting-Public-Id': actingPublicId } : undefined });
  const upload = parseApiPayload(socialUploadSchema, response.data).upload;
  const result = await new File(input.uri).upload(upload.uploadUrl, {
    headers: { ...upload.headers },
    httpMethod: "PUT",
    uploadType: UploadType.BINARY_CONTENT,
  });
  if (result.status < 200 || result.status >= 300)
    throw new Error(`Media upload failed (${result.status}).`);
  return upload.media;
}
export async function deleteSocialPost(postId: string) {
  await axiosInstance.delete(`/social/posts/${postId}`);
}
export async function updateSocialPost(postId: string, content: string) {
  const response = await axiosInstance.patch(`/social/posts/${postId}`, {
    content,
  });
  return (await resolvePostAuthors([parseApiPayload(socialPostResultSchema, response.data).post], getSocialProfile))[0];
}
export async function toggleSocialLike(postId: string) {
  const response = await axiosInstance.post(`/social/posts/${postId}/like`);
  return parseApiPayload(socialLikeResultSchema, response.data);
}
export async function listSocialComments(postId: string, cursor?: string) {
  const response = await axiosInstance.get(`/social/posts/${postId}/comments`, {
    params: { cursor, limit: 20 },
  });
  return parseApiPayload(socialCommentPageSchema, response.data);
}
export async function deleteSocialComment(postId: string, commentId: string) {
  await axiosInstance.delete(`/social/posts/${postId}/comments/${commentId}`);
}
export async function createSocialComment(
  postId: string,
  content: string,
  visibility: SocialVisibility,
) {
  const response = await axiosInstance.post(
    `/social/posts/${postId}/comments`,
    { content, visibility },
  );
  return parseApiPayload(socialCommentResultSchema, response.data).comment;
}
export async function toggleSocialCamp(publicId: string) {
  const response = await axiosInstance.post(
    `/social/profiles/${publicId}/camp`,
  );
  return parseApiPayload(socialCampResultSchema, response.data);
}
export async function listSocialSuggestions() {
  const response = await axiosInstance.get('/social/suggestions');
  return parseApiPayload(socialSuggestionsSchema, response.data);
}
export async function followSocialProfile(publicId: string) {
  await axiosInstance.post(`/social/profiles/${publicId}/follow`);
}
export async function listSocialAlerts() {
  const response = await axiosInstance.get("/social/alerts", {
    params: { limit: 50 },
  });
  return parseApiPayload(socialAlertPageSchema, response.data).items;
}
export async function markSocialAlertsRead() {
  await axiosInstance.post("/social/alerts/read");
}
export async function reportSocialPost(postId: string) {
  await axiosInstance.post("/social/reports", { postId, reason: "other" });
}
export async function getSocialProfile(publicId: string, actingPublicId?: string) {
  const response = await axiosInstance.get(`/social/profiles/${publicId}`, { headers: actingPublicId ? { 'X-Acting-Public-Id': actingPublicId } : undefined });
  return parseApiPayload(socialProfileResultSchema, response.data).profile;
}
const pendingAvatarMediaSchema = z.object({
  byteSize: z.number().int().positive(),
  contentType: z.string(),
  fileName: z.string(),
  id: z.uuid(),
  objectKey: z.string(),
});
const avatarUploadSchema = z.object({
  upload: z.object({
    media: pendingAvatarMediaSchema,
    headers: z.record(z.string(), z.string()),
    uploadUrl: z.url(),
  }),
});
export type PendingAvatarMedia = z.infer<typeof pendingAvatarMediaSchema>;
export async function uploadAvatarMedia(
  input: Readonly<{
    byteSize: number;
    contentType: string;
    fileName: string;
    uri: string;
  }>,
  actingPublicId?: string,
) {
  const response = await axiosInstance.post("/social/avatar-uploads", {
    byteSize: input.byteSize,
    contentType: input.contentType,
    fileName: input.fileName,
  }, { headers: actingPublicId ? { 'X-Acting-Public-Id': actingPublicId } : undefined });
  const upload = parseApiPayload(avatarUploadSchema, response.data).upload;
  const result = await new File(input.uri).upload(upload.uploadUrl, {
    headers: { ...upload.headers },
    httpMethod: "PUT",
    uploadType: UploadType.BINARY_CONTENT,
  });
  if (result.status < 200 || result.status >= 300)
    throw new Error(`Photo upload failed (${result.status}): ${result.body}`);
  return upload.media;
}
export async function uploadCoverMedia(input: Readonly<{ byteSize: number; contentType: string; fileName: string; uri: string }>, actingPublicId?: string) {
  const response = await axiosInstance.post('/social/cover-uploads', { byteSize: input.byteSize, contentType: input.contentType, fileName: input.fileName }, { headers: actingPublicId ? { 'X-Acting-Public-Id': actingPublicId } : undefined });
  const upload = parseApiPayload(avatarUploadSchema, response.data).upload;
  const result = await new File(input.uri).upload(upload.uploadUrl, { headers: { ...upload.headers }, httpMethod: 'PUT', uploadType: UploadType.BINARY_CONTENT });
  if (result.status < 200 || result.status >= 300) throw new Error(`Cover upload failed (${result.status}).`);
  return upload.media;
}
export async function updateSocialProfile(
  profile: Partial<
    Pick<
      SocialProfile,
      "displayName" | "showDisplayName" | "country" | "city" | "postCode" | "street1" | "street2" | "age" | "sex" | "hobby" | "bio" | "whatsappNumber" | "landlineNumber" | "contactEmail" | "facebookUrl" | "instagramUrl" | "tiktokUrl" | "linkedinUrl"
    >
  > & { avatarMedia?: PendingAvatarMedia; coverMedia?: PendingAvatarMedia },
  actingPublicId?: string,
) {
  const response = await axiosInstance.put("/social/profile", profile, { headers: actingPublicId ? { 'X-Acting-Public-Id': actingPublicId } : undefined });
  return parseApiPayload(socialProfileResultSchema, response.data).profile;
}
