import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { AuthService } from '../src/auth/auth-service.js';
import type {
  AccountReservation,
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
  private readonly users = new Set<string>();

  constructor(private readonly forcedCreateResults: ReserveAccountResult[] = []) {}

  async createAccount(reservation: AccountReservation): Promise<ReserveAccountResult> {
    const forcedResult = this.forcedCreateResults.shift();
    if (forcedResult) return forcedResult;

    if (this.users.has(reservation.publicId)) return 'public_id_unavailable';
    if (this.recoveries.has(reservation.recovery.lookupHash)) return 'recovery_collision';

    this.users.add(reservation.publicId);
    this.recoveries.set(reservation.recovery.lookupHash, reservation.recovery);
    this.saveSession(reservation.publicId, reservation.session);
    return 'created';
  }

  async createSession(publicId: string, material: SessionMaterial): Promise<void> {
    this.saveSession(publicId, material);
  }

  async findActivePublicIdByAccessHash(
    accessHash: string,
    nowMs: number,
  ): Promise<string | null> {
    const session = this.access.get(accessHash);
    if (!session || session.accessExpiresAtMs <= nowMs) return null;
    if (this.families.get(session.familyId)?.revoked) return null;
    return this.users.has(session.publicId) ? session.publicId : null;
  }

  async findRecoveryCredential(lookupHash: string): Promise<RecoveryCredentialRecord | null> {
    return this.recoveries.get(lookupHash) ?? null;
  }

  async isUserActive(publicId: string): Promise<boolean> {
    return this.users.has(publicId);
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
});
