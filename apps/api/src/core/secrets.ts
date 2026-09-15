import {
  createHash,
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const RECOVERY_KEY_LENGTH = 64;

export type RecoveryVerifier = Readonly<{
  salt: string;
  verifier: string;
}>;

export function createOpaqueToken(byteLength: number): string {
  return randomBytes(byteLength).toString('base64url');
}

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function recoveryLookupHash(recoveryId: string, pepper: string): string {
  return createHmac('sha256', pepper).update(recoveryId, 'utf8').digest('hex');
}

export async function createRecoveryVerifier(recoveryId: string): Promise<RecoveryVerifier> {
  const salt = randomBytes(16);
  const derived = (await scrypt(recoveryId, salt, RECOVERY_KEY_LENGTH)) as Buffer;

  return {
    salt: salt.toString('base64url'),
    verifier: derived.toString('base64url'),
  };
}

export async function verifyRecoveryId(
  recoveryId: string,
  stored: RecoveryVerifier,
): Promise<boolean> {
  try {
    const salt = Buffer.from(stored.salt, 'base64url');
    const expected = Buffer.from(stored.verifier, 'base64url');
    const actual = (await scrypt(recoveryId, salt, expected.length)) as Buffer;

    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
