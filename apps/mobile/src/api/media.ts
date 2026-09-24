import { File, UploadType } from 'expo-file-system';
import { z } from 'zod';

import axiosInstance from '@/api/axios';
import { parseApiPayload } from '@/api/parse-api-payload';

const pendingAttachmentSchema = z.object({
  byteSize: z.number().int().positive(),
  contentType: z.string().min(1),
  durationMs: z.number().int().min(1).max(5 * 60 * 1_000).optional(),
  fileName: z.string().min(1),
  id: z.string().uuid(),
  objectKey: z.string().min(1),
});

const createUploadResultSchema = z.object({
  upload: z.object({
    attachment: pendingAttachmentSchema,
    headers: z.record(z.string(), z.string()),
    uploadUrl: z.url(),
  }),
});

export type PendingChatAttachment = Readonly<z.infer<typeof pendingAttachmentSchema>>;

export async function createChatAttachmentUpload(input: Readonly<{
  byteSize: number;
  clientMessageId: string;
  contentType: string;
  conversationId: string;
  durationMs?: number;
  fileName: string;
}>) {
  const response = await axiosInstance.post('/media/uploads', input);
  return parseApiPayload(createUploadResultSchema, response.data).upload;
}

export async function uploadChatAttachment(
  uri: string,
  upload: Readonly<{ headers: Readonly<Record<string, string>>; uploadUrl: string }>,
): Promise<void> {
  const result = await new File(uri).upload(upload.uploadUrl, {
    headers: { ...upload.headers },
    httpMethod: 'PUT',
    uploadType: UploadType.BINARY_CONTENT,
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Attachment upload failed (${result.status}).`);
  }
}
