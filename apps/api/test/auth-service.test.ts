import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { AuthService } from '../src/auth/auth-service.js';
import type {
  AccountReservation,
  AccountRole,
  ActiveAccount,
  AuthStore,
  RecoveryCredentialRecord,
  ReserveAccountResult,
  RotateRefreshResult,
  SessionMaterial,
} from '../src/auth/auth-store.js';
import { isValidG000stId } from '../src/core/identity.js';
import { hashOpaqueToken } from '../src/core/secrets.js';
import { ApiError } from '../src/http/api-error.js';

type StoredSession = SessionMaterial & Readonly<{ familyId: string; publicId: string }>;

class MemoryAuthStore implements AuthStore {
  private familySequence = 0;
  private readonly access = new Map<string, StoredSession>();
  private readonly families = new Map<string, { revoked: boolean }>();
  private readonly recoveries = new Map<string, RecoveryCredentialRecord>();
  private readonly refresh = new Map<string, StoredSession & { rotated: boolean }>();
  private readonly users = new Map<string, AccountRole>();
  private readonly pages = new Map<string, { ownerPublicId: string; displayName: string; bio: string }>();

  constructor(private readonly forcedCreateResults: ReserveAccountResult[] = []) {}

  setRole(publicId: string, role: AccountRole): void { this.users.set(publicId, role); }

  async createAccount(reservation: AccountReservation): Promise<ReserveAccountResult> {
    const forcedResult = this.forcedCreateResults.shift();
    if (forcedResult) return forcedResult;

    if (this.users.has(reservation.publicId)) return 'public_id_unavailable';
    if (this.recoveries.has(reservation.recovery.lookupHash)) return 'recovery_collision';

    this.users.set(reservation.publicId, 'user');
    this.recoveries.set(reservation.recovery.lookupHash, reservation.recovery);
    this.saveSession(reservation.publicId, reservation.session);
    return 'created';
  }

  async createSession(publicId: string, material: SessionMaterial): Promise<void> {
    this.saveSession(publicId, material);
  }

  async deleteAccount(publicId: string, _deletedAtMs?: number, adminActor?: string): Promise<void> {
    if (adminActor) {
      if (!this.users.has(publicId) || this.pages.has(publicId)) throw new ApiError(404, 'USER_NOT_FOUND', 'Account not found.');
      if (publicId === adminActor || this.users.get(publicId) === 'admin') throw new ApiError(403, 'ADMIN_PROTECTED', 'Administrator accounts cannot be deleted here.');
    }
    this.users.delete(publicId);
    for (const [pageId, page] of this.pages) if (page.ownerPublicId === publicId) { this.pages.delete(pageId); this.users.delete(pageId); }
    for (const [lookupHash, credential] of this.recoveries) {
      if (credential.publicId === publicId) this.recoveries.delete(lookupHash);
    }
    for (const [familyId, family] of this.families) {
      const belongsToUser = [...this.access.values()].some(
        (session) => session.familyId === familyId && session.publicId === publicId,
      );
      if (belongsToUser) family.revoked = true;
    }
  }

  async findActivePublicIdByAccessHash(
    accessHash: string,
    nowMs: number,
  ): Promise<ActiveAccount | null> {
    const session = this.access.get(accessHash);
    if (!session || session.accessExpiresAtMs <= nowMs) return null;
    if (this.families.get(session.familyId)?.revoked) return null;
    const role = this.users.get(session.publicId);
    return role ? { publicId: session.publicId, role } : null;
  }

  async findRecoveryCredential(lookupHash: string): Promise<RecoveryCredentialRecord | null> {
    return this.recoveries.get(lookupHash) ?? null;
  }

  async getAccountRole(publicId: string): Promise<AccountRole> {
    return this.users.get(publicId) ?? 'user';
  }

  async isUserActive(publicId: string): Promise<boolean> {
    return this.users.has(publicId);
  }

  async createPage(ownerPublicId: string, pagePublicId: string, displayName: string, bio: string): Promise<'created' | 'public_id_unavailable'> {
    if (this.users.has(pagePublicId)) return 'public_id_unavailable';
    this.users.set(pagePublicId, 'user');
    this.pages.set(pagePublicId, { ownerPublicId, displayName, bio });
    return 'created';
  }

  async listPages(ownerPublicId: string) {
    return [...this.pages].filter(([, page]) => page.ownerPublicId === ownerPublicId).map(([publicId, page]) => ({ publicId, displayName: page.displayName, bio: page.bio }));
  }

  async getPageOwner(pagePublicId: string) {
    return this.pages.get(pagePublicId)?.ownerPublicId ?? null;
  }

