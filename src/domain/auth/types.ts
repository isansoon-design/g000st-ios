import { z } from 'zod';

import { G000ST_ID_LENGTH } from '@/domain/identity/constants';

export const g000stIdSchema = z.string().length(G000ST_ID_LENGTH);

export const authTokensSchema = z.object({
  accessToken: z.string().min(1),
  expiresAt: z.number().int().positive(),
  refreshToken: z.string().min(1),
});

export const authenticatedUserSchema = z.object({
  publicId: g000stIdSchema,
});

export const persistedSessionSchema = z.object({
  tokens: authTokensSchema,
  user: authenticatedUserSchema,
});

export const authenticationResultSchema = z.object({
  session: authTokensSchema,
  user: authenticatedUserSchema,
});

export const registerAccountResultSchema = authenticationResultSchema.extend({
  recoveryId: g000stIdSchema,
});

export const refreshSessionResultSchema = z.object({
  session: authTokensSchema,
});

export type AuthTokens = Readonly<z.infer<typeof authTokensSchema>>;
export type AuthenticatedUser = Readonly<z.infer<typeof authenticatedUserSchema>>;
export type PersistedSession = Readonly<z.infer<typeof persistedSessionSchema>>;
export type AuthenticationResult = Readonly<z.infer<typeof authenticationResultSchema>>;
export type RegisterAccountResult = Readonly<z.infer<typeof registerAccountResultSchema>>;
export type RefreshSessionResult = Readonly<z.infer<typeof refreshSessionResultSchema>>;

export type RegisterAccountRequest = Readonly<{
  requestedPublicId?: string;
}>;

export type RestoreAccountRequest = Readonly<{
  recoveryId: string;
}>;
