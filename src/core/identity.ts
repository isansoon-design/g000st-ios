import { randomBytes } from 'node:crypto';

export const G000ST_ID_LENGTH = 50;
export const G000ST_ID_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

const MAX_UNBIASED_BYTE = 256 - (256 % G000ST_ID_ALPHABET.length);

export function isValidG000stId(value: string): boolean {
  return (
    value.length === G000ST_ID_LENGTH &&
    [...value].every((character) => G000ST_ID_ALPHABET.includes(character))
  );
}

export function generateG000stId(): string {
  let result = '';

  while (result.length < G000ST_ID_LENGTH) {
    const bytes = randomBytes(G000ST_ID_LENGTH);

    for (const byte of bytes) {
      if (byte >= MAX_UNBIASED_BYTE) continue;
      result += G000ST_ID_ALPHABET[byte % G000ST_ID_ALPHABET.length];
      if (result.length === G000ST_ID_LENGTH) break;
    }
  }

  return result;
}
