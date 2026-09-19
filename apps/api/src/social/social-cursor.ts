import { ApiError } from '../http/api-error.js';

export type SocialCursor = Readonly<{ createdAtMs: number; id: string }>;

export function encodeSocialCursor(cursor: SocialCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeSocialCursor(value?: string): SocialCursor | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !Number.isSafeInteger((parsed as SocialCursor).createdAtMs) ||
      typeof (parsed as SocialCursor).id !== 'string' ||
      !(parsed as SocialCursor).id
    ) {
      throw new Error('Invalid cursor');
    }
    return parsed as SocialCursor;
  } catch {
    throw new ApiError(400, 'INVALID_CURSOR', 'The pagination cursor is invalid.');
  }
}
