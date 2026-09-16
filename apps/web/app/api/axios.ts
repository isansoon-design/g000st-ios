import axios, { isAxiosError, type InternalAxiosRequestConfig } from "axios";

import { toApiError } from "@/app/api/api-error";
import { sessionStorage } from "@/app/api/session-storage";
import type { RefreshSessionResult } from "@/features/auth/types";

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

const apiOrigin = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3100").replace(
  /\/+$/,
  "",
);
const apiBasePath = `/${(process.env.NEXT_PUBLIC_API_BASE_PATH || "/api/v1").replace(
  /^\/+|\/+$/g,
  "",
)}`;
const apiBaseUrl = `${apiOrigin}${apiBasePath}`;

const axiosInstance = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15_000,
  headers: { Accept: "application/json" },
});

let refreshInFlight: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const stored = sessionStorage.get();
  if (!stored?.tokens.refreshToken) throw new Error("No refresh token");

  const response = await axios.post<RefreshSessionResult>(
    `${apiBaseUrl}/auth/token/refresh`,
    { refreshToken: stored.tokens.refreshToken },
    { timeout: 15_000, headers: { Accept: "application/json" } },
  );

  sessionStorage.save({ tokens: response.data.session, user: stored.user });
  return response.data.session.accessToken;
}

function refreshOnce(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = refreshAccessToken().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

axiosInstance.interceptors.request.use((config) => {
  const token = sessionStorage.get()?.tokens.accessToken;
  const isFormData = typeof FormData !== "undefined" && config.data instanceof FormData;

  config.headers.set("Accept-Language", "en");
  if (config.data != null && !isFormData) config.headers.set("Content-Type", "application/json");
  if (token) config.headers.set("Authorization", `Bearer ${token}`);

  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!isAxiosError(error)) return Promise.reject(toApiError(error));

    const original = error.config as RetriableRequestConfig | undefined;
    const isRefreshRequest = original?.url?.includes("/auth/token/refresh");

    if (error.response?.status === 401 && original && !original._retry && !isRefreshRequest) {
      original._retry = true;

      try {
        const accessToken = await refreshOnce();
        original.headers.set("Authorization", `Bearer ${accessToken}`);
        return await axiosInstance(original);
      } catch {
        sessionStorage.clear();
        if (typeof window !== "undefined") window.location.assign("/login");
      }
    }

    return Promise.reject(toApiError(error));
  },
);

export default axiosInstance;
