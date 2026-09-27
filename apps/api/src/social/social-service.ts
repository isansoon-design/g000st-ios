import { createHash } from 'node:crypto';

import type { AuthStore } from '../auth/auth-store.js';
import type { ContactsStore } from '../contacts/contacts-store.js';
import { G000ST_ID_ALPHABET } from '../core/identity.js';
import { ApiError } from '../http/api-error.js';
import { decodeSocialCursor } from './social-cursor.js';
import type { MediaService } from '../media/media-service.js';
import type { SocialStore } from './social-store.js';
import { publicDisplayName, socialAlias } from './social-identity.js';
import { validateSocialMediaBatch } from './social-policy.js';
import type {
  CreateSocialCommentInput,
  CreateSocialPostInput,
  CreateSocialReportInput,
  SocialMediaView,
  SocialPost,
  SharedSocialPostView,
  SocialProfile,
  SocialSuggestion,
  SocialSuggestions,
  UpdateSocialProfileInput,
} from './social-types.js';

export class SocialService {
  constructor(
    private readonly store: SocialStore,
    private readonly authStore: AuthStore,
    private readonly now: () => number = Date.now,
    private readonly mediaService?: MediaService,
    private readonly contactsStore?: ContactsStore,
  ) {}

  async listSuggestions(viewerId: string): Promise<SocialSuggestions> {
    const contactsStore = this.contactsStore;
    if (!contactsStore) throw new ApiError(503, 'SUGGESTIONS_UNAVAILABLE', 'Suggestions are unavailable.');
    const day = new Date(this.now()).toISOString().slice(0, 10);
    const digest = (value: string) => createHash('sha256').update(`${viewerId}:${day}:${value}`).digest();
    const dailyOrder = (ids: readonly string[]) => ids
      .map((id) => ({ id, score: digest(id).toString('hex') }))
      .sort((left, right) => left.score.localeCompare(right.score) || left.id.localeCompare(right.id))
      .map(({ id }) => id);
    const following = await this.store.listFollowing(viewerId);
    const excluded = new Set([viewerId, ...following.map(({ publicId }) => publicId)]);
    const sourceIds = dailyOrder(following.map(({ publicId }) => publicId)).slice(0, 10);
    const activeSources = (await Promise.all(sourceIds.map(async (id) => {
      const [active, mine, theirs] = await Promise.all([
        this.authStore.isUserActive(id),
        contactsStore.getPeerPreferences(viewerId, id),
        contactsStore.getPeerPreferences(id, viewerId),
      ]);
      return active && !mine.blocked && !theirs.blocked ? id : null;
    })))
      .filter((id): id is string => id !== null);
    const friendLists = await Promise.all(activeSources.map((id) => this.store.listFollowing(id, 30)));
    const mutualCounts = new Map<string, number>();
    for (const friends of friendLists) {
      for (const { publicId } of friends) {
        if (!excluded.has(publicId)) mutualCounts.set(publicId, (mutualCounts.get(publicId) ?? 0) + 1);
      }
    }
    const dailyRanks = new Map(dailyOrder([...mutualCounts.keys()]).map((id, index) => [id, index]));
    const graphCandidates = [...mutualCounts.keys()].sort((left, right) =>
      (mutualCounts.get(right) ?? 0) - (mutualCounts.get(left) ?? 0)
      || (dailyRanks.get(left) ?? 0) - (dailyRanks.get(right) ?? 0));
    const pivot = [...digest('discovery')].map((byte) => G000ST_ID_ALPHABET[byte % G000ST_ID_ALPHABET.length]).join('');
    const discoveryCandidates = (await this.store.listDiscoveryCandidates(pivot, 120))
      .filter((id) => !mutualCounts.has(id));
    const items: SocialSuggestion[] = [];
    const seen = new Set(excluded);
    const addCandidates = async (ids: readonly string[], target: number) => {
      for (let index = 0; index < ids.length && items.length < target; index += 10) {
        const batch = ids.slice(index, index + 10).filter((id) => !seen.has(id));
        const eligible = await Promise.all(batch.map(async (id): Promise<SocialSuggestion | null> => {
          if (!(await this.authStore.isUserActive(id))) return null;
          const [mine, theirs] = await Promise.all([
            contactsStore.getPeerPreferences(viewerId, id),
            contactsStore.getPeerPreferences(id, viewerId),
          ]);
          if (mine?.blocked || theirs?.blocked) return null;
          const profile = await this.getProfile(viewerId, id);
          const mutualCount = mutualCounts.get(id) ?? 0;
          return {
            publicId: id,
            displayName: profile.displayName ?? socialAlias(id),
            ...(profile.avatarUrl ? { avatarUrl: profile.avatarUrl } : {}),
            reason: mutualCount > 0 ? 'friends_of_friends' : 'discover',
            mutualCount,
          };
        }));
        eligible.forEach((item, position) => {
          if (!item) seen.add(batch[position]!);
          else if (items.length < target) {
            items.push(item);
            seen.add(item.publicId);
          }
        });
      }
    };
    await addCandidates(graphCandidates, 7);
    await addCandidates(discoveryCandidates, 10);
    await addCandidates(graphCandidates, 10);
    return { day, items };
  }

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
    if (input.visibility !== 'public' && await this.authStore.getPageOwner?.(ownerId)) {
      throw new ApiError(400, 'PAGE_NAME_REQUIRED', 'Page posts must show the page name.');
    }
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
    if (input.visibility !== 'public' && await this.authStore.getPageOwner?.(viewerId)) {
      throw new ApiError(400, 'PAGE_NAME_REQUIRED', 'Page comments must show the page name.');
    }
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

