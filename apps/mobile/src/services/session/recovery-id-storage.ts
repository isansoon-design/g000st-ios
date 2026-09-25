import * as SecureStore from 'expo-secure-store';

const RECOVERY_ID_KEY = 'g000st.recovery-id.v1';

type StoredRecoveryId = Readonly<{ publicId: string; recoveryId: string }>;

export const recoveryIdStorage = {
  async get(publicId: string): Promise<string | null> {
    const serialized = await SecureStore.getItemAsync(RECOVERY_ID_KEY);
    if (!serialized) return null;

    try {
      const stored: StoredRecoveryId = JSON.parse(serialized);
      if (stored.publicId === publicId && /^[A-Za-z0-9]{50}$/.test(stored.recoveryId)) {
        return stored.recoveryId;
      }
    } catch {
      // An invalid or older value cannot be shown as a Recovery ID.
    }
    return null;
  },

  async save(publicId: string, recoveryId: string): Promise<void> {
    await SecureStore.setItemAsync(
      RECOVERY_ID_KEY,
      JSON.stringify({ publicId, recoveryId } satisfies StoredRecoveryId),
      { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
    );
  },

  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(RECOVERY_ID_KEY);
  },
};
