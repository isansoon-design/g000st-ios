import type { SocialAuthor, SocialMedia, SocialMediaView } from '../social/social-types.js';

export type MarketPost = Readonly<{
  id: string;
  ownerPublicId: string;
  author: SocialAuthor;
  content: string;
  price: number;
  currency: string;
  quantity: number;
  city: string;
  media?: readonly SocialMedia[];
  createdAtMs: number;
  updatedAtMs: number;
  editedAtMs?: number;
  likeCount: number;
  commentCount: number;
  likedByViewer: boolean;
  ownedByViewer: boolean;
}>;

export type MarketPostView = Omit<MarketPost, 'media'> & Readonly<{ media?: readonly SocialMediaView[] }>;

export type MarketComment = Readonly<{
  id: string;
  postId: string;
  ownerPublicId: string;
  author: SocialAuthor;
  content: string;
  createdAtMs: number;
  ownedByViewer: boolean;
}>;

export type MarketPage<T> = Readonly<{ items: readonly T[]; nextCursor?: string }>;

export type CreateMarketPostInput = Readonly<{
  content: string;
  price: number;
  currency: string;
  quantity: number;
  city: string;
  media?: readonly Omit<SocialMedia, 'kind'>[];
}>;

export type UpdateMarketPostInput = Readonly<{
  content: string;
  price: number;
  currency: string;
  quantity: number;
  city: string;
}>;
