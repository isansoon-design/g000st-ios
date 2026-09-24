import type { SocialCursor } from './social-cursor.js';
import type {
  CreateSocialCommentInput,
  CreateSocialPostInput,
  CreateSocialReportInput,
  SocialAlert,
  SocialComment,
  SocialPage,
  SocialPost,
  SocialProfile,
  SocialMedia,
} from './social-types.js';

export interface SocialStore {
  getPublicDisplayName(publicId: string): Promise<string>;
  listPosts(viewerId: string, limit: number, cursor?: SocialCursor, ownerId?: string): Promise<SocialPage<SocialPost>>;
  findPost(viewerId: string, postId: string): Promise<SocialPost | null>;
  createPost(ownerId: string, postId: string, input: Omit<CreateSocialPostInput, 'media'> & { media?: readonly SocialMedia[] }, nowMs: number): Promise<SocialPost>;
  updatePost(viewerId: string, postId: string, content: string, nowMs: number): Promise<SocialPost | null>;
  deletePost(viewerId: string, postId: string): Promise<boolean>;
  toggleLike(viewerId: string, postId: string, nowMs: number): Promise<{ liked: boolean; likeCount: number } | null>;
  listComments(viewerId: string, postId: string, limit: number, cursor?: SocialCursor): Promise<SocialPage<SocialComment> | null>;
  createComment(viewerId: string, postId: string, input: CreateSocialCommentInput, nowMs: number): Promise<SocialComment | null>;
  deleteComment(viewerId: string, postId: string, commentId: string): Promise<boolean>;
  toggleCamp(viewerId: string, targetId: string, nowMs: number): Promise<{ camped: boolean }>;
  getProfile(viewerId: string, publicId: string): Promise<(SocialProfile & { campedByViewer: boolean }) | null>;
  updateProfile(publicId: string, input: Partial<Omit<SocialProfile, 'publicId' | 'updatedAtMs'>>, nowMs: number): Promise<SocialProfile>;
  listAlerts(publicId: string, limit: number, cursor?: SocialCursor): Promise<SocialPage<SocialAlert>>;
  markAlertsRead(publicId: string, nowMs: number): Promise<void>;
  createReport(reporterId: string, input: CreateSocialReportInput, nowMs: number): Promise<void>;
}
