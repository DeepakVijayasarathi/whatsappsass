/** Encryption removed — credentials stored as plaintext in the DB. */

export const DECRYPT_FAILED = "__DECRYPT_FAILED__";

export function encrypt(plaintext: string): string {
  return plaintext;
}

export function decryptNullable(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return value;
}

export function maskHint(plaintext: string | null | undefined): string | null {
  if (!plaintext) return null;
  const len = plaintext.length;
  if (len <= 6) return "••••••••";
  const show = Math.min(4, Math.floor(len / 4));
  return `${plaintext.slice(0, show)}${"•".repeat(8)}${plaintext.slice(-show)}`;
}
