import type { AxiosResponse } from 'axios';

import axiosInstance from '@/api/axios';
import { z } from 'zod';
import { parseApiPayload } from '@/api/parse-api-payload';
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

export async function deleteAccount(): Promise<void> {
  await axiosInstance.delete('/auth/me');
}

const pageSchema = z.object({ publicId: z.string(), displayName: z.string(), bio: z.string() });
export type BeaconPage = z.infer<typeof pageSchema>;

export async function listBeaconPages(): Promise<BeaconPage[]> {
  const response = await axiosInstance.get('/auth/pages');
  return parseApiPayload(z.object({ pages: z.array(pageSchema) }), response.data).pages;
}

export async function createBeaconPage(displayName: string, bio: string): Promise<BeaconPage> {
  const response = await axiosInstance.post('/auth/pages', { displayName, bio });
  return parseApiPayload(z.object({ page: pageSchema }), response.data).page;
}
