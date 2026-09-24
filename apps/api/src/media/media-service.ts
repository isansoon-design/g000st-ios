import { randomUUID } from 'node:crypto';

import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { ApiError } from '../http/api-error.js';
import type { ChatAttachment, ChatAttachmentKind } from '../chat/chat-types.js';

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_AVATAR_BYTES = 3 * 1024 * 1024;
const UPLOAD_URL_TTL_SECONDS = 10 * 60;
const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;
const MAX_ATTACHMENTS_PER_MESSAGE = 3;
const MAX_VOICE_MESSAGE_DURATION_MS = 5 * 60 * 1_000;

const supportedTypes: Readonly<Record<string, ChatAttachmentKind>> = {
  'audio/aac': 'audio',
  'audio/3gpp': 'audio',
  'audio/mp4': 'audio',
  'audio/mpeg': 'audio',
  'audio/ogg': 'audio',
  'audio/webm': 'audio',
  'audio/x-m4a': 'audio',
  'application/msword': 'document',
  'application/pdf': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'image/gif': 'image',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'video/mp4': 'video',
  'video/quicktime': 'video',
  'video/webm': 'video',
};

export type PendingAttachmentInput = Readonly<{
  byteSize: number;
  contentType: string;
  durationMs?: number;
  fileName: string;
  id: string;
  objectKey: string;
}>;

type CreateUploadInput = Readonly<{
  byteSize: number;
  clientMessageId: string;
  contentType: string;
  conversationId: string;
  durationMs?: number;
  fileName: string;
  publicId: string;
}>;

type CreateSocialUploadInput = Readonly<{
  byteSize: number;
  clientPostId: string;
  contentType: string;
  fileName: string;
  publicId: string;
}>;

type CreateAvatarUploadInput = Readonly<{
  byteSize: number;
  contentType: string;
  fileName: string;
  publicId: string;
}>;

export type MediaStorageConfig = Readonly<{
  accessKeyId: string;
  bucket: string;
  endpoint: string;
  region: string;
  secretAccessKey: string;
}>;

export class MediaService {
  private readonly client: S3Client;

  constructor(private readonly config: MediaStorageConfig) {
    this.client = new S3Client({
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      endpoint: config.endpoint,
      forcePathStyle: true,
      region: config.region,
      // Default 'WHEN_SUPPORTED' signs an empty-body checksum into presigned PUT URLs
      // (no body exists yet at presign time), which MinIO rejects once the real bytes arrive.
      requestChecksumCalculation: 'WHEN_REQUIRED',
    });
  }

