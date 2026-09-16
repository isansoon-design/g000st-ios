// TypeScript type definitions

export type UserRole = "user" | "admin" | "moderator";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  createdAt: string;
}

export interface AuthResponse {
  ok: boolean;
  token?: string;
  user?: AuthUser;
  message?: string;
}

export interface APIResponse<T = any> {
  ok: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  likes: string[];
  comments: Comment[];
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  status: "online" | "away" | "offline";
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
}
