import type { AxiosResponse } from "axios";

import axiosInstance from "@/app/api/axios";
import { sessionStorage } from "@/app/api/session-storage";
import type {
  AuthenticationResult,
  AuthenticatedUser,
  RegisterAccountResult,
} from "@/features/auth/types";

export type RegisterAccountRequest = Readonly<{
  requestedPublicId?: string;
}>;

export type RestoreAccountRequest = Readonly<{
  recoveryId: string;
}>;

export async function registerAccount(
  request: RegisterAccountRequest,
): Promise<AxiosResponse<RegisterAccountResult>> {
  return await axiosInstance.post("/auth/register", request);
}

export async function restoreAccount(
  request: RestoreAccountRequest,
): Promise<AxiosResponse<AuthenticationResult>> {
  return await axiosInstance.post("/auth/sessions", request);
}

export async function getCurrentUser(): Promise<AxiosResponse<{ user: AuthenticatedUser }>> {
  return await axiosInstance.get("/auth/me");
}

export async function deleteAccount(): Promise<void> {
  await axiosInstance.delete("/auth/me");
}

export function logout(): void {
  sessionStorage.clear();
}
