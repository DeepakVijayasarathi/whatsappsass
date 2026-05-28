import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer | null {
  const raw = process.env.ENCRYPTION_KEY?.trim();
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      // In production, missing key is a hard failure — plaintext credentials are unacceptable.
      throw new Error(
        "FATAL: ENCRYPTION_KEY is not set. Refusing to start in production without encryption. " +
        "Generate a key with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\" " +
        "and set it as the ENCRYPTION_KEY environment variable."
      );
    }
    // Development: warn once, then proceed with plaintext fallback
    if (!globalThis.__encryptKeyWarned) {
      console.warn("[encrypt] ENCRYPTION_KEY not set — credentials stored as PLAINTEXT. Set this variable before deploying to production.");
      (globalThis as Record<string, unknown>).__encryptKeyWarned = true;
    }
    return null;
  }
  // Accept 64-char hex (32 bytes) or 44-char base64 (32 bytes)
  const buf = Buffer.from(raw, raw.length === 64 ? "hex" : "base64");
  if (buf.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be exactly 32 bytes (64 hex chars or 44 base64 chars). Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
  }
  return buf;
}

const ENCRYPTED_PREFIX = "enc:v1:";

/** Encrypt a plaintext string. Returns the ciphertext string or the original if no key is configured. */
export function encrypt(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext; // no key — store as-is (dev mode or unconfigured)

  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Prefix allows recognising encrypted values vs legacy plaintext
  return ENCRYPTED_PREFIX + [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}

/** Decrypt a ciphertext produced by encrypt(). If the value is not in encrypted format,
 *  returns it unchanged (backward-compatible with legacy plaintext values). */
export function decrypt(value: string): string {
  if (!value.startsWith(ENCRYPTED_PREFIX)) {
    // Legacy plaintext — return as-is (graceful migration)
    return value;
  }
  const key = getKey();
  if (!key) {
    // No key in dev — can't decrypt encrypted values. Log and return null via caller.
    throw new Error("[encrypt] Cannot decrypt: ENCRYPTION_KEY is not set");
  }
  const inner = value.slice(ENCRYPTED_PREFIX.length);
  const parts = inner.split(".");
  if (parts.length !== 3) throw new Error("Invalid encrypted value format");
  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/** Safe decrypt: returns null if value is null/undefined/empty.
 *  Logs a warning but never throws — callers treat null as "not configured". */
export function decryptNullable(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    return decrypt(value);
  } catch (err) {
    // Log with enough context for debugging but don't expose the raw value
    console.warn("[encrypt] Decryption failed (value may be corrupted or from a different key):", (err as Error).message);
    return null;
  }
}

/** Return a masked hint of the plaintext value for display: "EAAx••••••••abc1".
 *  Always operates on the DECRYPTED value. Call decryptNullable() first. */
export function maskHint(plaintext: string | null | undefined): string | null {
  if (!plaintext) return null;
  const len = plaintext.length;
  if (len <= 6) return "••••••••"; // too short to show safely
  const show = Math.min(4, Math.floor(len / 4));
  return `${plaintext.slice(0, show)}${"•".repeat(8)}${plaintext.slice(-show)}`;
}
