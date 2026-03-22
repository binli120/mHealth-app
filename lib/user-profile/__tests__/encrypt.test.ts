/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { decryptField, encryptField } from "@/lib/user-profile/encrypt"

// A valid 64-character hex key (32 bytes of zeros — test use only)
const TEST_KEY_HEX = "0".repeat(64)

describe("lib/user-profile/encrypt", () => {
  beforeEach(() => {
    vi.stubEnv("PROFILE_ENCRYPTION_KEY", TEST_KEY_HEX)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  // ── encryptField ────────────────────────────────────────────────────────────

  describe("encryptField", () => {
    it("returns a colon-delimited string with three segments (iv:tag:ciphertext)", () => {
      const result = encryptField("hello")
      const parts = result.split(":")
      expect(parts).toHaveLength(3)
      expect(parts[0]).toBeTruthy() // iv
      expect(parts[1]).toBeTruthy() // auth tag
      expect(parts[2]).toBeTruthy() // ciphertext
    })

    it("iv segment is 24 hex characters (12 bytes)", () => {
      const [ivHex] = encryptField("hello").split(":")
      expect(ivHex).toHaveLength(24)
      expect(/^[0-9a-f]+$/i.test(ivHex)).toBe(true)
    })

    it("auth tag segment is 32 hex characters (16 bytes)", () => {
      const [, tagHex] = encryptField("hello").split(":")
      expect(tagHex).toHaveLength(32)
      expect(/^[0-9a-f]+$/i.test(tagHex)).toBe(true)
    })

    it("produces different ciphertexts for the same plaintext (random IV)", () => {
      const first = encryptField("same-value")
      const second = encryptField("same-value")
      expect(first).not.toBe(second)
    })

    it("encrypts an empty string without throwing", () => {
      expect(() => encryptField("")).not.toThrow()
    })

    it("empty-string encryption produces an empty ciphertext segment (AES-GCM zero-length plaintext)", () => {
      // AES-GCM with empty plaintext produces no ciphertext bytes, so the
      // third colon-segment is "". decryptField guards against this with
      // !cipherHex — document here that the round-trip is not supported.
      const stored = encryptField("")
      expect(() => decryptField(stored)).toThrow("Invalid encrypted field format")
    })

    it("encrypts a long string without throwing", () => {
      const long = "a".repeat(10_000)
      expect(() => encryptField(long)).not.toThrow()
    })

    it("encrypts a string with unicode characters", () => {
      expect(() => encryptField("名前: 山田 太郎")).not.toThrow()
    })

    it("throws when PROFILE_ENCRYPTION_KEY is not set", () => {
      vi.unstubAllEnvs()
      delete process.env.PROFILE_ENCRYPTION_KEY
      expect(() => encryptField("test")).toThrow("PROFILE_ENCRYPTION_KEY")
    })

    it("throws when the key is wrong length (not 32 bytes)", () => {
      vi.stubEnv("PROFILE_ENCRYPTION_KEY", "dGVzdA==") // base64("test") = 4 bytes
      expect(() => encryptField("test")).toThrow(/32 bytes/)
    })
  })

  // ── decryptField ────────────────────────────────────────────────────────────

  describe("decryptField", () => {
    it("round-trips a simple ASCII string", () => {
      const plain = "routing123"
      expect(decryptField(encryptField(plain))).toBe(plain)
    })

    it("round-trips an account number string", () => {
      const plain = "9876543210"
      expect(decryptField(encryptField(plain))).toBe(plain)
    })

    it("round-trips a unicode string", () => {
      const plain = "名前: 山田 太郎"
      expect(decryptField(encryptField(plain))).toBe(plain)
    })

    it("round-trips a string with special characters", () => {
      const plain = "!@#$%^&*()_+-=[]{}|;':\",./<>?"
      expect(decryptField(encryptField(plain))).toBe(plain)
    })

    it("throws on an empty stored value", () => {
      expect(() => decryptField("")).toThrow()
    })

    it("throws when only two segments are present (missing ciphertext)", () => {
      expect(() => decryptField("aabbcc:ddeeff")).toThrow()
    })

    it("throws when the ciphertext has been tampered with (auth tag mismatch)", () => {
      const encrypted = encryptField("original")
      const parts = encrypted.split(":")
      // Flip the last byte of the ciphertext
      parts[2] = parts[2].slice(0, -2) + (parts[2].endsWith("ff") ? "00" : "ff")
      expect(() => decryptField(parts.join(":"))).toThrow()
    })

    it("throws when the auth tag has been tampered with", () => {
      const encrypted = encryptField("original")
      const parts = encrypted.split(":")
      // Flip the last byte of the auth tag
      parts[1] = parts[1].slice(0, -2) + (parts[1].endsWith("ff") ? "00" : "ff")
      expect(() => decryptField(parts.join(":"))).toThrow()
    })

    it("throws when PROFILE_ENCRYPTION_KEY is not set", () => {
      const encrypted = encryptField("test")
      vi.unstubAllEnvs()
      delete process.env.PROFILE_ENCRYPTION_KEY
      expect(() => decryptField(encrypted)).toThrow("PROFILE_ENCRYPTION_KEY")
    })
  })

  // ── Key format acceptance ───────────────────────────────────────────────────

  describe("key format", () => {
    it("accepts a 44-character base64 key (32 bytes)", () => {
      // 32 bytes of zeros encoded as base64 = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
      const base64Key = Buffer.alloc(32).toString("base64")
      vi.stubEnv("PROFILE_ENCRYPTION_KEY", base64Key)
      const plain = "bank-account-test"
      expect(decryptField(encryptField(plain))).toBe(plain)
    })

    it("accepts a 64-character hex key (32 bytes)", () => {
      vi.stubEnv("PROFILE_ENCRYPTION_KEY", "a".repeat(64))
      const plain = "routing-number-test"
      expect(decryptField(encryptField(plain))).toBe(plain)
    })
  })
})
