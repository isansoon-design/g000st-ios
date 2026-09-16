const G000ST_ID_LENGTH = 50;
const G000ST_ID_PATTERN = /^[A-Za-z0-9]+$/;

export type IdGateField = "recoveryId";
export type IdGateErrors = Partial<Record<IdGateField, string>>;

export function normalizeId(value: string): string {
  return value.replace(/\s+/g, "").replace(/[\u200B-\u200D\uFEFF]/g, "");
}

function validateExactId(value: string): string | null {
  if (value.length !== G000ST_ID_LENGTH) {
    return `ID must be exactly ${G000ST_ID_LENGTH} characters.`;
  }

  if (!G000ST_ID_PATTERN.test(value)) {
    return "ID can contain letters and numbers only.";
  }

  return null;
}

export function validateRecoveryId(value: string): IdGateErrors {
  const normalized = normalizeId(value);
  if (!normalized) return { recoveryId: "Paste your Recovery ID." };

  const message = validateExactId(normalized);
  return message ? { recoveryId: message } : {};
}

export function firstValidationMessage(
  errors: IdGateErrors,
  fieldOrder: readonly IdGateField[],
): string | null {
  const firstField = fieldOrder.find((field) => errors[field]);
  return firstField ? errors[firstField] ?? null : null;
}
