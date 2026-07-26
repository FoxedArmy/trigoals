import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { encryptToken, decryptToken, hasEncryptionKey } from '../server/utils/crypto'

const KEY = 'a'.repeat(64)
const OTHER_KEY = 'b'.repeat(64)

describe('token encryption', () => {
  const original = process.env.NUXT_TOKEN_ENCRYPTION_KEY

  beforeEach(() => {
    process.env.NUXT_TOKEN_ENCRYPTION_KEY = KEY
  })
  afterEach(() => {
    if (original === undefined) delete process.env.NUXT_TOKEN_ENCRYPTION_KEY
    else process.env.NUXT_TOKEN_ENCRYPTION_KEY = original
  })

  it('round-trips a token', () => {
    const token = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0'
    expect(decryptToken(encryptToken(token))).toBe(token)
  })

  it('never stores the plaintext', () => {
    const token = 'super-secret-strava-token'
    expect(encryptToken(token)).not.toContain(token)
  })

  it('produces a different ciphertext each time (random IV)', () => {
    const a = encryptToken('same-input')
    const b = encryptToken('same-input')
    expect(a).not.toBe(b)
    // …but both still decrypt back to the same value.
    expect(decryptToken(a)).toBe(decryptToken(b))
  })

  it('carries a version prefix', () => {
    expect(encryptToken('x').startsWith('v1.')).toBe(true)
  })

  it('rejects a tampered ciphertext instead of returning garbage', () => {
    const payload = encryptToken('original-token')
    const parts = payload.split('.')
    // Flip a character in the ciphertext segment.
    const data = parts[3]!
    parts[3] = (data[0] === 'A' ? 'B' : 'A') + data.slice(1)
    expect(() => decryptToken(parts.join('.'))).toThrow()
  })

  it('rejects a tampered auth tag', () => {
    const parts = encryptToken('original-token').split('.')
    const tag = parts[2]!
    parts[2] = (tag[0] === 'A' ? 'B' : 'A') + tag.slice(1)
    expect(() => decryptToken(parts.join('.'))).toThrow()
  })

  it('cannot be decrypted with a different key', () => {
    const payload = encryptToken('original-token')
    process.env.NUXT_TOKEN_ENCRYPTION_KEY = OTHER_KEY
    expect(() => decryptToken(payload)).toThrow()
  })

  it('rejects malformed payloads', () => {
    expect(() => decryptToken('not-a-payload')).toThrow()
    expect(() => decryptToken('v1.only.two')).toThrow()
    expect(() => decryptToken('v2.a.b.c')).toThrow()
  })

  it('refuses to encrypt without a key', () => {
    delete process.env.NUXT_TOKEN_ENCRYPTION_KEY
    expect(hasEncryptionKey()).toBe(false)
    expect(() => encryptToken('x')).toThrow()
  })

  it('refuses a key that is too short', () => {
    process.env.NUXT_TOKEN_ENCRYPTION_KEY = 'tooshort'
    expect(hasEncryptionKey()).toBe(false)
    expect(() => encryptToken('x')).toThrow()
  })

  it('handles unicode and long values', () => {
    const weird = 'Grüße 🚴‍♂️ ' + 'x'.repeat(2000)
    expect(decryptToken(encryptToken(weird))).toBe(weird)
  })
})
