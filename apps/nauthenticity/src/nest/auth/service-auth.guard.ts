import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { verifyServiceToken, extractBearerToken, AuthError } from '@nau/auth'
import type { ServiceTokenPayload } from '@nau/types'

@Injectable()
export class ServiceAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>
      serviceClient?: ServiceTokenPayload
    }>()

    const token = extractBearerToken(req.headers['authorization'])
    if (!token) throw new UnauthorizedException('Missing service token')

    try {
      req.serviceClient = await verifyServiceToken(token, this.config.getOrThrow<string>('AUTH_SECRET'))
      return true
    } catch (err) {
      if (err instanceof AuthError) throw new UnauthorizedException(err.message)
      throw new UnauthorizedException('Invalid service token')
    }
  }
}
