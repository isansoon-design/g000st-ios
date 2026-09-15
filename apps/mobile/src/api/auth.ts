import type { AxiosResponse } from 'axios';

import axiosInstance from '@/api/axios';
import type {
  AuthenticationResult,
  RegisterAccountRequest,
  RegisterAccountResult,
  RestoreAccountRequest,
} from '@/domain/auth/types';

export async function registerAccount(
  request: RegisterAccountRequest,
): Promise<AxiosResponse<RegisterAccountResult>> {
  return await axiosInstance.post('/auth/register', request);
}

export async function restoreAccount(
  request: RestoreAccountRequest,
): Promise<AxiosResponse<AuthenticationResult>> {
  return await axiosInstance.post('/auth/sessions', request);
}
