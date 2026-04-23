import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './auth.dto';

const LINK_TOKEN_TTL_MS = 5 * 60 * 1000;
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function generateOpaqueToken(): string {
  return crypto.randomBytes(48).toString('hex');
}

function generateFamily(): string {
  return crypto.randomBytes(16).toString('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const workspaceName = dto.workspaceName ?? `${dto.name ?? dto.email}'s Workspace`;
    const workspaceSlug = workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        workspaces: {
          create: {
            workspace: {
              create: { name: workspaceName, slug: workspaceSlug },
            },
          },
        },
      },
      include: { workspaces: { include: { workspace: true } } },
    });

    return this.issueTokens(user.id);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.issueTokens(user.id);
  }

  async refresh(rawToken: string) {
    // Find all sessions that might match (we only store hashes)
    // We can't query by hash directly — look up candidate sessions by userId is not possible
    // without the userId. Instead we use a separate index: we store the token hash directly.
    const tokenHash = await bcrypt.hash(rawToken, 10);

    // Find by scanning — for scale we'd use a faster token scheme, but bcrypt compare is the
    // security-correct approach. With 30d TTL and < 10K sessions this is fine pre-launch.
    const sessions = await this.prisma.session.findMany({
      where: { expiresAt: { gt: new Date() } },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    let matched: (typeof sessions)[0] | undefined;
    for (const s of sessions) {
      if (await bcrypt.compare(rawToken, s.tokenHash)) {
        matched = s;
        break;
      }
    }

    if (!matched) {
      // Token not found — could be a reuse attempt. We can't know the family without
      // the session row, so just reject.
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (matched.expiresAt < new Date()) {
      await this.prisma.session.delete({ where: { id: matched.id } });
      throw new UnauthorizedException('Refresh token expired');
    }

    // Rotate: delete old session, issue new one in same family
    await this.prisma.session.delete({ where: { id: matched.id } });
    return this.issueTokens(matched.user.id, matched.tokenFamily);
  }

  async logout(rawToken: string) {
    const sessions = await this.prisma.session.findMany({
      where: { expiresAt: { gt: new Date() } },
      take: 1000,
    });
    for (const s of sessions) {
      if (await bcrypt.compare(rawToken, s.tokenHash)) {
        // Revoke entire family (all devices for this login)
        await this.prisma.session.deleteMany({ where: { tokenFamily: s.tokenFamily } });
        return;
      }
    }
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { workspaces: { include: { workspace: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    const { passwordHash: _, ...safe } = user;
    return safe;
  }

  async findByTelegramId(telegramId: string) {
    const user = await this.prisma.user.findUnique({ where: { telegramId } });
    if (!user) return { found: false };
    const { passwordHash: _, ...safe } = user;
    return { found: true, user: safe };
  }

  async generateLinkToken(userId: string): Promise<{ token: string }> {
    await this.prisma.authLinkToken.deleteMany({ where: { userId } });
    const token = crypto.randomBytes(32).toString('hex');
    await this.prisma.authLinkToken.create({
      data: { token, userId, expiresAt: new Date(Date.now() + LINK_TOKEN_TTL_MS) },
    });
    return { token };
  }

  async verifyLinkToken(token: string, telegramId: string): Promise<{ ok: boolean }> {
    const record = await this.prisma.authLinkToken.findUnique({ where: { token } });
    if (!record || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired link token');
    }
    await this.prisma.authLinkToken.delete({ where: { token } });
    return this.linkTelegram(record.userId, telegramId);
  }

  async linkTelegram(userId: string, telegramId: string) {
    const existing = await this.prisma.user.findUnique({ where: { telegramId } });
    if (existing && existing.id !== userId) {
      throw new ConflictException('Telegram account already linked to another user');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { telegramId } });
    return { ok: true };
  }

  async findByEmail(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return null;
    const { passwordHash: _, ...safe } = user;
    return safe;
  }

  // ── Token issuance ──────────────────────────────────────────────────────────

  async issueTokens(userId: string, existingFamily?: string) {
    const primaryMembership = await this.prisma.workspaceMember.findFirst({
      where: { userId, role: 'OWNER' },
      orderBy: { createdAt: 'asc' },
    });
    const workspaceId = primaryMembership?.workspaceId ?? null;

    const accessToken = this.jwt.sign(
      { sub: userId, workspaceId },
      { expiresIn: ACCESS_TOKEN_TTL },
    );

    const rawRefresh = generateOpaqueToken();
    const tokenHash = await bcrypt.hash(rawRefresh, 10);
    const tokenFamily = existingFamily ?? generateFamily();

    await this.prisma.session.create({
      data: {
        userId,
        tokenFamily,
        tokenHash,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return { accessToken, refreshToken: rawRefresh, expiresIn: 900 };
  }
}
