import axiosInstance from "./axios";

export interface LoginPayload {
  email?: string;
  phone?: string;
  password: string;
}

export interface RegisterPayload {
  email?: string;
  phone?: string;
  password: string;
  name?: string;
}

export interface AuthResponse {
  ok: boolean;
  token?: string;
  user?: {
    id: string;
    email?: string;
    phone?: string;
    name?: string;
    isAdmin?: boolean;
  };
  message?: string;
}

// Login
export async function login(payload: LoginPayload): Promise<AuthResponse> {
  try {
    const { data } = await axiosInstance.post<AuthResponse>("/auth/login", payload);
    if (data.token) {
      localStorage.setItem("auth_token", data.token);
      if (data.user?.id) {
        localStorage.setItem("user_id", data.user.id);
      }
    }
    return data;
  } catch (error: any) {
    return {
      ok: false,
      message: error.response?.data?.message || "Login failed",
    };
  }
}

// Register
export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  try {
    const { data } = await axiosInstance.post<AuthResponse>("/auth/register", payload);
    if (data.token) {
      localStorage.setItem("auth_token", data.token);
      if (data.user?.id) {
        localStorage.setItem("user_id", data.user.id);
      }
    }
    return data;
  } catch (error: any) {
    return {
      ok: false,
      message: error.response?.data?.message || "Registration failed",
    };
  }
}

// Logout
export function logout(): void {
  try {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_id");
  } catch (e) {
    // Handle error
  }
}

// Get current user
export async function getCurrentUser() {
  try {
    const { data } = await axiosInstance.get("/auth/me");
    return data;
  } catch (error) {
    return null;
  }
}
