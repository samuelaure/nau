import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './auth.dto';

const LINK_TOKEN_TTL_MS = 5 * 60 * 1000;

async function notifyAdminNewUser(email: string, name?: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return;
  const displayName = name ? `${name} (${email})` : email;
  const text = `🎉 New user registered: ${displayName}`;
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function generateOpaqueToken(): string {
  return crypto.randomBytes(48).toString('hex');
}

function generateFamily(): string {
  return crypto.randomBytes(16).toString('hex');
}

// Opaque tokens are 48 random bytes — their security comes from entropy, not hash slowness.
// SHA-256 is sufficient and enables direct DB lookup via the @unique index.
function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const invite = await this.prisma.inviteToken.findUnique({ where: { token: dto.inviteToken } });
    if (!invite) throw new UnauthorizedException('Invalid invitation token');
    if (invite.usedAt) throw new ConflictException('Invitation has already been used');
    if (invite.expiresAt < new Date()) throw new UnauthorizedException('Invitation has expired');
    if (invite.email && invite.email.toLowerCase() !== dto.email.toLowerCase()) {
      throw new ForbiddenException('This invitation is for a different email address');
    }

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const personalSlug = `personal-${crypto.randomBytes(4).toString('hex')}`;

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          name: dto.name,
          defaultWorkspaceId: invite.workspaceId,
          workspaces: {
            create: {
              workspace: {
                create: { name: 'Personal Workspace', slug: personalSlug },
              },
            },
          },
        },
      });

      await tx.workspaceMember.create({
        data: { userId: newUser.id, workspaceId: invite.workspaceId, role: invite.role },
      });

      await tx.inviteToken.update({
        where: { id: invite.id },
        data: { usedAt: new Date(), usedByUserId: newUser.id },
      });

      // Redeem any other pending invites for the same email (e.g. invited to
      // multiple workspaces before account creation).
      const otherInvites = await tx.inviteToken.findMany({
        where: {
          email: dto.email.toLowerCase(),
          usedAt: null,
          expiresAt: { gt: new Date() },
          id: { not: invite.id },
        },
      });

      for (const other of otherInvites) {
        await tx.workspaceMember.create({
          data: { userId: newUser.id, workspaceId: other.workspaceId, role: other.role },
        });
        await tx.inviteToken.update({
          where: { id: other.id },
          data: { usedAt: new Date(), usedByUserId: newUser.id },
        });
      }

      return newUser;
    });

    notifyAdminNewUser(user.email, user.name ?? undefined).catch(() => undefined);

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
    const hash = hashToken(rawToken);
    const matched = await this.prisma.session.findUnique({
      where: { tokenHash: hash },
      include: { user: true },
    });

    if (!matched) throw new UnauthorizedException('Invalid refresh token');

    if (matched.expiresAt < new Date()) {
      await this.prisma.session.delete({ where: { id: matched.id } });
      throw new UnauthorizedException('Refresh token expired');
    }

    // Rotate: delete old session, issue new one in same family
    await this.prisma.session.delete({ where: { id: matched.id } });
    return this.issueTokens(matched.user.id, matched.tokenFamily);
  }

  async logout(rawToken: string) {
    const hash = hashToken(rawToken);
    const session = await this.prisma.session.findUnique({ where: { tokenHash: hash } });
    if (session) {
      await this.prisma.session.deleteMany({ where: { tokenFamily: session.tokenFamily } });
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
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { defaultWorkspaceId: true },
    });

    let workspaceId = user?.defaultWorkspaceId ?? null;
    if (!workspaceId) {
      const primary = await this.prisma.workspaceMember.findFirst({
        where: { userId, role: 'OWNER' },
        orderBy: { createdAt: 'asc' },
      });
      workspaceId = primary?.workspaceId ?? null;
    }

    const accessToken = this.jwt.sign(
      { sub: userId, workspaceId },
      { expiresIn: ACCESS_TOKEN_TTL },
    );

    const rawRefresh = generateOpaqueToken();
    const tokenHash = hashToken(rawRefresh);
    const tokenFamily = existingFamily ?? generateFamily();

    await this.prisma.session.create({
      data: { userId, tokenFamily, tokenHash, expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS) },
    });

    return { accessToken, refreshToken: rawRefresh, expiresIn: 900 };
  }

  async setDefaultWorkspace(userId: string, workspaceId: string) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
    });
    if (!member) throw new ForbiddenException('Not a member of this workspace');
    await this.prisma.user.update({ where: { id: userId }, data: { defaultWorkspaceId: workspaceId } });
    return this.issueTokens(userId);
  }
}