  async rotateRefresh(
    currentRefreshHash: string,
    next: SessionMaterial,
    rotatedAtMs: number,
  ): Promise<RotateRefreshResult> {
    const current = this.refresh.get(currentRefreshHash);
    if (!current) return 'not_found';

    const family = this.families.get(current.familyId);
    if (!family || family.revoked) return 'revoked';

    if (current.rotated) {
      family.revoked = true;
      return 'replayed';
    }

    if (current.refreshExpiresAtMs <= rotatedAtMs) return 'expired';

    current.rotated = true;
    this.access.set(next.accessHash, {
      ...next,
      familyId: current.familyId,
      publicId: current.publicId,
    });
    this.refresh.set(next.refreshHash, {
      ...next,
      familyId: current.familyId,
      publicId: current.publicId,
      rotated: false,
    });
    return 'rotated';
  }

  private saveSession(publicId: string, material: SessionMaterial): void {
    const familyId = `family-${this.familySequence++}`;
    this.families.set(familyId, { revoked: false });
    this.access.set(material.accessHash, { ...material, familyId, publicId });
    this.refresh.set(material.refreshHash, {
      ...material,
      familyId,
      publicId,
      rotated: false,
    });
  }
}

const PEPPER = 'test-only-recovery-pepper-that-is-long-enough';
const NOW = 1_789_473_600_000;

function expectApiError(code: string) {
  return (error: unknown): boolean => error instanceof ApiError && error.code === code;
}

