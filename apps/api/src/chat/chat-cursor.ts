import { ApiError } from '../http/api-error.js';
import type { ChatMessageCursor } from './chat-types.js';

const MESSAGE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function encodeChatCursor(cursor: ChatMessageCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeChatCursor(value: string | undefined): ChatMessageCursor | undefined {
  if (value === undefined) return undefined;

  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('createdAtMs' in parsed) ||
      !('id' in parsed) ||
      typeof parsed.createdAtMs !== 'number' ||
      !Number.isSafeInteger(parsed.createdAtMs) ||
      parsed.createdAtMs <= 0 ||
      typeof parsed.id !== 'string' ||
      !MESSAGE_ID_PATTERN.test(parsed.id)
    ) {
      throw new Error('Invalid cursor payload.');
    }

    return { createdAtMs: parsed.createdAtMs, id: parsed.id };
  } catch {
    throw new ApiError(400, 'INVALID_CURSOR', 'The message cursor is invalid.');
  }
}
