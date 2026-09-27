import type { PersistedSession } from "@/features/auth/types";

export const SESSION_KEY = "g000st.session.v1";
const RECOVERY_ID_KEY = "g000st.recovery-id.v1";
const SAVED_ACCOUNTS_KEY = "g000st.saved-accounts.v1";
const ACTING_ID_KEY = 'g000st.acting-id.v1';
export type SavedAccount = Readonly<{ publicId: string; recoveryId: string; displayName?: string; avatarUrl?: string }>;

function readSavedAccounts(): SavedAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(SAVED_ACCOUNTS_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is SavedAccount =>
      !!entry && typeof entry === "object" &&
      typeof entry.publicId === "string" && /^[A-Za-z0-9]{50}$/.test(entry.publicId) &&
      typeof entry.recoveryId === "string" && /^[A-Za-z0-9]{50}$/.test(entry.recoveryId) &&
      (entry.displayName === undefined || typeof entry.displayName === "string") &&
      (entry.avatarUrl === undefined || typeof entry.avatarUrl === "string"));
  } catch { return []; }
}

const SESSION_HINT_COOKIE = "g000st_session_hint";
let sessionVersion = 0;

function isAuthTokens(value: unknown): value is PersistedSession["tokens"] {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PersistedSession["tokens"]>;
  return (
    typeof candidate.accessToken === "string" &&
    typeof candidate.expiresAt === "number" &&
    typeof candidate.refreshToken === "string"
  );
}

function isPersistedSession(value: unknown): value is PersistedSession {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PersistedSession>;
  return (
    isAuthTokens(candidate.tokens) &&
    !!candidate.user &&
    typeof candidate.user.publicId === "string" &&
    candidate.user.publicId.length === 50
  );
}

function setCookie(name: string, value: string | null): void {
  if (typeof document === "undefined") return;

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie =
    value !== null
      ? `${name}=${value}; Path=/; Max-Age=2592000; SameSite=Lax${secure}`
      : `${name}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

export const sessionStorage = {
  getActingPublicId(): string | null {
    const owner = this.get()?.user.publicId;
    if (!owner) return null;
    if (typeof window === 'undefined') return owner;
    try {
      const stored = JSON.parse(window.sessionStorage.getItem(ACTING_ID_KEY) ?? 'null') as { ownerPublicId?: unknown; publicId?: unknown } | null;
      return stored?.ownerPublicId === owner && typeof stored.publicId === 'string' && /^[A-Za-z0-9]{50}$/.test(stored.publicId) ? stored.publicId : owner;
    } catch { return owner; }
  },

  setActingPublicId(publicId: string): void {
    const owner = this.get()?.user.publicId;
    if (!owner || !/^[A-Za-z0-9]{50}$/.test(publicId) || typeof window === 'undefined') return;
    window.sessionStorage.setItem(ACTING_ID_KEY, JSON.stringify({ ownerPublicId: owner, publicId }));
    sessionVersion += 1;
  },
  getVersion(): number {
    return sessionVersion;
  },

  get(): PersistedSession | null {
    if (typeof window === "undefined") return null;

    const serialized = window.localStorage.getItem(SESSION_KEY);
    if (!serialized) return null;

    try {
      const parsed: unknown = JSON.parse(serialized);
      if (isPersistedSession(parsed)) return parsed;
    } catch {
      // Invalid sessions are cleared below.
    }

    this.clear();
    return null;
  },

  save(session: PersistedSession): void {
    if (typeof window === "undefined") return;
    sessionVersion += 1;
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setCookie(SESSION_HINT_COOKIE, "1");
    // Also only a routing hint (see middleware.ts) — the API enforces the real admin check
    // server-side via requireAdminRole against the access token, not this cookie.
    setCookie("user_role", session.user.role);
  },

  saveRefreshed(session: PersistedSession, expectedVersion: number, expectedRefreshToken: string): boolean {
    const current = this.get();
    if (sessionVersion !== expectedVersion || current?.user.publicId !== session.user.publicId || current.tokens.refreshToken !== expectedRefreshToken) {
      return false;
    }
    if (typeof window === "undefined") return false;
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return true;
  },

  listSavedAccounts(): SavedAccount[] {
    return readSavedAccounts();
  },

  updateSavedProfile(profile: { publicId: string; displayName?: string; showDisplayName: boolean; avatarUrl?: string }): void {
    if (typeof window === "undefined") return;
    const accounts = readSavedAccounts();
    if (!accounts.some((account) => account.publicId === profile.publicId)) return;
    window.localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts.map((account) =>
      account.publicId === profile.publicId
        ? { publicId: account.publicId, recoveryId: account.recoveryId,
            ...(profile.showDisplayName && profile.displayName ? { displayName: profile.displayName } : {}),
            ...(profile.avatarUrl ? { avatarUrl: profile.avatarUrl } : {}) }
        : account)));
  },

  removeSavedAccount(publicId: string): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(readSavedAccounts().filter((account) => account.publicId !== publicId)));
    const legacy = window.localStorage.getItem(RECOVERY_ID_KEY);
    if (legacy) {
      try {
        if ((JSON.parse(legacy) as { publicId?: unknown }).publicId === publicId) window.localStorage.removeItem(RECOVERY_ID_KEY);
      } catch { window.localStorage.removeItem(RECOVERY_ID_KEY); }
    }
  },

  getRecoveryId(publicId: string): string | null {
    if (typeof window === "undefined") return null;
    const serialized = window.localStorage.getItem(RECOVERY_ID_KEY);
    if (!serialized) return readSavedAccounts().find((account) => account.publicId === publicId)?.recoveryId ?? null;
    try {
      const stored: unknown = JSON.parse(serialized);
      if (stored && typeof stored === "object") {
        const candidate = stored as { publicId?: unknown; recoveryId?: unknown };
        if (candidate.publicId === publicId && typeof candidate.recoveryId === "string" && /^[A-Za-z0-9]{50}$/.test(candidate.recoveryId)) {
          return candidate.recoveryId;
        }
      }
    } catch {
      // Invalid data cannot be displayed as a Recovery ID.
    }
    return readSavedAccounts().find((account) => account.publicId === publicId)?.recoveryId ?? null;
  },

  saveRecoveryId(publicId: string, recoveryId: string): void {
    if (typeof window === "undefined") return;
    const accounts = readSavedAccounts();
    const existing = accounts.find((account) => account.publicId === publicId);
    window.localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify([
      existing ? { ...existing, recoveryId } : { publicId, recoveryId },
      ...accounts.filter((account) => account.publicId !== publicId),
    ]));
    window.localStorage.setItem(RECOVERY_ID_KEY, JSON.stringify({ publicId, recoveryId }));
  },

  clear(): void {
    sessionVersion += 1;
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(SESSION_KEY);
      window.localStorage.removeItem(RECOVERY_ID_KEY);
      window.sessionStorage.removeItem(ACTING_ID_KEY);
    }
    setCookie(SESSION_HINT_COOKIE, null);
    setCookie("user_role", null);
  },

  clearIfVersion(expectedVersion: number): void {
    if (sessionVersion === expectedVersion) this.clear();
  },
};