  async createUpload(input: CreateUploadInput): Promise<Readonly<{
    attachment: PendingAttachmentInput;
    headers: Readonly<{ 'Content-Type': string }>;
    uploadUrl: string;
  }>> {
    const kind = this.validateFile(input);
    const attachmentId = randomUUID();
    const objectKey = `pending/${input.publicId}/${input.conversationId}/${input.clientMessageId}/${attachmentId}`;
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      ContentLength: input.byteSize,
      ContentType: input.contentType,
      Key: objectKey,
      Metadata: {
        'g000st-byte-size': String(input.byteSize),
        'g000st-conversation-id': input.conversationId,
        'g000st-message-id': input.clientMessageId,
        'g000st-owner-id': input.publicId,
        'g000st-kind': kind,
        ...(input.durationMs
          ? { 'g000st-duration-ms': String(input.durationMs) }
          : {}),
      },
    });
    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: UPLOAD_URL_TTL_SECONDS,
    });
    return {
      attachment: {
        byteSize: input.byteSize,
        contentType: input.contentType,
        ...(input.durationMs ? { durationMs: input.durationMs } : {}),
        fileName: this.safeFileName(input.fileName),
        id: attachmentId,
        objectKey,
      },
      headers: { 'Content-Type': input.contentType },
      uploadUrl,
    };
  }

  async createSocialUpload(input: CreateSocialUploadInput): Promise<Readonly<{
    media: PendingAttachmentInput;
    headers: Readonly<{ 'Content-Type': string }>;
    uploadUrl: string;
  }>> {
    const kind = this.validateFile(input);
    if (kind !== 'image' && kind !== 'video') throw new ApiError(400, 'UNSUPPORTED_SOCIAL_MEDIA', 'Social posts support images and videos only.');
    const mediaId = randomUUID();
    const objectKey = `pending-social/${input.publicId}/${input.clientPostId}/${mediaId}`;
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      ContentLength: input.byteSize,
      ContentType: input.contentType,
      Key: objectKey,
      Metadata: {
        'g000st-byte-size': String(input.byteSize),
        'g000st-post-id': input.clientPostId,
        'g000st-owner-id': input.publicId,
        'g000st-kind': kind,
      },
    });
    return {
      media: { byteSize: input.byteSize, contentType: input.contentType, fileName: this.safeFileName(input.fileName), id: mediaId, objectKey },
      headers: { 'Content-Type': input.contentType },
      uploadUrl: await getSignedUrl(this.client, command, { expiresIn: UPLOAD_URL_TTL_SECONDS }),
    };
  }

  async createAvatarUpload(input: CreateAvatarUploadInput): Promise<Readonly<{
    media: PendingAttachmentInput;
    headers: Readonly<{ 'Content-Type': string }>;
    uploadUrl: string;
  }>> {
    const kind = this.validateFile(input);
    if (kind !== 'image') throw new ApiError(400, 'UNSUPPORTED_AVATAR', 'Profile photos must be an image.');
    if (input.byteSize > MAX_AVATAR_BYTES) {
      throw new ApiError(400, 'UNSUPPORTED_AVATAR', 'Profile photo must be 3 MB or smaller.');
    }
    const mediaId = randomUUID();
    const objectKey = `pending-avatar/${input.publicId}/${mediaId}`;
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      ContentLength: input.byteSize,
      ContentType: input.contentType,
      Key: objectKey,
      Metadata: {
        'g000st-byte-size': String(input.byteSize),
        'g000st-owner-id': input.publicId,
        'g000st-kind': kind,
      },
    });
    return {
      media: { byteSize: input.byteSize, contentType: input.contentType, fileName: this.safeFileName(input.fileName), id: mediaId, objectKey },
      headers: { 'Content-Type': input.contentType },
      uploadUrl: await getSignedUrl(this.client, command, { expiresIn: UPLOAD_URL_TTL_SECONDS }),
    };
  }

  async promoteAvatar(input: Readonly<{ media: PendingAttachmentInput; publicId: string; previousObjectKey?: string }>): Promise<Readonly<{ objectKey: string }>> {
    const kind = this.validateFile(input.media);
    if (kind !== 'image') throw new ApiError(400, 'UNSUPPORTED_AVATAR', 'Profile photos must be an image.');
    const expected = `pending-avatar/${input.publicId}/${input.media.id}`;
    if (input.media.objectKey !== expected) {
      throw new ApiError(400, 'INVALID_AVATAR', 'This photo does not belong to your account.');
    }
    const finalKey = `avatars/${input.publicId}/${input.media.id}`;
    const object = await this.client.send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: expected })).catch(() => null);
    if (!object || object.ContentLength !== input.media.byteSize || object.ContentType !== input.media.contentType || object.Metadata?.['g000st-owner-id'] !== input.publicId) {
      throw new ApiError(400, 'UPLOAD_NOT_FOUND', 'Upload is missing or does not match the selected photo.');
    }
    await this.client.send(new CopyObjectCommand({ Bucket: this.config.bucket, CopySource: `/${this.config.bucket}/${encodeURIComponent(expected).replaceAll('%2F', '/')}`, Key: finalKey, MetadataDirective: 'COPY' }));
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: expected }));
    if (input.previousObjectKey && input.previousObjectKey !== finalKey) {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: input.previousObjectKey })).catch(() => undefined);
    }
    return { objectKey: finalKey };
  }

  async promoteSocialMedia(input: Readonly<{ media: PendingAttachmentInput; postId: string; publicId: string }>): Promise<PendingAttachmentInput & { kind: 'image' | 'video' }> {
    const kind = this.validateFile(input.media);
    if (kind !== 'image' && kind !== 'video') throw new ApiError(400, 'UNSUPPORTED_SOCIAL_MEDIA', 'Social posts support images and videos only.');
    const expected = `pending-social/${input.publicId}/${input.postId}/${input.media.id}`;
    if (input.media.objectKey !== expected) throw new ApiError(400, 'INVALID_SOCIAL_MEDIA', 'This media does not belong to this post.');
    const finalKey = `social/${input.postId}/${input.media.id}`;
    const finalObject = await this.client.send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: finalKey })).catch(() => null);
    if (finalObject && finalObject.ContentLength === input.media.byteSize && finalObject.ContentType === input.media.contentType && finalObject.Metadata?.['g000st-owner-id'] === input.publicId && finalObject.Metadata?.['g000st-post-id'] === input.postId) {
      return { ...input.media, kind, objectKey: finalKey };
    }
    const object = await this.client.send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: expected })).catch(() => null);
    if (!object || object.ContentLength !== input.media.byteSize || object.ContentType !== input.media.contentType || object.Metadata?.['g000st-owner-id'] !== input.publicId || object.Metadata?.['g000st-post-id'] !== input.postId || object.Metadata?.['g000st-kind'] !== kind) {
      throw new ApiError(400, 'UPLOAD_NOT_FOUND', 'Upload is missing or does not match the selected media.');
    }
    await this.client.send(new CopyObjectCommand({ Bucket: this.config.bucket, CopySource: `/${this.config.bucket}/${encodeURIComponent(expected).replaceAll('%2F', '/')}`, Key: finalKey, MetadataDirective: 'COPY' }));
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: expected }));
    return { ...input.media, kind, objectKey: finalKey };
  }

  async promoteAttachments(input: Readonly<{
    attachments: readonly PendingAttachmentInput[];
    conversationId: string;
    messageId: string;
    publicId: string;
  }>): Promise<readonly ChatAttachment[]> {
    if (input.attachments.length > MAX_ATTACHMENTS_PER_MESSAGE) {
      throw new ApiError(400, 'TOO_MANY_ATTACHMENTS', `A message can have up to ${MAX_ATTACHMENTS_PER_MESSAGE} attachments.`);
    }
    const uniqueIds = new Set(input.attachments.map((attachment) => attachment.id));
    if (uniqueIds.size !== input.attachments.length) {
      throw new ApiError(400, 'INVALID_ATTACHMENTS', 'Attachments must be unique.');
    }
    const kinds = input.attachments.map((attachment) => this.validateFile(attachment));
    if (input.attachments.length > 1 && kinds.some((kind) => kind !== 'image')) {
      throw new ApiError(
        400,
        'INVALID_ATTACHMENT_BATCH',
        'Audio, videos, and documents must be sent one at a time.',
      );
    }

    return await Promise.all(
      input.attachments.map(async (attachment, index) => {
        const kind = kinds[index]!;
        const expectedPendingKey = `pending/${input.publicId}/${input.conversationId}/${input.messageId}/${attachment.id}`;
        const finalKey = `chat/${input.conversationId}/${input.messageId}/${attachment.id}`;
        if (attachment.objectKey !== expectedPendingKey) {
          throw new ApiError(400, 'INVALID_ATTACHMENT', 'This attachment does not belong to this message.');
        }

        const finalExists = await this.objectMatches(finalKey, attachment, input);
        if (!finalExists) {
          const pendingExists = await this.objectMatches(expectedPendingKey, attachment, input);
          if (!pendingExists) {
            throw new ApiError(400, 'UPLOAD_NOT_FOUND', 'Upload is missing, expired, or does not match the selected file.');
          }
          await this.client.send(
            new CopyObjectCommand({
              Bucket: this.config.bucket,
              CopySource: `/${this.config.bucket}/${encodeURIComponent(expectedPendingKey).replaceAll('%2F', '/')}`,
              Key: finalKey,
              MetadataDirective: 'COPY',
            }),
          );
          await this.client.send(
            new DeleteObjectCommand({ Bucket: this.config.bucket, Key: expectedPendingKey }),
          );
        }

        return {
          byteSize: attachment.byteSize,
          contentType: attachment.contentType,
          ...(attachment.durationMs ? { durationMs: attachment.durationMs } : {}),
          fileName: this.safeFileName(attachment.fileName),
          id: attachment.id,
          kind,
          objectKey: finalKey,
        };
      }),
    );
  }

  async getDownloadUrl(
    attachment: ChatAttachment,
    expiresInSeconds: number = DOWNLOAD_URL_TTL_SECONDS,
  ): Promise<Readonly<{ downloadUrl: string }>> {
    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: attachment.objectKey,
      ResponseContentDisposition:
        attachment.kind === 'document'
          ? `attachment; filename="${this.safeFileName(attachment.fileName)}"`
          : undefined,
    });
    return {
      downloadUrl: await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds }),
    };
  }

  async deleteAttachments(attachments: readonly ChatAttachment[] | undefined): Promise<void> {
    if (!attachments?.length) return;
    await Promise.all(
      attachments.map((attachment) =>
        this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: attachment.objectKey })),
      ),
    );
  }

  private async objectMatches(
    key: string,
    attachment: PendingAttachmentInput,
    input: Readonly<{ conversationId: string; messageId: string; publicId: string }>,
  ): Promise<boolean> {
    try {
      const object = await this.client.send(
        new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }),
      );
      return (
        object.ContentLength === attachment.byteSize &&
        object.ContentType === attachment.contentType &&
        object.Metadata?.['g000st-owner-id'] === input.publicId &&
        object.Metadata?.['g000st-conversation-id'] === input.conversationId &&
        object.Metadata?.['g000st-message-id'] === input.messageId &&
        object.Metadata?.['g000st-duration-ms'] ===
          (attachment.durationMs === undefined ? undefined : String(attachment.durationMs))
      );
    } catch {
      return false;
    }
  }

  private validateFile(input: Readonly<{
    byteSize: number;
    contentType: string;
    durationMs?: number;
    fileName: string;
  }>): ChatAttachmentKind {
    const kind = supportedTypes[input.contentType.toLowerCase()];
    const durationMs = input.durationMs;
    if (!kind || !Number.isSafeInteger(input.byteSize) || input.byteSize < 1 || input.byteSize > MAX_ATTACHMENT_BYTES) {
      throw new ApiError(400, 'UNSUPPORTED_ATTACHMENT', 'Attachments must be supported audio, image, video, PDF, or Word files up to 5 MB.');
    }
    if (!this.safeFileName(input.fileName)) {
      throw new ApiError(400, 'INVALID_ATTACHMENT', 'Attachment file name is invalid.');
    }
    if (
      (kind === 'audio' &&
        (!Number.isSafeInteger(durationMs) ||
          durationMs === undefined ||
          durationMs < 1 ||
          durationMs > MAX_VOICE_MESSAGE_DURATION_MS)) ||
      (kind !== 'audio' && durationMs !== undefined)
    ) {
      throw new ApiError(
        400,
        'INVALID_AUDIO_DURATION',
        'Voice messages must include a duration between 1 ms and 5 minutes.',
      );
    }
    return kind;
  }

  private safeFileName(value: string): string {
    return value.replace(/[\\/\u0000-\u001F\u007F]/g, '_').trim().slice(0, 180);
  }
}