describe('AuthService', () => {
  it('keeps administrator recovery available when ordinary login is closed', async () => {
    const store = new MemoryAuthStore();
    const service = new AuthService(store, PEPPER, () => NOW, async () => false);
    await assert.rejects(() => service.register(), expectApiError('LOGIN_UNAVAILABLE'));
    const issued = await service.register(undefined, true);
    await assert.rejects(() => service.restore(issued.recoveryId), expectApiError('LOGIN_UNAVAILABLE'));
    store.setRole(issued.user.publicId, 'admin');
    const restored = await service.restore(issued.recoveryId);
    assert.equal(restored.user.role, 'admin');
  });

  it('creates separate 50-character Public and Recovery IDs', async () => {
    const service = new AuthService(new MemoryAuthStore(), PEPPER, () => NOW);
    const result = await service.register();

    assert.equal(isValidG000stId(result.user.publicId), true);
    assert.equal(isValidG000stId(result.recoveryId), true);
    assert.notEqual(result.user.publicId, result.recoveryId);
    assert.ok(result.session.accessToken);
    assert.ok(result.session.refreshToken);
    assert.equal(result.session.expiresAt, NOW + 15 * 60 * 1_000);
  });

  it('rejects a duplicate requested Public ID', async () => {
    const store = new MemoryAuthStore();
    const service = new AuthService(store, PEPPER, () => NOW);
    const publicId = 'A'.repeat(50);

    await service.register(publicId);
    await assert.rejects(() => service.register(publicId), expectApiError('PUBLIC_ID_UNAVAILABLE'));
  });

  it('retries a Recovery ID collision without changing a requested Public ID', async () => {
    const publicId = 'B'.repeat(50);
    const service = new AuthService(new MemoryAuthStore(['recovery_collision']), PEPPER, () => NOW);
    const result = await service.register(publicId);

    assert.equal(result.user.publicId, publicId);
  });

  it('restores only with the private Recovery ID', async () => {
    const service = new AuthService(new MemoryAuthStore(), PEPPER, () => NOW);
    const registered = await service.register();
    const restored = await service.restore(registered.recoveryId);

    assert.equal(restored.user.publicId, registered.user.publicId);
    assert.notEqual(restored.session.refreshToken, registered.session.refreshToken);
    await assert.rejects(
      () => service.restore('Z'.repeat(50)),
      expectApiError('INVALID_RECOVERY_ID'),
    );
  });

  it('rotates refresh tokens and revokes the family when an old token is replayed', async () => {
    const service = new AuthService(new MemoryAuthStore(), PEPPER, () => NOW);
    const registered = await service.register();
    const next = await service.refresh(registered.session.refreshToken);

    assert.notEqual(next.refreshToken, registered.session.refreshToken);
    await assert.rejects(
      () => service.refresh(registered.session.refreshToken),
      expectApiError('SESSION_EXPIRED'),
    );
    await assert.rejects(
      () => service.getUser(next.accessToken),
      expectApiError('SESSION_EXPIRED'),
    );
  });

  it('authenticates a valid access token', async () => {
    const service = new AuthService(new MemoryAuthStore(), PEPPER, () => NOW);
    const registered = await service.register();
    const user = await service.getUser(registered.session.accessToken);

    assert.equal(user.publicId, registered.user.publicId);
    assert.equal(hashOpaqueToken(registered.session.accessToken).length, 64);
  });

  it('defaults new accounts to the user role and carries the stored role through auth', async () => {
    const store = new MemoryAuthStore();
    const service = new AuthService(store, PEPPER, () => NOW);
    const registered = await service.register();

    assert.equal(registered.user.role, 'user');

    const authenticated = await service.getUser(registered.session.accessToken);
    assert.equal(authenticated.role, 'user');

    const restored = await service.restore(registered.recoveryId);
    assert.equal(restored.user.role, 'user');
  });

  it('permanently disables a deleted account and all of its credentials', async () => {
    const store = new MemoryAuthStore();
    const service = new AuthService(store, PEPPER, () => NOW);
    const registered = await service.register();

    await service.deleteAccount(registered.session.accessToken);

    await assert.rejects(
      () => service.getUser(registered.session.accessToken),
      expectApiError('SESSION_EXPIRED'),
    );
    await assert.rejects(
      () => service.refresh(registered.session.refreshToken),
      expectApiError('SESSION_EXPIRED'),
    );
    await assert.rejects(
      () => service.restore(registered.recoveryId),
      expectApiError('INVALID_RECOVERY_ID'),
    );
  });

  it('allows an admin to delete a user and their pages, invalidating all credentials', async () => {
    const store = new MemoryAuthStore();
    const service = new AuthService(store, PEPPER, () => NOW);
    const admin = await service.register();
    store.setRole(admin.user.publicId, 'admin');
    const user = await service.register();
    const page = await service.createPage(user.session.accessToken);

    await service.deleteAccountByAdmin(admin.session.accessToken, user.user.publicId);

    await assert.rejects(() => service.getUser(user.session.accessToken), expectApiError('SESSION_EXPIRED'));
    await assert.rejects(() => service.refresh(user.session.refreshToken), expectApiError('SESSION_EXPIRED'));
    await assert.rejects(() => service.restore(user.recoveryId), expectApiError('INVALID_RECOVERY_ID'));
    assert.equal(await store.getPageOwner(page.publicId), null);
    assert.equal((await service.getUser(admin.session.accessToken)).role, 'admin');
  });

  it('rejects non-admin deletion, protected admins, pages and invalid target IDs', async () => {
    const store = new MemoryAuthStore();
    const service = new AuthService(store, PEPPER, () => NOW);
    const admin = await service.register();
    const otherAdmin = await service.register();
    const user = await service.register();
    store.setRole(admin.user.publicId, 'admin');
    store.setRole(otherAdmin.user.publicId, 'admin');
    const page = await service.createPage(user.session.accessToken);

    await assert.rejects(() => service.deleteAccountByAdmin(user.session.accessToken, admin.user.publicId), expectApiError('ADMIN_REQUIRED'));
    await assert.rejects(() => service.deleteAccountByAdmin('', user.user.publicId), expectApiError('UNAUTHENTICATED'));
    for (const target of [admin.user.publicId, otherAdmin.user.publicId]) {
      await assert.rejects(() => service.deleteAccountByAdmin(admin.session.accessToken, target), expectApiError('ADMIN_PROTECTED'));
    }
    await assert.rejects(() => service.deleteAccountByAdmin(admin.session.accessToken, page.publicId), expectApiError('USER_NOT_FOUND'));
    await assert.rejects(() => service.deleteAccountByAdmin(admin.session.accessToken, 'invalid'), expectApiError('VALIDATION_ERROR'));
    assert.equal((await service.getUser(user.session.accessToken)).publicId, user.user.publicId);
  });

  it('lets only the owner act as a page and never issues the page its own session', async () => {
    const service = new AuthService(new MemoryAuthStore(), PEPPER, () => NOW);
    const owner = await service.register();
    const stranger = await service.register();
    const page = await service.createPage(owner.session.accessToken);
    assert.equal(page.displayName, '');

    assert.equal(isValidG000stId(page.publicId), true);
    assert.notEqual(page.publicId, owner.user.publicId);
    assert.deepEqual(await service.listPages(owner.session.accessToken), [page]);
    assert.deepEqual(await service.listPages(stranger.session.accessToken), []);
    assert.equal((await service.getActor(owner.session.accessToken, page.publicId)).publicId, page.publicId);
    assert.equal((await service.getUser(owner.session.accessToken)).publicId, owner.user.publicId);
    await assert.rejects(() => service.getActor(stranger.session.accessToken, page.publicId), expectApiError('PAGE_ACCESS_DENIED'));
    await assert.rejects(() => service.restore(page.publicId), expectApiError('INVALID_RECOVERY_ID'));

    await service.deleteAccount(owner.session.accessToken);
    await assert.rejects(() => service.getActor(owner.session.accessToken, page.publicId), expectApiError('SESSION_EXPIRED'));
  });

  it('stores a beacon name and bio when the page is created', async () => {
    const service = new AuthService(new MemoryAuthStore(), PEPPER, () => NOW);
    const owner = await service.register();
    const page = await service.createPage(owner.session.accessToken, { displayName: '  My Beacon  ', bio: '  Hello  ' });

    assert.equal(page.displayName, 'My Beacon');
    assert.equal(page.bio, 'Hello');
    assert.deepEqual(await service.listPages(owner.session.accessToken), [page]);
  });
});
