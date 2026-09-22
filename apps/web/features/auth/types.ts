export type AuthTokens = Readonly<{
  accessToken: string;
  expiresAt: number;
  refreshToken: string;
}>;

export type AuthenticatedUser = Readonly<{
  publicId: string;
  role: "user" | "admin";
}>;

export type AuthenticationResult = Readonly<{
  session: AuthTokens;
  user: AuthenticatedUser;
}>;

export type RegisterAccountResult = AuthenticationResult &
  Readonly<{
    recoveryId: string;
  }>;

export type PersistedSession = Readonly<{
  tokens: AuthTokens;
  user: AuthenticatedUser;
}>;

export type RefreshSessionResult = Readonly<{
  session: AuthTokens;
}>;
