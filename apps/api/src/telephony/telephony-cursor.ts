import { ApiError } from '../http/api-error.js';

export type TelephonyCursor = Readonly<{ createdAtMs: number; id: string }>;

export function encodeTelephonyCursor(cursor: TelephonyCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeTelephonyCursor(value?: string): TelephonyCursor | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !Number.isSafeInteger((parsed as TelephonyCursor).createdAtMs) ||
      typeof (parsed as TelephonyCursor).id !== 'string' ||
      !(parsed as TelephonyCursor).id
    ) {
      throw new Error('Invalid cursor');
    }
    return parsed as TelephonyCursor;
  } catch {
    throw new ApiError(400, 'INVALID_CURSOR', 'The pagination cursor is invalid.');
  }
}
