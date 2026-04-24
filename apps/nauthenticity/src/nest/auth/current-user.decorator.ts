import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common'
import type { AccessTokenPayload } from '@nau/types'

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AccessTokenPayload => {
    const req = ctx.switchToHttp().getRequest<{ user?: AccessTokenPayload }>()
    if (!req.user) throw new UnauthorizedException('No authenticated user')
    return req.user
  },
)
