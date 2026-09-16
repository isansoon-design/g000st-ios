import type { PersistedSession } from "@/features/auth/types";

const SESSION_KEY = "g000st.session.v1";
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

function setSessionHint(enabled: boolean): void {
  if (typeof document === "undefined") return;

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = enabled
    ? `${SESSION_HINT_COOKIE}=1; Path=/; Max-Age=2592000; SameSite=Lax${secure}`
    : `${SESSION_HINT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
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
    setSessionHint(true);
  },

  clear(): void {
    if (typeof window !== "undefined") window.localStorage.removeItem(SESSION_KEY);
    setSessionHint(false);
  },
};
