import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import type { AccessTokenPayload, ServiceTokenPayload } from '@nau/types'

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: 'EXPIRED' | 'INVALID' | 'MISSING',
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

function getSecret(secret: string): Uint8Array {
  return new TextEncoder().encode(secret)
}

export async function verifyAccessToken(token: string, secret: string): Promise<AccessTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, getSecret(secret))
    return payload as unknown as AccessTokenPayload
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('expired')) {
      throw new AuthError('Access token expired', 'EXPIRED')
    }
    throw new AuthError('Invalid access token', 'INVALID')
  }
}

export async function verifyServiceToken(token: string, secret: string): Promise<ServiceTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, getSecret(secret))
    return payload as unknown as ServiceTokenPayload
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('expired')) {
      throw new AuthError('Service token expired', 'EXPIRED')
    }
    throw new AuthError('Invalid service token', 'INVALID')
  }
}

export interface SignServiceTokenOptions {
  secret: string
  iss: string
  aud: string
  ttlSeconds?: number
}

export async function signServiceToken(options: SignServiceTokenOptions): Promise<string> {
  const { secret, iss, aud, ttlSeconds = 60 } = options
  return new SignJWT({ iss, aud } as JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(getSecret(secret))
}

export function extractBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader?.startsWith('Bearer ')) return null
  return authorizationHeader.slice(7)
}

export function generateCsrfToken(): string {
  const array = new Uint8Array(32)
  if (typeof globalThis.crypto !== 'undefined') {
    globalThis.crypto.getRandomValues(array)
  } else {
    // Node.js < 19 fallback
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { randomFillSync } = require('crypto') as typeof import('crypto')
    randomFillSync(array)
  }
  return Buffer.from(array).toString('hex')
}

export function verifyCsrfToken(cookieToken: string | undefined, headerToken: string | undefined): boolean {
  if (!cookieToken || !headerToken) return false
  return cookieToken === headerToken
}
