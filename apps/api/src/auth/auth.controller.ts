import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ServiceAuthGuard } from '../common/guards/service-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { LinkTelegramDto, LoginDto, RegisterDto, SetDefaultWorkspaceDto, VerifyLinkTokenDto } from './auth.dto';
import {
  buildAccessTokenCookie,
  buildRefreshTokenCookie,
  buildClearCookies,
  COOKIE_REFRESH_TOKEN,
} from '@nau/auth';
import type { AccessTokenPayload } from '@nau/types';

const COOKIE_DOMAIN = process.env['COOKIE_DOMAIN'] ?? '.9nau.com';
const IS_SECURE = process.env['NODE_ENV'] === 'production';

function setCookies(res: Response, accessToken: string, refreshToken: string) {
  res.setHeader('Set-Cookie', [
    buildAccessTokenCookie(accessToken, { domain: COOKIE_DOMAIN, secure: IS_SECURE }),
    buildRefreshTokenCookie(refreshToken, { domain: COOKIE_DOMAIN, secure: IS_SECURE }),
  ]);
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Throttle({ short: { ttl: 900_000, limit: 5 }, medium: { ttl: 900_000, limit: 5 } })
  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.auth.register(dto);
    setCookies(res, tokens.accessToken, tokens.refreshToken);
    return { expiresIn: tokens.expiresIn };
  }

  @Throttle({ short: { ttl: 900_000, limit: 5 }, medium: { ttl: 900_000, limit: 5 } })
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.auth.login(dto);
    setCookies(res, tokens.accessToken, tokens.refreshToken);
    return { expiresIn: tokens.expiresIn };
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawToken =
      (req.cookies?.[COOKIE_REFRESH_TOKEN] as string | undefined) ??
      (req.body as { refreshToken?: string })?.refreshToken;
    if (!rawToken) throw new UnauthorizedException('Missing refresh token');
    const tokens = await this.auth.refresh(rawToken);
    setCookies(res, tokens.accessToken, tokens.refreshToken);
    // Return tokens in body too — server-side callers (middleware) read from here
    // since Headers.getSetCookie() is not universally available across runtimes.
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresIn: tokens.expiresIn };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawToken =
      (req.cookies?.[COOKIE_REFRESH_TOKEN] as string | undefined) ??
      (req.body as { refreshToken?: string })?.refreshToken;
    if (rawToken) await this.auth.logout(rawToken);
    res.setHeader('Set-Cookie', buildClearCookies({ domain: COOKIE_DOMAIN, secure: IS_SECURE }));
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AccessTokenPayload) {
    return this.auth.me(user.sub);
  }

  @Post('link-telegram')
  @UseGuards(JwtAuthGuard)
  linkTelegram(@CurrentUser() user: AccessTokenPayload, @Body() dto: LinkTelegramDto) {
    return this.auth.linkTelegram(user.sub, dto.telegramId);
  }

  @Post('link-token')
  @UseGuards(JwtAuthGuard)
  generateLinkToken(@CurrentUser() user: AccessTokenPayload) {
    return this.auth.generateLinkToken(user.sub);
  }

  @Post('link-token/verify')
  @UseGuards(ServiceAuthGuard)
  verifyLinkToken(@Body() dto: VerifyLinkTokenDto) {
    return this.auth.verifyLinkToken(dto.token, dto.telegramId);
  }

  @Get('by-telegram/:telegramId')
  @UseGuards(ServiceAuthGuard)
  byTelegram(@Param('telegramId') telegramId: string) {
    return this.auth.findByTelegramId(telegramId);
  }

  @Get('lookup')
  @UseGuards(ServiceAuthGuard)
  async lookupByEmail(@Query('email') email: string) {
    const user = await this.auth.findByEmail(email);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  @Patch('default-workspace')
  @UseGuards(JwtAuthGuard)
  async setDefaultWorkspace(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: SetDefaultWorkspaceDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.auth.setDefaultWorkspace(user.sub, dto.workspaceId);
    setCookies(res, tokens.accessToken, tokens.refreshToken);
    return { expiresIn: tokens.expiresIn };
  }
}
