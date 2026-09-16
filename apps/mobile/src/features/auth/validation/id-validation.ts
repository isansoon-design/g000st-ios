import { z } from 'zod';

import { G000ST_ID_LENGTH } from '@/domain/identity/constants';

export type IdGateField = 'recoveryId';
export type IdGateErrors = Partial<Record<IdGateField, string>>;

const exactIdSchema = z
  .string()
  .length(G000ST_ID_LENGTH, `ID must be exactly ${G000ST_ID_LENGTH} characters.`)
  .regex(/^[A-Za-z0-9]+$/, 'ID can contain letters and numbers only.');

export function normalizeId(value: string): string {
  return value.replace(/\s+/g, '').replace(/[\u200B-\u200D\uFEFF]/g, '');
}

export function validateRecoveryId(value: string): IdGateErrors {
  const normalized = normalizeId(value);
  if (!normalized) return { recoveryId: 'Paste your Recovery ID.' };

  const result = exactIdSchema.safeParse(normalized);
  return result.success ? {} : { recoveryId: result.error.issues[0]?.message };
}

export function firstValidationMessage(
  errors: IdGateErrors,
  fieldOrder: readonly IdGateField[],
): string | null {
  const firstField = fieldOrder.find((field) => errors[field]);
  return firstField ? errors[firstField] ?? null : null;
}
