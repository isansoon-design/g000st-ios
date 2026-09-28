import axios, { isAxiosError, type InternalAxiosRequestConfig } from "axios";

import { toApiError } from "@/app/api/api-error";
import { sessionStorage } from "@/app/api/session-storage";
import type { RefreshSessionResult } from "@/features/auth/types";

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  _sessionVersion?: number;
  _sessionRefreshToken?: string;
  _sessionPublicId?: string;
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

let refreshInFlight: { version: number; promise: Promise<string> } | null = null;

async function refreshAccessToken(): Promise<string> {
  const stored = sessionStorage.get();
  if (!stored?.tokens.refreshToken) throw new Error("No refresh token");
  const sessionVersion = sessionStorage.getVersion();

  const response = await axios.post<RefreshSessionResult>(
    `${apiBaseUrl}/auth/token/refresh`,
    { refreshToken: stored.tokens.refreshToken },
    { timeout: 15_000, headers: { Accept: "application/json" } },
  );

  if (!sessionStorage.saveRefreshed({ tokens: response.data.session, user: stored.user }, sessionVersion, stored.tokens.refreshToken)) {
    throw new Error("Session changed during token refresh");
  }
  return response.data.session.accessToken;
}

function refreshOnce(): Promise<string> {
  const version = sessionStorage.getVersion();
  if (refreshInFlight?.version !== version) {
    const promise = refreshAccessToken().finally(() => {
      if (refreshInFlight?.promise === promise) refreshInFlight = null;
    });
    refreshInFlight = { version, promise };
  }

  return refreshInFlight.promise;
}

axiosInstance.interceptors.request.use((config) => {
  const request = config as RetriableRequestConfig;
  if (request._retry && (request._sessionVersion !== sessionStorage.getVersion() ||
      request._sessionPublicId !== sessionStorage.get()?.user.publicId)) {
    return Promise.reject(new Error("Session changed during request retry"));
  }
  const session = sessionStorage.get();
  const token = session?.tokens.accessToken;
  request._sessionVersion = sessionStorage.getVersion();
  request._sessionRefreshToken = session?.tokens.refreshToken;
  request._sessionPublicId = session?.user.publicId;
  const isFormData = typeof FormData !== "undefined" && config.data instanceof FormData;

  config.headers.set("Accept-Language", "en");
  if (config.data != null && !isFormData) config.headers.set("Content-Type", "application/json");
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  else config.headers.delete("Authorization");
  const actor = sessionStorage.getActingPublicId();
  if (!token || config.url?.startsWith('/auth/')) config.headers.delete('X-Acting-Public-Id');
  else if (!config.headers.has('X-Acting-Public-Id') && actor) config.headers.set('X-Acting-Public-Id', actor);

  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!isAxiosError(error)) return Promise.reject(toApiError(error));

    const original = error.config as RetriableRequestConfig | undefined;
    const isRefreshRequest = original?.url?.includes("/auth/token/refresh");

    if (error.response?.status === 401 && original?.headers.has("Authorization") && !original._retry && !isRefreshRequest) {
      original._retry = true;
      const current = sessionStorage.get();
      if (!current || original._sessionVersion !== sessionStorage.getVersion() ||
          original._sessionPublicId !== current.user.publicId) {
        return Promise.reject(toApiError(error));
      }

      let accessToken: string;
      try {
        accessToken = await refreshOnce();
      } catch {
        if (original._sessionVersion === sessionStorage.getVersion() &&
            sessionStorage.get()?.tokens.refreshToken === original._sessionRefreshToken) {
          sessionStorage.clearIfVersion(original._sessionVersion);
          if (typeof window !== "undefined") window.location.replace("/login");
        }
        return Promise.reject(toApiError(error));
      }
      if (original._sessionVersion !== sessionStorage.getVersion() ||
          sessionStorage.get()?.user.publicId !== original._sessionPublicId) {
        return Promise.reject(toApiError(error));
      }
      original.headers.set("Authorization", `Bearer ${accessToken}`);
      return axiosInstance(original);
    }

    return Promise.reject(toApiError(error));
  },
);

export default axiosInstance;
