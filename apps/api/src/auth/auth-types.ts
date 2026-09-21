import type { AccountRole } from './auth-store.js';

export type AuthTokens = Readonly<{
  accessToken: string;
  expiresAt: number;
  refreshToken: string;
}>;

export type AuthenticatedUser = Readonly<{
  publicId: string;
  role: AccountRole;
}>;

export type AuthenticationResult = Readonly<{
  session: AuthTokens;
  user: AuthenticatedUser;
}>;

export type RegisterAccountResult = AuthenticationResult &
  Readonly<{
    recoveryId: string;
  }>;
