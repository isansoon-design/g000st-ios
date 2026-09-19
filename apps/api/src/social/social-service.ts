import type { AuthStore } from '../auth/auth-store.js';
import { ApiError } from '../http/api-error.js';
import { decodeSocialCursor } from './social-cursor.js';
import type { MediaService } from '../media/media-service.js';
import type { SocialStore } from './social-store.js';
import { validateSocialMediaBatch } from './social-policy.js';
import type {
  CreateSocialCommentInput,
  CreateSocialPostInput,
  CreateSocialReportInput,
  SocialMediaView,
  SocialPost,
  UpdateSocialProfileInput,
} from './social-types.js';

export class SocialService {
  constructor(
    private readonly store: SocialStore,
    private readonly authStore: AuthStore,
    private readonly now: () => number = Date.now,
    private readonly mediaService?: MediaService,
  ) {}

  async listPosts(viewerId: string, limit: number, cursor?: string, ownerId?: string) {
    const page = await this.store.listPosts(viewerId, limit, decodeSocialCursor(cursor), ownerId);
    return { ...page, items: await Promise.all(page.items.map((post) => this.withMediaUrls(post))) };
  }

  async getPost(viewerId: string, postId: string) {
    const post = await this.store.findPost(viewerId, postId);
    if (!post) throw new ApiError(404, 'POST_NOT_FOUND', 'Post not found.');
    return this.withMediaUrls(post);
  }

  async createPost(ownerId: string, input: CreateSocialPostInput, clientPostId: string) {
    const { media: pendingMedia, ...postInput } = input;
    const incoming = pendingMedia ?? [];
    validateSocialMediaBatch(incoming);
    const media = incoming.length
      ? await Promise.all(incoming.map((item) => this.requireMedia().promoteSocialMedia({ media: item, postId: clientPostId, publicId: ownerId })))
      : undefined;
    const post = await this.store.createPost(ownerId, clientPostId, { ...postInput, ...(media ? { media } : {}), content: input.content.trim() }, this.now());
    return this.withMediaUrls(post);
  }

  async updatePost(viewerId: string, postId: string, content: string) {
    const post = await this.store.updatePost(viewerId, postId, content.trim(), this.now());
    if (!post) throw new ApiError(404, 'POST_NOT_FOUND', 'Post not found.');
    return this.withMediaUrls(post);
  }

  async deletePost(viewerId: string, postId: string) {
    const existing = await this.store.findPost(viewerId, postId);
    if (!(await this.store.deletePost(viewerId, postId))) {
      throw new ApiError(404, 'POST_NOT_FOUND', 'Post not found.');
    }
    if (existing?.media?.length && this.mediaService) {
      await this.mediaService.deleteAttachments(existing.media);
    }
  }

  async toggleLike(viewerId: string, postId: string) {
    const result = await this.store.toggleLike(viewerId, postId, this.now());
    if (!result) throw new ApiError(404, 'POST_NOT_FOUND', 'Post not found.');
    return result;
  }

  async listComments(viewerId: string, postId: string, limit: number, cursor?: string) {
    const page = await this.store.listComments(viewerId, postId, limit, decodeSocialCursor(cursor));
    if (!page) throw new ApiError(404, 'POST_NOT_FOUND', 'Post not found.');
    return page;
  }

  async createComment(viewerId: string, postId: string, input: CreateSocialCommentInput) {
    const comment = await this.store.createComment(viewerId, postId, { ...input, content: input.content.trim() }, this.now());
    if (!comment) throw new ApiError(404, 'POST_NOT_FOUND', 'Post not found.');
    return comment;
  }

  async deleteComment(viewerId: string, postId: string, commentId: string) {
    if (!(await this.store.deleteComment(viewerId, postId, commentId))) {
      throw new ApiError(404, 'COMMENT_NOT_FOUND', 'Comment not found.');
    }
  }

  async toggleCamp(viewerId: string, targetId: string) {
    if (viewerId === targetId) throw new ApiError(400, 'INVALID_CAMP_TARGET', 'You cannot camp your own profile.');
    if (!(await this.authStore.isUserActive(targetId))) throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
    return this.store.toggleCamp(viewerId, targetId, this.now());
  }

  async getProfile(viewerId: string, publicId: string) {
    if (!(await this.authStore.isUserActive(publicId))) throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
    return (await this.store.getProfile(viewerId, publicId)) ?? { publicId, updatedAtMs: 0, campedByViewer: false };
  }

  updateProfile(publicId: string, input: UpdateSocialProfileInput) {
    return this.store.updateProfile(publicId, input, this.now());
  }

  listAlerts(publicId: string, limit: number, cursor?: string) {
    return this.store.listAlerts(publicId, limit, decodeSocialCursor(cursor));
  }

  markAlertsRead(publicId: string) {
    return this.store.markAlertsRead(publicId, this.now());
  }

  async report(viewerId: string, input: CreateSocialReportInput) {
    if (!(await this.store.findPost(viewerId, input.postId))) throw new ApiError(404, 'POST_NOT_FOUND', 'Post not found.');
    await this.store.createReport(viewerId, input, this.now());
  }

  createUpload(publicId: string, input: Readonly<{ byteSize: number; clientPostId: string; contentType: string; fileName: string }>) {
    return this.requireMedia().createSocialUpload({ ...input, publicId });
  }

  private async withMediaUrls(post: SocialPost): Promise<Omit<SocialPost, 'media'> & { media?: readonly SocialMediaView[] }> {
    const { media, ...safe } = post;
    if (!media?.length) return safe;
    return {
      ...safe,
      media: await Promise.all(media.map(async ({ objectKey, ...item }) => ({
        ...item,
        url: (await this.requireMedia().getDownloadUrl({ ...item, objectKey }, 30 * 60)).downloadUrl,
      }))),
    };
  }

  private requireMedia(): MediaService {
    if (!this.mediaService) throw new ApiError(503, 'MEDIA_UNAVAILABLE', 'Media storage is not configured.');
    return this.mediaService;
  }
}
