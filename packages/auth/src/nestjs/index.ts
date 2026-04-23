import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common'
import { verifyAccessToken, verifyServiceToken, extractBearerToken, AuthError } from '../core'
import { COOKIE_ACCESS_TOKEN } from '../cookies'
import type { AccessTokenPayload, ServiceTokenPayload } from '@nau/types'

export const NAU_AUTH_SECRET = 'NAU_AUTH_SECRET'

function getSecret(): string {
  const secret = process.env['AUTH_SECRET']
  if (!secret) throw new Error('AUTH_SECRET is not configured')
  return secret
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ cookies?: Record<string, string>; headers: Record<string, string | undefined>; user?: AccessTokenPayload }>()

    const cookieToken: string | undefined = (req.cookies as Record<string, string>)?.[COOKIE_ACCESS_TOKEN]
    const bearerToken = extractBearerToken(req.headers['authorization'])
    const token = cookieToken ?? bearerToken

    if (!token) throw new UnauthorizedException('Missing access token')

    try {
      req.user = await verifyAccessToken(token, getSecret())
      return true
    } catch (err) {
      if (err instanceof AuthError) {
        throw new UnauthorizedException(err.message)
      }
      throw new UnauthorizedException('Invalid token')
    }
  }
}

@Injectable()
export class ServiceAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; serviceClient?: ServiceTokenPayload }>()
    const bearerToken = extractBearerToken(req.headers['authorization'])

    if (!bearerToken) throw new UnauthorizedException('Missing service token')

    try {
      req.serviceClient = await verifyServiceToken(bearerToken, getSecret())
      return true
    } catch (err) {
      if (err instanceof AuthError) {
        throw new UnauthorizedException(err.message)
      }
      throw new UnauthorizedException('Invalid service token')
    }
  }
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AccessTokenPayload => {
    const req = ctx.switchToHttp().getRequest<{ user?: AccessTokenPayload }>()
    if (!req.user) throw new UnauthorizedException('No authenticated user')
    return req.user
  },
)

export const CurrentService = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ServiceTokenPayload => {
    const req = ctx.switchToHttp().getRequest<{ serviceClient?: ServiceTokenPayload }>()
    if (!req.serviceClient) throw new UnauthorizedException('No authenticated service')
    return req.serviceClient
  },
)
