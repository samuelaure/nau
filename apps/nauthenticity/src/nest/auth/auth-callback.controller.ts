import { Controller, Get, Req, Res, HttpStatus } from '@nestjs/common'
import type { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../../config'

// This controller is excluded from the global `api/v1` prefix in main.ts
// so the SPA can reach /auth/callback, /auth/me, and /auth/logout directly.
@Controller('auth')
export class AuthCallbackController {
  // Verify nau_at using AUTH_SECRET (falls back to JWT_SECRET for older tokens)
  private verifyToken(token: string): jwt.JwtPayload {
    const secret = config.authSecret ?? config.jwtSecret
    const verified = jwt.verify(token, secret)
    if (typeof verified === 'string') throw new Error('string payload')
    return verified
  }

  private async tryRefresh(rt: string): Promise<{ at: string; setCookies: string[] } | null> {
    const nauApiUrl = process.env['NAU_API_URL'] ?? 'https://api.9nau.com'
    const cookieDomain = process.env['COOKIE_DOMAIN'] ?? '.9nau.com'
    const isSecure = process.env['NODE_ENV'] === 'production'
    try {
      const res = await fetch(`${nauApiUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: `nau_rt=${rt}` },
      })
      if (!res.ok) return null

      const setCookies: string[] = res.headers.getSetCookie?.() ?? []
      if (setCookies.length > 0) {
        const atHeader = setCookies.find((h) => h.startsWith('nau_at='))
        if (!atHeader) return null
        const at = atHeader.split(';')[0].split('=').slice(1).join('=')
        return { at, setCookies }
      }

      const data = (await res.json()) as { accessToken?: string; refreshToken?: string }
      if (!data.accessToken) return null

      const cookies = [
        `nau_at=${data.accessToken}; Path=/; Domain=${cookieDomain}; Max-Age=${24 * 60 * 60}; HttpOnly; SameSite=Lax${isSecure ? '; Secure' : ''}`,
      ]
      if (data.refreshToken) {
        cookies.push(
          `nau_rt=${data.refreshToken}; Path=/; Domain=${cookieDomain}; Max-Age=${30 * 24 * 60 * 60}; HttpOnly; SameSite=Strict${isSecure ? '; Secure' : ''}`,
        )
      }
      return { at: data.accessToken, setCookies: cookies }
    } catch {
      return null
    }
  }

  // SSO callback: accounts sets nau_at on .9nau.com and redirects here.
  // Reads the shared cookie — no token in URL needed.
  @Get('callback')
  async callback(@Req() req: Request, @Res() res: Response) {
    const at = req.cookies?.['nau_at'] as string | undefined

    if (!at) {
      const dashboardUrl = process.env['DASHBOARD_URL'] ?? 'https://nauthenticity.9nau.com'
      const accountsUrl = process.env['ACCOUNTS_URL'] ?? 'https://accounts.9nau.com'
      const callbackUrl = encodeURIComponent(`${dashboardUrl}/auth/callback`)
      return res.redirect(`${accountsUrl}/login?continue=${callbackUrl}`)
    }

    try {
      this.verifyToken(at)
    } catch {
      return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Invalid or expired token' })
    }

    return res.redirect('/')
  }

  // Session check for the SPA. Returns user info from nau_at.
  // Silently refreshes with nau_rt if nau_at is expired.
  @Get('me')
  async me(@Req() req: Request, @Res() res: Response) {
    const at = req.cookies?.['nau_at'] as string | undefined

    if (at) {
      try {
        const payload = this.verifyToken(at)
        return res.json({ id: payload['sub'], workspaceId: payload['workspaceId'] })
      } catch (err) {
        if (!(err instanceof jwt.TokenExpiredError)) {
          return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Invalid token' })
        }
      }
    }

    const rt = req.cookies?.['nau_rt'] as string | undefined
    if (!rt) return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Not authenticated' })

    const refreshed = await this.tryRefresh(rt)
    if (!refreshed) return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Session expired' })

    try {
      const payload = this.verifyToken(refreshed.at)
      refreshed.setCookies.forEach((c) => res.setHeader('Set-Cookie', c))
      return res.json({ id: payload['sub'], workspaceId: payload['workspaceId'] })
    } catch {
      return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Invalid refreshed token' })
    }
  }

  // Clears the shared .9nau.com session cookies and returns to the SPA root.
  @Get('logout')
  logout(@Res() res: Response) {
    const cookieDomain = process.env['COOKIE_DOMAIN'] ?? '.9nau.com'
    const isSecure = process.env['NODE_ENV'] === 'production'
    res.setHeader('Set-Cookie', [
      `nau_at=; Path=/; Domain=${cookieDomain}; Max-Age=0; HttpOnly; SameSite=Lax${isSecure ? '; Secure' : ''}`,
      `nau_rt=; Path=/; Domain=${cookieDomain}; Max-Age=0; HttpOnly; SameSite=Strict${isSecure ? '; Secure' : ''}`,
    ])
    return res.redirect('/')
  }
}
