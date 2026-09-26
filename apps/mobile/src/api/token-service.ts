import axios from 'axios';

import { parseApiPayload } from '@/api/parse-api-payload';
import { env } from '@/config/env';
import { refreshSessionResultSchema } from '@/domain/auth/types';
import { sessionStorage } from '@/services/session/session-storage';

let refreshInFlight: { version: number; promise: Promise<string> } | null = null;

async function refreshAccessToken(expectedVersion: number): Promise<string> {
  const stored = await sessionStorage.get();
  if (!stored?.tokens.refreshToken || sessionStorage.getVersion() !== expectedVersion) {
    throw new Error('Session changed during token refresh');
  }

  const response = await axios.post(
    `${env.apiBaseUrl}/auth/token/refresh`,
    { refreshToken: stored.tokens.refreshToken },
    { timeout: 15_000, headers: { Accept: 'application/json' } },
  );
  const result = parseApiPayload(refreshSessionResultSchema, response.data);

  const saved = await sessionStorage.saveRefreshed({
    user: stored.user,
    tokens: result.session,
  }, expectedVersion);
  if (!saved) throw new Error('Session changed during token refresh');

  return result.session.accessToken;
}

export const tokenService = {
  getVersion(): number {
    return sessionStorage.getVersion();
  },

  async getAccess(): Promise<string | null> {
    const version = sessionStorage.getVersion();
    const token = (await sessionStorage.get())?.tokens.accessToken ?? null;
    return version === sessionStorage.getVersion() ? token : null;
  },

  async refresh(expectedVersion: number): Promise<string> {
    if (sessionStorage.getVersion() !== expectedVersion) {
      throw new Error('Session changed during token refresh');
    }
    if (refreshInFlight?.version !== expectedVersion) {
      const promise = refreshAccessToken(expectedVersion).finally(() => {
        if (refreshInFlight?.promise === promise) refreshInFlight = null;
      });
      refreshInFlight = { version: expectedVersion, promise };
    }

    return refreshInFlight.promise;
  },

  async clearIfVersion(expectedVersion: number): Promise<void> {
    await sessionStorage.clearIfVersion(expectedVersion);
  },
};
