export type SocialVisibility = 'anonymous' | 'public';

export type SocialMedia = Readonly<{
  byteSize: number;
  contentType: string;
  fileName: string;
  id: string;
  kind: 'image' | 'video';
  objectKey: string;
}>;

export type SocialMediaView = Omit<SocialMedia, 'objectKey'> & Readonly<{ url: string }>;

export type SocialProfile = Readonly<{
  publicId: string;
  displayName?: string;
  showDisplayName: boolean;
  avatarObjectKey?: string;
  country?: string;
  age?: number;
  sex?: 'male' | 'female';
  hobby?: string;
  bio?: string;
  updatedAtMs: number;
}>;

export type SocialProfileView = Omit<SocialProfile, 'avatarObjectKey'> & Readonly<{ avatarUrl?: string }>;

export type PendingAvatarMedia = Readonly<{
  byteSize: number;
  contentType: string;
  fileName: string;
  id: string;
  objectKey: string;
}>;

export type SocialAuthor = Readonly<{
  publicId?: string;
  displayName: string;
  avatarUrl?: string;
}>;

export type SocialPost = Readonly<{
  id: string;
  ownerPublicId?: string;
  author: SocialAuthor;
  content: string;
  sharedPostId?: string;
  media?: readonly SocialMedia[];
  visibility: SocialVisibility;
  createdAtMs: number;
  updatedAtMs: number;
  editedAtMs?: number;
  likeCount: number;
  commentCount: number;
  likedByViewer: boolean;
  campedByViewer: boolean;
  ownedByViewer: boolean;
}>;

export type SharedSocialPostView = Readonly<{
  id: string;
  author: SocialAuthor;
  content: string;
  media?: readonly SocialMediaView[];
  createdAtMs: number;
}>;

export type SocialComment = Readonly<{
  id: string;
  postId: string;
  ownerPublicId?: string;
  author: SocialAuthor;
  content: string;
  visibility: SocialVisibility;
  createdAtMs: number;
  ownedByViewer: boolean;
}>;

export type SocialAlertKind = 'like' | 'comment' | 'camp';

export type SocialAlert = Readonly<{
  id: string;
  kind: SocialAlertKind;
  actor: SocialAuthor;
  postId?: string;
  commentId?: string;
  createdAtMs: number;
  readAtMs?: number;
}>;

export type SocialPage<T> = Readonly<{ items: readonly T[]; nextCursor?: string }>;

export type CreateSocialPostInput = Readonly<{
  content: string;
  sharedPostId?: string;
  media?: readonly Omit<SocialMedia, 'kind'>[];
  visibility: SocialVisibility;
}>;

export type UpdateSocialPostInput = Readonly<{ content: string }>;

export type CreateSocialCommentInput = Readonly<{
  content: string;
  visibility: SocialVisibility;
}>;

export type UpdateSocialProfileInput = Readonly<{
  displayName?: string;
  showDisplayName?: boolean;
  avatarMedia?: PendingAvatarMedia;
  country?: string;
  age?: number;
  sex?: 'male' | 'female';
  hobby?: string;
  bio?: string;
}>;

export type CreateSocialReportInput = Readonly<{
  postId: string;
  commentId?: string;
  reason: 'spam' | 'harassment' | 'violence' | 'sexual' | 'privacy' | 'other';
  details?: string;
}>;
