import type {
  AuthenticationResult,
  AuthTokens,
  AuthenticatedUser,
  RegisterAccountResult,
} from "@/features/auth/types";

function isTokens(value: unknown): value is AuthTokens {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AuthTokens>;
  return (
    typeof candidate.accessToken === "string" &&
    candidate.accessToken.length > 0 &&
    typeof candidate.refreshToken === "string" &&
    candidate.refreshToken.length > 0 &&
    typeof candidate.expiresAt === "number" &&
    Number.isFinite(candidate.expiresAt)
  );
}

function isUser(value: unknown): value is AuthenticatedUser {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AuthenticatedUser>;
  return (
    typeof candidate.publicId === "string" &&
    candidate.publicId.length === 50 &&
    (candidate.role === "user" || candidate.role === "admin")
  );
}

export function parseAuthenticationResult(value: unknown): AuthenticationResult {
  if (!value || typeof value !== "object") throw new Error("The API returned an invalid session.");
  const candidate = value as Partial<AuthenticationResult>;

  if (!isTokens(candidate.session) || !isUser(candidate.user)) {
    throw new Error("The API returned an invalid session.");
  }

  return { session: candidate.session, user: candidate.user };
}

export function parseRegisterAccountResult(value: unknown): RegisterAccountResult {
  const authenticated = parseAuthenticationResult(value);
  const recoveryId = (value as Partial<RegisterAccountResult>).recoveryId;

  if (typeof recoveryId !== "string" || recoveryId.length !== 50) {
    throw new Error("The API returned an invalid Recovery ID.");
  }

  return { ...authenticated, recoveryId };
}
