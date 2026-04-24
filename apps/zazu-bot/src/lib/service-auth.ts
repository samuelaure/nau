import { verifyServiceToken, extractBearerToken, signServiceToken, AuthError } from '@nau/auth'
import type { Request, Response } from 'express'

const secret = () => process.env.AUTH_SECRET ?? ''

/**
 * Express middleware: validates an inbound service JWT.
 * Expects `Authorization: Bearer <jwt>` signed with AUTH_SECRET.
 */
export async function requireServiceAuth(req: Request, res: Response, next: () => void): Promise<void> {
  const token = extractBearerToken(req.headers['authorization'])
  if (!token) {
    res.status(401).json({ error: 'Missing service token' })
    return
  }
  try {
    await verifyServiceToken(token, secret())
    next()
  } catch (err) {
    const msg = err instanceof AuthError ? err.message : 'Invalid service token'
    res.status(401).json({ error: msg })
  }
}

/**
 * Signs a short-lived service JWT for outgoing requests to a target service.
 */
export async function buildServiceHeaders(target: string): Promise<Record<string, string>> {
  const token = await signServiceToken({ iss: 'zazu', aud: target, secret: secret() })
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}
