import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import type { SocialProfile } from '@/domain/social/types';

const ACCOUNTS_KEY = 'g000st.saved-accounts.v1';
const secretKey = (publicId: string) => `g000st.account.${publicId}`;
const validId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9]{50}$/.test(value);

export type SavedAccount = Readonly<{ publicId: string; displayName?: string; avatarUrl?: string }>;
let pendingWrite: Promise<void> = Promise.resolve();

function enqueue(write: () => Promise<void>): Promise<void> {
  const next = pendingWrite.then(write, write);
  pendingWrite = next.catch(() => undefined);
  return next;
}

async function readAccounts(): Promise<SavedAccount[]> {
  const raw = await AsyncStorage.getItem(ACCOUNTS_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is SavedAccount =>
      !!entry && typeof entry === 'object' && validId(entry.publicId) &&
      (entry.displayName === undefined || typeof entry.displayName === 'string') &&
      (entry.avatarUrl === undefined || typeof entry.avatarUrl === 'string'));
  } catch {
    return [];
  }
}

export const savedAccounts = {
  async list(): Promise<SavedAccount[]> {
    await pendingWrite;
    return readAccounts();
  },
  async getSecret(publicId: string): Promise<string | null> {
    if (!validId(publicId)) return null;
    await pendingWrite;
    return SecureStore.getItemAsync(secretKey(publicId));
  },
  async save(publicId: string, recoveryId: string): Promise<void> {
    if (!validId(publicId) || !validId(recoveryId)) throw new Error('Invalid account ID');
    await enqueue(async () => {
      await SecureStore.setItemAsync(secretKey(publicId), recoveryId, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      const accounts = await readAccounts();
      await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify([
        accounts.find((account) => account.publicId === publicId) ?? { publicId },
        ...accounts.filter((account) => account.publicId !== publicId),
      ]));
    });
  },
  async updateProfile(profile: SocialProfile): Promise<void> {
    await enqueue(async () => {
      const accounts = await readAccounts();
      if (!accounts.some((account) => account.publicId === profile.publicId)) return;
      await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts.map((account) =>
        account.publicId === profile.publicId
          ? { publicId: account.publicId, ...(profile.showDisplayName && profile.displayName ? { displayName: profile.displayName } : {}), ...(profile.avatarUrl ? { avatarUrl: profile.avatarUrl } : {}) }
          : account)));
    });
  },
  async remove(publicId: string): Promise<void> {
    if (!validId(publicId)) return;
    await enqueue(async () => {
      await SecureStore.deleteItemAsync(secretKey(publicId));
      const accounts = await readAccounts();
      await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts.filter((account) => account.publicId !== publicId)));
    });
  },
};
