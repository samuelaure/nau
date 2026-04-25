import { Controller, Get, Query, Res, HttpStatus } from '@nestjs/common'
import type { Response } from 'express'
import { verifyJwt } from '../../utils/jwt'

// This controller is excluded from the global `api/v1` prefix in main.ts
// so the SPA can reach /auth/callback and /auth/complete directly.
@Controller('auth')
export class AuthCallbackController {
  @Get('callback')
  callback(@Query('token') token: string, @Res() res: Response) {
    if (!token) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Missing token parameter' })
    }

    const payload = verifyJwt(token)
    if (!payload) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Invalid or expired token' })
    }

    const maxAge = 7 * 24 * 60 * 60
    res.setHeader(
      'Set-Cookie',
      `nau_token=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`,
    )
    return res.redirect(`/auth/complete?token=${encodeURIComponent(token)}`)
  }
}
