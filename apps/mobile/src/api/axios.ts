import { create, isAxiosError, type InternalAxiosRequestConfig } from 'axios';

import { env } from '@/config/env';
import { toApiError } from '@/api/api-error';
import { tokenService } from '@/api/token-service';

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

const axiosInstance = create({
  baseURL: env.apiBaseUrl,
  timeout: 15_000,
  headers: {
    Accept: 'application/json',
  },
});

axiosInstance.interceptors.request.use(async (config) => {
  const token = await tokenService.getAccess();
  const isFormData = typeof FormData !== 'undefined' && config.data instanceof FormData;

  config.headers.set('Accept-Language', 'en');

  if (config.data != null && !isFormData) {
    config.headers.set('Content-Type', 'application/json');
  }

  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }

  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!isAxiosError(error)) return Promise.reject(toApiError(error));

    const original = error.config as RetriableRequestConfig | undefined;
    const isRefreshRequest = original?.url?.includes('/auth/token/refresh');

    if (error.response?.status === 401 && original && !original._retry && !isRefreshRequest) {
      original._retry = true;

      try {
        const accessToken = await tokenService.refresh();
        original.headers.set('Authorization', `Bearer ${accessToken}`);
        return await axiosInstance(original);
      } catch {
        await tokenService.clear();
      }
    }

    return Promise.reject(toApiError(error));
  },
);

export default axiosInstance;
