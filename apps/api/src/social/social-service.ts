import type { AuthStore } from '../auth/auth-store.js';
import { ApiError } from '../http/api-error.js';
import { decodeSocialCursor } from './social-cursor.js';
import type { MediaService } from '../media/media-service.js';
import type { SocialStore } from './social-store.js';
import { publicDisplayName } from './social-identity.js';
import { validateSocialMediaBatch } from './social-policy.js';
import type {
  CreateSocialCommentInput,
  CreateSocialPostInput,
  CreateSocialReportInput,
  SocialMediaView,
  SocialPost,
  SharedSocialPostView,
  SocialProfile,
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
    return { ...page, items: await Promise.all(page.items.map((post) => this.withMediaUrls(post, viewerId))) };
  }

  async getPost(viewerId: string, postId: string) {
    const post = await this.store.findPost(viewerId, postId);
    if (!post) throw new ApiError(404, 'POST_NOT_FOUND', 'Post not found.');
    return this.withMediaUrls(post, viewerId);
  }

  async createPost(ownerId: string, input: CreateSocialPostInput, clientPostId: string) {
    const { media: pendingMedia, ...postInput } = input;
    if (!input.content.trim() && !input.sharedPostId) throw new ApiError(400, 'INVALID_POST', 'A post must contain text or share another post.');
    if (input.sharedPostId && pendingMedia?.length) throw new ApiError(400, 'INVALID_SHARED_POST', 'A shared post cannot include new media.');
    let sharedPostId = input.sharedPostId;
    if (sharedPostId) {
      const source = await this.store.findPost(ownerId, sharedPostId);
      if (!source) throw new ApiError(404, 'POST_NOT_FOUND', 'Original post not found.');
      sharedPostId = source.sharedPostId ?? source.id;
      if (sharedPostId !== source.id && !(await this.store.findPost(ownerId, sharedPostId))) {
        throw new ApiError(404, 'POST_NOT_FOUND', 'Original post not found.');
      }
    }
    const incoming = pendingMedia ?? [];
    validateSocialMediaBatch(incoming);
    const media = incoming.length
      ? await Promise.all(incoming.map((item) => this.requireMedia().promoteSocialMedia({ media: item, postId: clientPostId, publicId: ownerId })))
      : undefined;
    const post = await this.store.createPost(ownerId, clientPostId, { ...postInput, ...(sharedPostId ? { sharedPostId } : {}), ...(media ? { media } : {}), content: input.content.trim() }, this.now());
    return this.withMediaUrls(post, ownerId);
  }

  async updatePost(viewerId: string, postId: string, content: string) {
    const post = await this.store.updatePost(viewerId, postId, content.trim(), this.now());
    if (!post) throw new ApiError(404, 'POST_NOT_FOUND', 'Post not found.');
    return this.withMediaUrls(post, viewerId);
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
    const stored = await this.store.getProfile(viewerId, publicId);
    const profile = {
      publicId,
      ...stored,
      showDisplayName: stored?.showDisplayName === true,
      updatedAtMs: stored?.updatedAtMs ?? 0,
      campedByViewer: stored?.campedByViewer ?? false,
    };
    const safeProfile = viewerId === publicId
      ? profile
      : { ...profile, displayName: publicDisplayName(publicId, profile) };
    return this.withProfileAvatar(safeProfile);
  }

  getPublicDisplayName(publicId: string): Promise<string> {
    return this.store.getPublicDisplayName(publicId);
  }

  async updateProfile(publicId: string, input: UpdateSocialProfileInput) {
    const { avatarMedia, ...fields } = input;
    let avatarObjectKey: string | undefined;
    if (avatarMedia) {
      const current = await this.store.getProfile(publicId, publicId);
      avatarObjectKey = (
        await this.requireMedia().promoteAvatar({
          media: avatarMedia,
          previousObjectKey: current?.avatarObjectKey,
          publicId,
        })
      ).objectKey;
    }
    const profile = await this.store.updateProfile(
      publicId,
      { ...fields, ...(avatarObjectKey ? { avatarObjectKey } : {}) },
      this.now(),
    );
    return this.withProfileAvatar({ ...profile, showDisplayName: profile.showDisplayName === true });
  }

  createAvatarUpload(publicId: string, input: Readonly<{ byteSize: number; contentType: string; fileName: string }>) {
    return this.requireMedia().createAvatarUpload({ ...input, publicId });
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

  private async withMediaUrls(post: SocialPost, viewerId: string): Promise<Omit<SocialPost, 'media'> & { media?: readonly SocialMediaView[]; sharedPost?: SharedSocialPostView }> {
    const { media, ...safe } = post;
    const original = post.sharedPostId ? await this.store.findPost(viewerId, post.sharedPostId) : null;
    return {
      ...safe,
      ...(media?.length ? { media: await this.mediaUrls(media) } : {}),
      ...(original ? { sharedPost: {
        id: original.id,
        author: original.author,
        content: original.content,
        ...(original.media?.length ? { media: await this.mediaUrls(original.media) } : {}),
        createdAtMs: original.createdAtMs,
      } } : {}),
    };
  }

  private mediaUrls(media: NonNullable<SocialPost['media']>): Promise<readonly SocialMediaView[]> {
    return Promise.all(media.map(async ({ objectKey, ...item }) => ({
        ...item,
        url: (await this.requireMedia().getDownloadUrl({ ...item, objectKey }, 30 * 60)).downloadUrl,
      })));
  }

  private async withProfileAvatar<T extends Partial<Pick<SocialProfile, 'avatarObjectKey'>>>(
    profile: T,
  ): Promise<Omit<T, 'avatarObjectKey'> & Readonly<{ avatarUrl?: string }>> {
    const { avatarObjectKey, ...safe } = profile;
    if (!avatarObjectKey || !this.mediaService) return safe;
    const { downloadUrl } = await this.mediaService.getDownloadUrl(
      { byteSize: 0, contentType: 'image/*', fileName: 'avatar', id: 'avatar', kind: 'image', objectKey: avatarObjectKey },
      30 * 60,
    );
    return { ...safe, avatarUrl: downloadUrl };
  }

  private requireMedia(): MediaService {
    if (!this.mediaService) throw new ApiError(503, 'MEDIA_UNAVAILABLE', 'Media storage is not configured.');
    return this.mediaService;
  }
}
