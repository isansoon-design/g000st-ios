import { registerAccount, restoreAccount } from '@/api';
import { parseApiPayload } from '@/api/parse-api-payload';
import {
  authenticationResultSchema,
  registerAccountResultSchema,
  type AuthenticationResult,
  type RegisterAccountRequest,
  type RegisterAccountResult,
  type RestoreAccountRequest,
} from '@/domain/auth/types';

export async function createAccount(
  request: RegisterAccountRequest,
): Promise<RegisterAccountResult> {
  const response = await registerAccount(request);
  return parseApiPayload(registerAccountResultSchema, response.data);
}

export async function recoverAccount(
  request: RestoreAccountRequest,
): Promise<AuthenticationResult> {
  const response = await restoreAccount(request);
  return parseApiPayload(authenticationResultSchema, response.data);
}