  async follow(viewerId: string, targetId: string): Promise<void> {
    if (viewerId === targetId) throw new ApiError(400, 'INVALID_CAMP_TARGET', 'You cannot follow your own profile.');
    if (!(await this.authStore.isUserActive(targetId))) throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
    await this.store.follow(viewerId, targetId, this.now());
  }

  unfollow(viewerId: string, targetId: string): Promise<boolean> {
    return this.store.unfollow(viewerId, targetId);
  }

  listFollowing(viewerId: string): Promise<readonly Readonly<{ publicId: string; followedAtMs: number }>[]> {
    return this.store.listFollowing(viewerId);
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
    if (await this.authStore.getPageOwner?.(publicId) && (input.showDisplayName === false || input.displayName?.trim() === '')) {
      throw new ApiError(400, 'PAGE_NAME_REQUIRED', 'A page must show its name.');
    }
    const { avatarMedia, coverMedia, ...fields } = input;
    let avatarObjectKey: string | undefined;
    let coverObjectKey: string | undefined;
    const current = avatarMedia || coverMedia ? await this.store.getProfile(publicId, publicId) : null;
    if (avatarMedia) {
      avatarObjectKey = (
        await this.requireMedia().promoteAvatar({
          media: avatarMedia,
          publicId,
        })
      ).objectKey;
    }
    if (coverMedia) {
      coverObjectKey = (await this.requireMedia().promoteCover({ media: coverMedia, publicId })).objectKey;
    }
    const profile = await this.store.updateProfile(
      publicId,
      { ...fields, ...(avatarObjectKey ? { avatarObjectKey } : {}), ...(coverObjectKey ? { coverObjectKey } : {}) },
      this.now(),
    );
    // Keep the previous image until its replacement key is safely stored.
    if (avatarObjectKey && current?.avatarObjectKey && current.avatarObjectKey !== avatarObjectKey) {
      await this.requireMedia().deleteProfileImage(current.avatarObjectKey).catch(() => undefined);
    }
    if (coverObjectKey && current?.coverObjectKey && current.coverObjectKey !== coverObjectKey) {
      await this.requireMedia().deleteProfileImage(current.coverObjectKey).catch(() => undefined);
    }
    return this.withProfileAvatar({ ...profile, showDisplayName: profile.showDisplayName === true });
  }

  createAvatarUpload(publicId: string, input: Readonly<{ byteSize: number; contentType: string; fileName: string }>) {
    return this.requireMedia().createAvatarUpload({ ...input, publicId });
  }

  createCoverUpload(publicId: string, input: Readonly<{ byteSize: number; contentType: string; fileName: string }>) {
    return this.requireMedia().createCoverUpload({ ...input, publicId });
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

  private async withProfileAvatar<T extends Partial<Pick<SocialProfile, 'avatarObjectKey' | 'coverObjectKey'>>>(
    profile: T,
  ): Promise<Omit<T, 'avatarObjectKey' | 'coverObjectKey'> & Readonly<{ avatarUrl?: string; coverUrl?: string }>> {
    const { avatarObjectKey, coverObjectKey, ...safe } = profile;
    if (!this.mediaService) return safe;
    const [avatarUrl, coverUrl] = await Promise.all([avatarObjectKey, coverObjectKey].map(async (objectKey) => objectKey
      ? (await this.mediaService!.getDownloadUrl({ byteSize: 0, contentType: 'image/*', fileName: 'profile', id: 'profile', kind: 'image', objectKey }, 30 * 60)).downloadUrl
      : undefined));
    return { ...safe, ...(avatarUrl ? { avatarUrl } : {}), ...(coverUrl ? { coverUrl } : {}) };
  }

  private requireMedia(): MediaService {
    if (!this.mediaService) throw new ApiError(503, 'MEDIA_UNAVAILABLE', 'Media storage is not configured.');
    return this.mediaService;
  }
}
