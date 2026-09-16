import axios from "./axios";

export const socialAPI = {
  // Get all posts
  getPosts: async () => {
    try {
      const response = await axios.get("/api/social/posts");
      return { ok: true, posts: response.data };
    } catch (error: any) {
      return { ok: false, message: error.response?.data?.message || "Failed to fetch posts" };
    }
  },

  // Create new post
  createPost: async (content: string, media?: string[]) => {
    try {
      const response = await axios.post("/api/social/posts", {
        content,
        media,
      });
      return { ok: true, post: response.data };
    } catch (error: any) {
      return { ok: false, message: error.response?.data?.message || "Failed to create post" };
    }
  },

  // Like/Unlike post
  toggleLike: async (postId: string) => {
    try {
      const response = await axios.post(`/api/social/posts/${postId}/like`);
      return { ok: true, liked: response.data.liked };
    } catch (error: any) {
      return { ok: false, message: error.response?.data?.message || "Failed to toggle like" };
    }
  },

  // Add comment
  addComment: async (postId: string, content: string) => {
    try {
      const response = await axios.post(`/api/social/posts/${postId}/comments`, {
        content,
      });
      return { ok: true, comment: response.data };
    } catch (error: any) {
      return { ok: false, message: error.response?.data?.message || "Failed to add comment" };
    }
  },

  // Get feed
  getFeed: async (page: number = 1) => {
    try {
      const response = await axios.get("/api/social/feed", {
        params: { page, limit: 10 },
      });
      return { ok: true, feed: response.data };
    } catch (error: any) {
      return { ok: false, message: error.response?.data?.message || "Failed to fetch feed" };
    }
  },
};
