import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto'
// Imported explicitly rather than relying on Nitro's auto-import, so this
// security-critical module can be unit tested outside the server runtime.
import { createError } from 'h3'

/**
 * Authenticated encryption for third-party OAuth tokens at rest.
 *
 * Strava tokens grant access to someone's account, so they must not sit in the
 * database as plaintext — a leaked dump would otherwise be enough to read every
 * connected athlete's data. AES-256-GCM also detects tampering, so a modified
 * ciphertext fails loudly instead of decrypting to garbage.
 *
 * Format: `v1.<iv-base64url>.<authTag-base64url>.<ciphertext-base64url>`
 * The version prefix leaves room to rotate the scheme later.
 */

const VERSION = 'v1'
const IV_BYTES = 12 // GCM standard nonce length

function key(): Buffer {
  const secret = process.env.NUXT_TOKEN_ENCRYPTION_KEY
  if (!secret || secret.length < 32) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Encryption key missing',
      message:
        'NUXT_TOKEN_ENCRYPTION_KEY fehlt oder ist zu kurz (mind. 32 Zeichen). '
        + 'Ohne diesen Schlüssel werden keine Strava-Tokens gespeichert.'
    })
  }
  // Hash to exactly 32 bytes so any sufficiently long passphrase works.
  return createHash('sha256').update(secret).digest()
}

const b64 = (b: Buffer) => b.toString('base64url')

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return [VERSION, b64(iv), b64(cipher.getAuthTag()), b64(ciphertext)].join('.')
}

export function decryptToken(payload: string): string {
  const [version, ivPart, tagPart, dataPart] = payload.split('.')
  if (version !== VERSION || !ivPart || !tagPart || !dataPart) {
    throw createError({ statusCode: 500, statusMessage: 'Token-Format nicht lesbar' })
  }

  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivPart, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'))

  try {
    return Buffer.concat([
      decipher.update(Buffer.from(dataPart, 'base64url')),
      decipher.final()
    ]).toString('utf8')
  } catch {
    // Wrong key or tampered payload — never fall back to returning raw bytes.
    throw createError({
      statusCode: 500,
      statusMessage: 'Token decryption failed',
      message: 'Token konnte nicht entschlüsselt werden. Wurde der Schlüssel geändert?'
    })
  }
}

/** True when a usable encryption key is configured, without throwing. */
export function hasEncryptionKey(): boolean {
  const secret = process.env.NUXT_TOKEN_ENCRYPTION_KEY
  return Boolean(secret && secret.length >= 32)
}
