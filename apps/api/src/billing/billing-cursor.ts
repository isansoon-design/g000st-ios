import { ApiError } from '../http/api-error.js';

export type BillingCursor = Readonly<{ createdAtMs: number; id: string }>;

export function encodeBillingCursor(cursor: BillingCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeBillingCursor(value?: string): BillingCursor | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !Number.isSafeInteger((parsed as BillingCursor).createdAtMs) ||
      typeof (parsed as BillingCursor).id !== 'string' ||
      !(parsed as BillingCursor).id
    ) {
      throw new Error('Invalid cursor');
    }
    return parsed as BillingCursor;
  } catch {
    throw new ApiError(400, 'INVALID_CURSOR', 'The pagination cursor is invalid.');
  }
}
