import * as SecureStore from 'expo-secure-store';

import { persistedSessionSchema, type PersistedSession } from '@/domain/auth/types';
import { emitSessionCleared } from '@/services/session/session-events';

const SESSION_KEY = 'g000st.session.v1';

async function clearPersistedSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
  emitSessionCleared();
}

export const sessionStorage = {
  async get(): Promise<PersistedSession | null> {
    const serialized = await SecureStore.getItemAsync(SESSION_KEY);
    if (!serialized) return null;

    try {
      const parsed: unknown = JSON.parse(serialized);
      const result = persistedSessionSchema.safeParse(parsed);
      if (result.success) return result.data;
    } catch {
      // Invalid sessions are removed below so startup cannot loop forever.
    }

    await clearPersistedSession();
    return null;
  },

  async save(session: PersistedSession): Promise<void> {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },

  async clear(): Promise<void> {
    await clearPersistedSession();
  },
};
