import type { MediaService } from '../media/media-service.js';
import { ApiError } from '../http/api-error.js';
import { decodeSocialCursor } from '../social/social-cursor.js';
import { validateSocialMediaBatch } from '../social/social-policy.js';
import type { SocialMediaView } from '../social/social-types.js';
import type { MarketStore } from './market-store.js';
import { assertMarketContentAllowed } from './market-content-policy.js';
import type { CreateMarketPostInput, MarketPost, UpdateMarketPostInput } from './market-types.js';

export class MarketService {
  constructor(private readonly store: MarketStore, private readonly now: () => number = Date.now, private readonly mediaService?: MediaService) {}

  async listPosts(viewerId: string, limit: number, cursor?: string, ownerId?: string) {
    const page = await this.store.listPosts(viewerId, limit, decodeSocialCursor(cursor), ownerId);
    return { ...page, items: await Promise.all(page.items.map((post) => this.withMediaUrls(post))) };
  }
  async getPost(viewerId: string, postId: string) {
    const post = await this.store.findPost(viewerId, postId);
    if (!post) throw new ApiError(404, 'MARKET_POST_NOT_FOUND', 'Market post not found.');
    return this.withMediaUrls(post);
  }
  async createPost(ownerId: string, input: CreateMarketPostInput, clientPostId: string) {
    const { media: pendingMedia, ...fields } = input;
    assertMarketContentAllowed(fields.content, fields.city);
    const incoming = pendingMedia ?? [];
    validateSocialMediaBatch(incoming);
    const media = incoming.length ? await Promise.all(incoming.map((item) => this.requireMedia().promoteSocialMedia({ media: item, postId: clientPostId, publicId: ownerId }))) : undefined;
    return this.withMediaUrls(await this.store.createPost(ownerId, clientPostId, { ...fields, ...(media ? { media } : {}), content: fields.content.trim(), city: fields.city.trim(), currency: fields.currency.toUpperCase() }, this.now()));
  }
  async updatePost(viewerId: string, postId: string, input: UpdateMarketPostInput) {
    assertMarketContentAllowed(input.content, input.city);
    const post = await this.store.updatePost(viewerId, postId, { ...input, content: input.content.trim(), city: input.city.trim(), currency: input.currency.toUpperCase() }, this.now());
    if (!post) throw new ApiError(404, 'MARKET_POST_NOT_FOUND', 'Market post not found.');
    return this.withMediaUrls(post);
  }
  async deletePost(viewerId: string, postId: string) {
    const existing = await this.store.findPost(viewerId, postId);
    if (!(await this.store.deletePost(viewerId, postId))) throw new ApiError(404, 'MARKET_POST_NOT_FOUND', 'Market post not found.');
    if (existing?.media?.length && this.mediaService) await this.mediaService.deleteAttachments(existing.media);
  }
  async toggleLike(viewerId: string, postId: string) {
    const result = await this.store.toggleLike(viewerId, postId, this.now());
    if (!result) throw new ApiError(404, 'MARKET_POST_NOT_FOUND', 'Market post not found.');
    return result;
  }
  async listComments(viewerId: string, postId: string, limit: number, cursor?: string) {
    const page = await this.store.listComments(viewerId, postId, limit, decodeSocialCursor(cursor));
    if (!page) throw new ApiError(404, 'MARKET_POST_NOT_FOUND', 'Market post not found.');
    return page;
  }
  async createComment(viewerId: string, postId: string, content: string) {
    const comment = await this.store.createComment(viewerId, postId, content.trim(), this.now());
    if (!comment) throw new ApiError(404, 'MARKET_POST_NOT_FOUND', 'Market post not found.');
    return comment;
  }
  async deleteComment(viewerId: string, postId: string, commentId: string) {
    if (!(await this.store.deleteComment(viewerId, postId, commentId))) throw new ApiError(404, 'MARKET_COMMENT_NOT_FOUND', 'Market comment not found.');
  }
  createUpload(publicId: string, input: Readonly<{ byteSize: number; clientPostId: string; contentType: string; fileName: string }>) {
    return this.requireMedia().createSocialUpload({ ...input, publicId });
  }
  private async withMediaUrls(post: MarketPost): Promise<Omit<MarketPost, 'media'> & { media?: readonly SocialMediaView[] }> {
    const { media, ...safe } = post;
    if (!media?.length) return safe;
    return { ...safe, media: await Promise.all(media.map(async ({ objectKey, ...item }) => ({ ...item, url: (await this.requireMedia().getDownloadUrl({ ...item, objectKey }, 30 * 60)).downloadUrl }))) };
  }
  private requireMedia(): MediaService {
    if (!this.mediaService) throw new ApiError(503, 'MEDIA_UNAVAILABLE', 'Media storage is not configured.');
    return this.mediaService;
  }
}
