import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { verifyAccessToken, extractBearerToken, AuthError, COOKIE_ACCESS_TOKEN } from '@nau/auth'
import type { AccessTokenPayload } from '@nau/types'

@Injectable()
export class AnyAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      cookies?: Record<string, string>
      headers: Record<string, string | undefined>
      user?: AccessTokenPayload
    }>()

    // Service-to-service: accept NAU_SERVICE_KEY header
    const serviceKey = req.headers['x-nau-service-key']
    if (serviceKey && serviceKey === this.config.get<string>('NAU_SERVICE_KEY')) {
      return true
    }

    // User-facing: accept JWT from cookie or Bearer header
    const cookieToken = req.cookies?.[COOKIE_ACCESS_TOKEN]
    const bearerToken = extractBearerToken(req.headers['authorization'])
    const token = cookieToken ?? bearerToken
    if (!token) throw new UnauthorizedException('Missing access token')

    try {
      req.user = await verifyAccessToken(token, this.config.getOrThrow<string>('AUTH_SECRET'))
      return true
    } catch (err) {
      if (err instanceof AuthError) throw new UnauthorizedException('Invalid token')
      throw new UnauthorizedException('Invalid token')
    }
  }
}
