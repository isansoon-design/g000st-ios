import type { PersistedSession } from "@/features/auth/types";

const SESSION_KEY = "g000st.session.v1";
const RECOVERY_ID_KEY = "g000st.recovery-id.v1";
const SESSION_HINT_COOKIE = "g000st_session_hint";

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
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setCookie(SESSION_HINT_COOKIE, "1");
    // Also only a routing hint (see middleware.ts) — the API enforces the real admin check
    // server-side via requireAdminRole against the access token, not this cookie.
    setCookie("user_role", session.user.role);
  },

  getRecoveryId(publicId: string): string | null {
    if (typeof window === "undefined") return null;
    const serialized = window.localStorage.getItem(RECOVERY_ID_KEY);
    if (!serialized) return null;
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
    return null;
  },

  saveRecoveryId(publicId: string, recoveryId: string): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(RECOVERY_ID_KEY, JSON.stringify({ publicId, recoveryId }));
  },

  clear(): void {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(SESSION_KEY);
      window.localStorage.removeItem(RECOVERY_ID_KEY);
    }
    setCookie(SESSION_HINT_COOKIE, null);
    setCookie("user_role", null);
  },
};
