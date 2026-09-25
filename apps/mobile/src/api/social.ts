import { File, UploadType } from "expo-file-system";
import { z } from "zod";

import axiosInstance from "@/api/axios";
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
    type SocialProfile,
    type SocialVisibility,
} from "@/domain/social/types";

export async function listSocialPosts(ownerId?: string, cursor?: string) {
  const response = await axiosInstance.get("/social/posts", {
    params: { cursor, limit: 10, ownerId },
  });
  return parseApiPayload(socialPostPageSchema, response.data);
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
) {
  const response = await axiosInstance.post("/social/posts", {
    clientPostId,
    content,
    visibility,
    ...(media?.length ? { media } : {}),
    ...(sharedPostId ? { sharedPostId } : {}),
  });
  return parseApiPayload(socialPostResultSchema, response.data).post;
}
export async function uploadSocialMedia(
  input: Readonly<{
    byteSize: number;
    clientPostId: string;
    contentType: string;
    fileName: string;
    uri: string;
  }>,
) {
  const response = await axiosInstance.post("/social/uploads", {
    byteSize: input.byteSize,
    clientPostId: input.clientPostId,
    contentType: input.contentType,
    fileName: input.fileName,
  });
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
  return parseApiPayload(socialPostResultSchema, response.data).post;
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
export async function getSocialProfile(publicId: string) {
  const response = await axiosInstance.get(`/social/profiles/${publicId}`);
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
) {
  const response = await axiosInstance.post("/social/avatar-uploads", {
    byteSize: input.byteSize,
    contentType: input.contentType,
    fileName: input.fileName,
  });
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
export async function updateSocialProfile(
  profile: Partial<
    Pick<
      SocialProfile,
      "displayName" | "showDisplayName" | "country" | "age" | "sex" | "hobby" | "bio"
    >
  > & { avatarMedia?: PendingAvatarMedia },
) {
  const response = await axiosInstance.put("/social/profile", profile);
  return parseApiPayload(socialProfileResultSchema, response.data).profile;
}
