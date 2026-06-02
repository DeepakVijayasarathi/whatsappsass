import { describe, it, expect, beforeAll } from "vitest";
import { encrypt, encryptNullable, decryptNullable, maskHint, DECRYPT_FAILED } from "./encrypt";

beforeAll(() => {
  process.env.ENCRYPTION_KEY = "test-encryption-key-for-vitest-only";
});

describe("encrypt / decryptNullable round-trip", () => {
  it("round-trips a value", () => {
    const ct = encrypt("super-secret-token");
    expect(ct).not.toBe("super-secret-token");
    expect(ct.startsWith("v1:")).toBe(true);
    expect(decryptNullable(ct)).toBe("super-secret-token");
  });

  it("produces a different ciphertext each call (random IV)", () => {
    expect(encrypt("same")).not.toBe(encrypt("same"));
  });

  it("round-trips unicode and long strings", () => {
    const v = "🔐 a-very-long-".repeat(50);
    expect(decryptNullable(encrypt(v))).toBe(v);
  });
});

describe("decryptNullable legacy + edge cases", () => {
  it("returns null for null/undefined/empty/whitespace", () => {
    expect(decryptNullable(null)).toBeNull();
    expect(decryptNullable(undefined)).toBeNull();
    expect(decryptNullable("")).toBeNull();
    expect(decryptNullable("   ")).toBeNull();
  });

  it("passes through legacy plaintext (no v1: prefix) unchanged", () => {
    expect(decryptNullable("legacy-plaintext-key")).toBe("legacy-plaintext-key");
  });

  it("returns DECRYPT_FAILED for a malformed v1: payload", () => {
    expect(decryptNullable("v1:notenough")).toBe(DECRYPT_FAILED);
  });

  it("returns DECRYPT_FAILED when the ciphertext is tampered (auth tag fails)", () => {
    const ct = encrypt("secret");
    const parts = ct.split(":");
    // flip the last hex char of the ciphertext
    const last = parts[3];
    parts[3] = last.slice(0, -1) + (last.slice(-1) === "0" ? "1" : "0");
    expect(decryptNullable(parts.join(":"))).toBe(DECRYPT_FAILED);
  });
});

describe("encryptNullable", () => {
  it("returns null for empty/whitespace and encrypts non-empty", () => {
    expect(encryptNullable("")).toBeNull();
    expect(encryptNullable("  ")).toBeNull();
    const ct = encryptNullable("x");
    expect(ct).not.toBeNull();
    expect(decryptNullable(ct)).toBe("x");
  });
});

describe("maskHint", () => {
  it("returns null for empty", () => {
    expect(maskHint(null)).toBeNull();
    expect(maskHint("")).toBeNull();
  });

  it("fully masks short values", () => {
    expect(maskHint("abc")).toBe("••••••••");
  });

  it("shows a prefix/suffix hint for long values", () => {
    const hint = maskHint("abcdefghijklmnop");
    expect(hint).toContain("•");
    expect(hint?.startsWith("a")).toBe(true);
    expect(hint?.endsWith("p")).toBe(true);
    expect(hint).not.toContain("defghij"); // middle is hidden
  });
});
