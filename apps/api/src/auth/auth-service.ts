import type { AuthStore, SessionMaterial } from './auth-store.js';
import type {
  AuthenticationResult,
  AuthTokens,
  RegisterAccountResult,
} from './auth-types.js';
import { generateG000stId, isValidG000stId } from '../core/identity.js';
import {
  createOpaqueToken,
  createRecoveryVerifier,
  hashOpaqueToken,
  recoveryLookupHash,
  verifyRecoveryId,
} from '../core/secrets.js';
import { ApiError } from '../http/api-error.js';

const ACCESS_TOKEN_LIFETIME_MS = 15 * 60 * 1_000;
const REFRESH_TOKEN_LIFETIME_MS = 30 * 24 * 60 * 60 * 1_000;
const GENERATED_ID_ATTEMPTS = 5;

type IssuedSession = Readonly<{
  material: SessionMaterial;
  tokens: AuthTokens;
}>;

export class AuthService {
  constructor(
    private readonly store: AuthStore,
    private readonly recoveryPepper: string,
    private readonly now: () => number = Date.now,
    private readonly isLoginEnabled: () => Promise<boolean> = async () => true,
  ) {}

  async register(requestedPublicId?: string, allowWhenClosed = false): Promise<RegisterAccountResult> {
    if (!allowWhenClosed && !(await this.isLoginEnabled())) {
      throw new ApiError(503, 'LOGIN_UNAVAILABLE', 'Registration is temporarily unavailable.');
    }
    if (requestedPublicId !== undefined && !isValidG000stId(requestedPublicId)) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Public ID must contain exactly 50 letters or numbers.',
      );
    }

    for (let attempt = 0; attempt < GENERATED_ID_ATTEMPTS; attempt += 1) {
      const publicId = requestedPublicId ?? generateG000stId();
      const recoveryId = this.generateDistinctRecoveryId(publicId);
      const recovery = await createRecoveryVerifier(recoveryId);
      const issued = this.issueSession();
      const createdAtMs = this.now();
      const result = await this.store.createAccount({
        createdAtMs,
        publicId,
        recovery: {
          ...recovery,
          lookupHash: recoveryLookupHash(recoveryId, this.recoveryPepper),
          publicId,
        },
        session: issued.material,
      });

      if (result === 'created') {
        return {
          recoveryId,
          session: issued.tokens,
          user: { publicId, role: 'user' },
        };
      }

      if (result === 'public_id_unavailable' && requestedPublicId) {
        throw new ApiError(409, 'PUBLIC_ID_UNAVAILABLE', 'That Public ID is unavailable.');
      }
    }

    throw new ApiError(503, 'IDENTITY_GENERATION_FAILED', 'Could not create an ID. Try again.');
  }

  async restore(recoveryId: string): Promise<AuthenticationResult> {
    if (!isValidG000stId(recoveryId)) {
      throw this.invalidRecoveryId();
    }

    const lookupHash = recoveryLookupHash(recoveryId, this.recoveryPepper);
    const credential = await this.store.findRecoveryCredential(lookupHash);

    if (!credential || !(await verifyRecoveryId(recoveryId, credential))) {
      throw this.invalidRecoveryId();
    }

    if (!(await this.store.isUserActive(credential.publicId))) {
      throw new ApiError(403, 'ACCOUNT_UNAVAILABLE', 'This account is unavailable.');
    }

    const role = await this.store.getAccountRole(credential.publicId);
    if (role !== 'admin' && !(await this.isLoginEnabled())) {
      throw new ApiError(503, 'LOGIN_UNAVAILABLE', 'Login is temporarily unavailable.');
    }
    const issued = this.issueSession();
    await this.store.createSession(credential.publicId, issued.material, this.now());

    return {
      session: issued.tokens,
      user: { publicId: credential.publicId, role },
    };
  }

  async refresh(refreshToken: string): Promise<AuthenticationResult['session']> {
    if (!refreshToken) {
      throw new ApiError(401, 'SESSION_EXPIRED', 'Your session has expired.');
    }

    const issued = this.issueSession();
    const result = await this.store.rotateRefresh(
      hashOpaqueToken(refreshToken),
      issued.material,
      this.now(),
    );

    if (result !== 'rotated') {
      throw new ApiError(401, 'SESSION_EXPIRED', 'Your session has expired.');
    }

    return issued.tokens;
  }

  async getUser(accessToken: string): Promise<AuthenticationResult['user']> {
    if (!accessToken) throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required.');

    const account = await this.store.findActivePublicIdByAccessHash(
      hashOpaqueToken(accessToken),
      this.now(),
    );

    if (!account) {
      throw new ApiError(401, 'SESSION_EXPIRED', 'Your session has expired.');
    }

    return account;
  }

  async getActor(accessToken: string, actAsPublicId?: string): Promise<AuthenticationResult['user']> {
    const user = await this.getUser(accessToken);
    if (!actAsPublicId || actAsPublicId === user.publicId) return user;
    const owner = await this.store.getPageOwner?.(actAsPublicId);
    if (owner !== user.publicId) throw new ApiError(403, 'PAGE_ACCESS_DENIED', 'You cannot use this page.');
    return { publicId: actAsPublicId, role: 'user' };
  }

  async createPage(accessToken: string, input: Readonly<{ displayName?: string; bio?: string }> = {}) {
    const user = await this.getUser(accessToken);
    if (!this.store.createPage) throw new ApiError(503, 'PAGES_UNAVAILABLE', 'Pages are unavailable.');
    const displayName = input.displayName?.trim() ?? '';
    const bio = input.bio?.trim() ?? '';
    for (let attempt = 0; attempt < GENERATED_ID_ATTEMPTS; attempt += 1) {
      const publicId = generateG000stId();
      if (await this.store.createPage(user.publicId, publicId, displayName, bio, this.now()) === 'created') {
        return { publicId, displayName, bio };
      }
    }
    throw new ApiError(503, 'IDENTITY_GENERATION_FAILED', 'Could not create a page. Try again.');
  }

  async listPages(accessToken: string) {
    const user = await this.getUser(accessToken);
    return await this.store.listPages?.(user.publicId) ?? [];
  }

  async isPage(publicId: string): Promise<boolean> {
    return (await this.store.getPageOwner?.(publicId)) != null;
  }

  async assertPageCanPublish(publicId: string): Promise<void> {
    if (await this.isPage(publicId) && !(await this.store.getPageDisplayName?.(publicId))?.trim()) {
      throw new ApiError(400, 'PAGE_NAME_REQUIRED', 'Name your page before posting.');
    }
  }

  async deleteAccount(accessToken: string): Promise<void> {
    const account = await this.getUser(accessToken);
    await this.store.deleteAccount(account.publicId, this.now());
  }

  private generateDistinctRecoveryId(publicId: string): string {
    let recoveryId = generateG000stId();
    while (recoveryId === publicId) recoveryId = generateG000stId();
    return recoveryId;
  }

  private invalidRecoveryId(): ApiError {
    return new ApiError(401, 'INVALID_RECOVERY_ID', 'Recovery ID is invalid.');
  }

  private issueSession(): IssuedSession {
    const nowMs = this.now();
    const accessToken = createOpaqueToken(32);
    const refreshToken = createOpaqueToken(48);
    const accessExpiresAtMs = nowMs + ACCESS_TOKEN_LIFETIME_MS;

    return {
      material: {
        accessExpiresAtMs,
        accessHash: hashOpaqueToken(accessToken),
        refreshExpiresAtMs: nowMs + REFRESH_TOKEN_LIFETIME_MS,
        refreshHash: hashOpaqueToken(refreshToken),
      },
      tokens: {
        accessToken,
        expiresAt: accessExpiresAtMs,
        refreshToken,
      },
    };
  }
}
