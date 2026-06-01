/**
 * Authenticated encryption (AES-256-GCM) for provider credentials at rest.
 *
 * Encrypted values are stored as `v1:<iv_hex>:<tag_hex>:<ciphertext_hex>`.
 * The `v1:` prefix lets decryptNullable distinguish encrypted values from
 * legacy plaintext that predates this change — legacy values are returned
 * as-is so existing rows keep working without a backfill migration. They
 * become encrypted the next time their owning record is saved.
 *
 * The key is derived from ENCRYPTION_KEY via SHA-256 (any-length secret → 32 bytes).
 * If ENCRYPTION_KEY is unset we fall back to JWT_SECRET so a single-secret
 * deployment still encrypts; production should set a dedicated ENCRYPTION_KEY.
 */
import crypto from "crypto";

export const DECRYPT_FAILED = "__DECRYPT_FAILED__";

const PREFIX = "v1:";

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) {
    // Mirrors server.ts behaviour: refuse to operate without a secret.
    throw new Error("ENCRYPTION_KEY (or JWT_SECRET) must be set to encrypt credentials.");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

/** Encrypt only when there's a non-empty value; pass through null/empty. */
export function encryptNullable(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return encrypt(value);
}

export function decryptNullable(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;

  // Legacy plaintext (written before encryption was restored) — return as-is.
  if (!value.startsWith(PREFIX)) return value;

  try {
    const [, ivHex, tagHex, dataHex] = value.split(":");
    if (!ivHex || !tagHex || !dataHex) return DECRYPT_FAILED;
    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    return DECRYPT_FAILED;
  }
}

export function maskHint(plaintext: string | null | undefined): string | null {
  if (!plaintext) return null;
  const len = plaintext.length;
  if (len <= 6) return "••••••••";
  const show = Math.min(4, Math.floor(len / 4));
  return `${plaintext.slice(0, show)}${"•".repeat(8)}${plaintext.slice(-show)}`;
}
