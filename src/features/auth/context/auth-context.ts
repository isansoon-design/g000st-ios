import { createContext } from 'react';

import type { AuthenticationResult, AuthenticatedUser } from '@/domain/auth/types';

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated';

export type AuthContextValue = Readonly<{
  completeAuthentication: (result: AuthenticationResult) => Promise<void>;
  signOut: () => Promise<void>;
  status: AuthStatus;
  user: AuthenticatedUser | null;
}>;

export const AuthContext = createContext<AuthContextValue | null>(null);
