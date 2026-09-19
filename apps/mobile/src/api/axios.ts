import { create, isAxiosError, type InternalAxiosRequestConfig } from "axios";

import { toApiError } from "@/api/api-error";
import { tokenService } from "@/api/token-service";
import { env } from "@/config/env";

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

type CompatibleHeaders = InternalAxiosRequestConfig['headers'] &
  Record<string, unknown> & {
    set?: (name: string, value: string) => void;
    toJSON?: () => unknown;
  };

function setHeader(
  config: InternalAxiosRequestConfig,
  name: string,
  value: string,
): void {
  const headers = config.headers as CompatibleHeaders;
  if (typeof headers.set === "function") {
    headers.set(name, value);
    return;
  }

  headers[name] = value;
}

function headersForLog(config: InternalAxiosRequestConfig): unknown {
  const headers = config.headers as CompatibleHeaders;
  return typeof headers.toJSON === "function" ? headers.toJSON() : headers;
}

function valueForLog(value: unknown): unknown {
  if (typeof FormData !== "undefined" && value instanceof FormData) {
    return "[FormData]";
  }
  if (Array.isArray(value)) return value.map(valueForLog);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      /authorization|cookie|password|private.?key|recovery|secret|token/i.test(key)
        ? "[REDACTED]"
        : valueForLog(entry),
    ]),
  );
}

const axiosInstance = create({
  baseURL: env.apiBaseUrl,
  timeout: 15_000,
  headers: {
    Accept: "application/json",
  },
});

axiosInstance.interceptors.request.use(async (config) => {
  const token = await tokenService.getAccess();
  const isFormData =
    typeof FormData !== "undefined" && config.data instanceof FormData;

  setHeader(config, "Accept-Language", "en");

  if (config.data != null && !isFormData) {
    setHeader(config, "Content-Type", "application/json");
  }

  if (__DEV__) {
    console.log("Request:", {
      url: config.url,
      method: config.method,
      headers: valueForLog(headersForLog(config)),
      data: valueForLog(config.data),
    });
  } else {
    console.log("Request:");
  }

  if (token) {
    setHeader(config, "Authorization", `Bearer ${token}`);
  }

  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!isAxiosError(error)) return Promise.reject(toApiError(error));

    const original = error.config as RetriableRequestConfig | undefined;
    const isRefreshRequest = original?.url?.includes("/auth/token/refresh");
    console.log("Response error:", {
      url: original?.url,
      method: original?.method,
      status: error.response?.status,
      data: valueForLog(error.response?.data),
    });
    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !isRefreshRequest
    ) {
      original._retry = true;

      try {
        const accessToken = await tokenService.refresh();
        setHeader(original, "Authorization", `Bearer ${accessToken}`);
        return await axiosInstance(original);
      } catch {
        await tokenService.clear();
      }
    }

    return Promise.reject(toApiError(error));
  },
);

export default axiosInstance;
