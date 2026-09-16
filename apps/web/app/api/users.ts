import axios from "./axios";

export interface UserData {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  bio?: string;
  status: "active" | "suspended" | "banned";
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
}

export const usersAPI = {
  // Get all users (admin only)
  getAllUsers: async (page: number = 1) => {
    try {
      const response = await axios.get("/api/admin/users", {
        params: { page, limit: 20 },
      });
      return { ok: true, users: response.data.users, total: response.data.total };
    } catch (error: any) {
      return {
        ok: false,
        message: error.response?.data?.message || "Failed to fetch users",
      };
    }
  },

  // Get user by ID
  getUserById: async (userId: string) => {
    try {
      const response = await axios.get(`/api/admin/users/${userId}`);
      return { ok: true, user: response.data };
    } catch (error: any) {
      return {
        ok: false,
        message: error.response?.data?.message || "Failed to fetch user",
      };
    }
  },

  // Update user profile
  updateProfile: async (data: Partial<UserData>) => {
    try {
      const response = await axios.put("/api/users/profile", data);
      return { ok: true, user: response.data };
    } catch (error: any) {
      return {
        ok: false,
        message: error.response?.data?.message || "Failed to update profile",
      };
    }
  },

  // Change password
  changePassword: async (currentPassword: string, newPassword: string) => {
    try {
      await axios.put("/api/users/change-password", {
        currentPassword,
        newPassword,
      });
      return { ok: true };
    } catch (error: any) {
      return {
        ok: false,
        message: error.response?.data?.message || "Failed to change password",
      };
    }
  },

  // Suspend user (admin only)
  suspendUser: async (userId: string) => {
    try {
      await axios.post(`/api/admin/users/${userId}/suspend`);
      return { ok: true };
    } catch (error: any) {
      return {
        ok: false,
        message: error.response?.data?.message || "Failed to suspend user",
      };
    }
  },

  // Unsuspend user (admin only)
  unsuspendUser: async (userId: string) => {
    try {
      await axios.post(`/api/admin/users/${userId}/unsuspend`);
      return { ok: true };
    } catch (error: any) {
      return {
        ok: false,
        message: error.response?.data?.message || "Failed to unsuspend user",
      };
    }
  },

  // Delete user (admin only)
  deleteUser: async (userId: string) => {
    try {
      await axios.delete(`/api/admin/users/${userId}`);
      return { ok: true };
    } catch (error: any) {
      return {
        ok: false,
        message: error.response?.data?.message || "Failed to delete user",
      };
    }
  },

  // Search users (admin only)
  searchUsers: async (query: string) => {
    try {
      const response = await axios.get("/api/admin/users/search", {
        params: { q: query },
      });
      return { ok: true, users: response.data };
    } catch (error: any) {
      return {
        ok: false,
        message: error.response?.data?.message || "Failed to search users",
      };
    }
  },
};
