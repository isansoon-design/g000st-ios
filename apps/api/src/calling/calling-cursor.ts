import { ApiError } from '../http/api-error.js';

export type CallingCursor = Readonly<{ createdAtMs: number; id: string }>;

export function encodeCallingCursor(cursor: CallingCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeCallingCursor(value?: string): CallingCursor | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !Number.isSafeInteger((parsed as CallingCursor).createdAtMs) ||
      typeof (parsed as CallingCursor).id !== 'string' ||
      !(parsed as CallingCursor).id
    ) {
      throw new Error('Invalid cursor');
    }
    return parsed as CallingCursor;
  } catch {
    throw new ApiError(400, 'INVALID_CURSOR', 'The pagination cursor is invalid.');
  }
}
