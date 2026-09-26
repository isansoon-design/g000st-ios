import * as SecureStore from 'expo-secure-store';

import { persistedSessionSchema, type PersistedSession } from '@/domain/auth/types';
import { emitSessionCleared } from '@/services/session/session-events';
import { recoveryIdStorage } from '@/services/session/recovery-id-storage';

const SESSION_KEY = 'g000st.session.v1';
let sessionVersion = 0;
let pendingWrite: Promise<void> = Promise.resolve();

function enqueueWrite(write: () => Promise<void>): Promise<void> {
  const next = pendingWrite.then(write, write);
  pendingWrite = next.catch(() => undefined);
  return next;
}

async function clearPersistedSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
  try {
    await recoveryIdStorage.clear();
  } finally {
    emitSessionCleared();
  }
}

export const sessionStorage = {
  getVersion(): number {
    return sessionVersion;
  },

  async get(): Promise<PersistedSession | null> {
    await pendingWrite;
    const serialized = await SecureStore.getItemAsync(SESSION_KEY);
    if (!serialized) return null;

    try {
      const parsed: unknown = JSON.parse(serialized);
      const result = persistedSessionSchema.safeParse(parsed);
      if (result.success) return result.data;
    } catch {
      // Invalid sessions are removed below so startup cannot loop forever.
    }

    await this.clear();
    return null;
  },

  async save(session: PersistedSession): Promise<void> {
    sessionVersion += 1;
    await enqueueWrite(() => SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }));
  },

  async saveRefreshed(session: PersistedSession, expectedVersion: number): Promise<boolean> {
    if (sessionVersion !== expectedVersion) return false;
    let saved = false;
    await enqueueWrite(async () => {
      if (sessionVersion !== expectedVersion) return;
      const current = await SecureStore.getItemAsync(SESSION_KEY);
      if (sessionVersion !== expectedVersion || !current) return;
      const parsed = persistedSessionSchema.safeParse(JSON.parse(current));
      if (!parsed.success || parsed.data.user.publicId !== session.user.publicId) return;
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session), {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      saved = true;
    });
    return saved;
  },

  async clear(): Promise<void> {
    sessionVersion += 1;
    await enqueueWrite(clearPersistedSession);
  },

  async clearIfVersion(expectedVersion: number): Promise<void> {
    if (sessionVersion === expectedVersion) await this.clear();
  },
};
