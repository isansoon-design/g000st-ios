import axios from 'axios';

import { parseApiPayload } from '@/api/parse-api-payload';
import { env } from '@/config/env';
import { refreshSessionResultSchema } from '@/domain/auth/types';
import { sessionStorage } from '@/services/session/session-storage';

let refreshInFlight: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const stored = await sessionStorage.get();
  if (!stored?.tokens.refreshToken) throw new Error('No refresh token');

  const response = await axios.post(
    `${env.apiBaseUrl}/auth/token/refresh`,
    { refreshToken: stored.tokens.refreshToken },
    { timeout: 15_000, headers: { Accept: 'application/json' } },
  );
  const result = parseApiPayload(refreshSessionResultSchema, response.data);

  await sessionStorage.save({
    user: stored.user,
    tokens: result.session,
  });

  return result.session.accessToken;
}

export const tokenService = {
  async getAccess(): Promise<string | null> {
    return (await sessionStorage.get())?.tokens.accessToken ?? null;
  },

  async refresh(): Promise<string> {
    if (!refreshInFlight) {
      refreshInFlight = refreshAccessToken().finally(() => {
        refreshInFlight = null;
      });
    }

    return refreshInFlight;
  },

  async clear(): Promise<void> {
    await sessionStorage.clear();
  },
};
