export type AccountRole = 'admin' | 'user';

export type ActiveAccount = Readonly<{
  publicId: string;
  role: AccountRole;
}>;

export type RecoveryCredentialRecord = Readonly<{
  publicId: string;
  salt: string;
  verifier: string;
}>;

export type SessionMaterial = Readonly<{
  accessExpiresAtMs: number;
  accessHash: string;
  refreshExpiresAtMs: number;
  refreshHash: string;
}>;

export type AccountReservation = Readonly<{
  createdAtMs: number;
  publicId: string;
  recovery: RecoveryCredentialRecord & Readonly<{ lookupHash: string }>;
  session: SessionMaterial;
}>;

export type ReserveAccountResult = 'created' | 'public_id_unavailable' | 'recovery_collision';
export type RotateRefreshResult =
  | 'rotated'
  | 'not_found'
  | 'expired'
  | 'revoked'
  | 'replayed';

export interface AuthStore {
  createPage?(ownerPublicId: string, pagePublicId: string, displayName: string, bio: string, createdAtMs: number): Promise<'created' | 'public_id_unavailable'>;
  listPages?(ownerPublicId: string): Promise<readonly Readonly<{ publicId: string; displayName: string; bio: string }>[]>;
  getPageOwner?(pagePublicId: string): Promise<string | null>;
  getPageDisplayName?(pagePublicId: string): Promise<string>;
  createAccount(reservation: AccountReservation): Promise<ReserveAccountResult>;
  createSession(publicId: string, material: SessionMaterial, createdAtMs: number): Promise<void>;
  deleteAccount(publicId: string, deletedAtMs: number, adminActor?: string): Promise<void>;
  findActivePublicIdByAccessHash(accessHash: string, nowMs: number): Promise<ActiveAccount | null>;
  findRecoveryCredential(lookupHash: string): Promise<RecoveryCredentialRecord | null>;
  getAccountRole(publicId: string): Promise<AccountRole>;
  isUserActive(publicId: string): Promise<boolean>;
  rotateRefresh(
    currentRefreshHash: string,
    next: SessionMaterial,
    rotatedAtMs: number,
  ): Promise<RotateRefreshResult>;
}
