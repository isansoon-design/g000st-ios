import type { SocialCursor } from '../social/social-cursor.js';
import type { SocialMedia } from '../social/social-types.js';
import type { CreateMarketPostInput, MarketComment, MarketPage, MarketPost, UpdateMarketPostInput } from './market-types.js';

export interface MarketStore {
  listPosts(viewerId: string, limit: number, cursor?: SocialCursor, ownerId?: string): Promise<MarketPage<MarketPost>>;
  findPost(viewerId: string, postId: string): Promise<MarketPost | null>;
  createPost(ownerId: string, postId: string, input: Omit<CreateMarketPostInput, 'media'> & { media?: readonly SocialMedia[] }, nowMs: number): Promise<MarketPost>;
  updatePost(viewerId: string, postId: string, input: UpdateMarketPostInput, nowMs: number): Promise<MarketPost | null>;
  deletePost(viewerId: string, postId: string): Promise<boolean>;
  toggleLike(viewerId: string, postId: string, nowMs: number): Promise<{ liked: boolean; likeCount: number } | null>;
  listComments(viewerId: string, postId: string, limit: number, cursor?: SocialCursor): Promise<MarketPage<MarketComment> | null>;
  createComment(viewerId: string, postId: string, content: string, nowMs: number): Promise<MarketComment | null>;
  deleteComment(viewerId: string, postId: string, commentId: string): Promise<boolean>;
}
