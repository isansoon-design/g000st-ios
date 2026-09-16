import axios from "./axios";

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
  isRead: boolean;
}

export interface Conversation {
  id: string;
  participantId: string;
  participantName: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

export const chatAPI = {
  // Get all conversations
  getConversations: async () => {
    try {
      const response = await axios.get("/api/chat/conversations");
      return { ok: true, conversations: response.data };
    } catch (error: any) {
      return {
        ok: false,
        message: error.response?.data?.message || "Failed to fetch conversations",
      };
    }
  },

  // Get messages for a conversation
  getMessages: async (conversationId: string) => {
    try {
      const response = await axios.get(`/api/chat/conversations/${conversationId}/messages`);
      return { ok: true, messages: response.data };
    } catch (error: any) {
      return {
        ok: false,
        message: error.response?.data?.message || "Failed to fetch messages",
      };
    }
  },

  // Send message
  sendMessage: async (conversationId: string, content: string) => {
    try {
      const response = await axios.post(`/api/chat/conversations/${conversationId}/messages`, {
        content,
      });
      return { ok: true, message: response.data };
    } catch (error: any) {
      return {
        ok: false,
        message: error.response?.data?.message || "Failed to send message",
      };
    }
  },

  // Start new conversation
  startConversation: async (userId: string) => {
    try {
      const response = await axios.post("/api/chat/conversations", {
        userId,
      });
      return { ok: true, conversation: response.data };
    } catch (error: any) {
      return {
        ok: false,
        message: error.response?.data?.message || "Failed to start conversation",
      };
    }
  },

  // Mark as read
  markAsRead: async (conversationId: string) => {
    try {
      await axios.put(`/api/chat/conversations/${conversationId}/mark-read`);
      return { ok: true };
    } catch (error: any) {
      return {
        ok: false,
        message: error.response?.data?.message || "Failed to mark as read",
      };
    }
  },

  // Delete conversation
  deleteConversation: async (conversationId: string) => {
    try {
      await axios.delete(`/api/chat/conversations/${conversationId}`);
      return { ok: true };
    } catch (error: any) {
      return {
        ok: false,
        message: error.response?.data?.message || "Failed to delete conversation",
      };
    }
  },
};
