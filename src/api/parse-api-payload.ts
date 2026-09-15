import type { z } from 'zod';

import { ApiError } from '@/api/api-error';

export function parseApiPayload<T>(schema: z.ZodType<T>, payload: unknown): T {
  const result = schema.safeParse(payload);

  if (!result.success) {
    // Auth payloads can contain the private Recovery ID and session tokens, so
    // neither the payload nor Zod's detailed issues should be logged here.
    throw new ApiError('g000st returned an unexpected response. Please try again.', {
      code: 'INVALID_API_RESPONSE',
    });
  }

  return result.data;
}
