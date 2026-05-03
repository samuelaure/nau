import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkspaceDto, AddMemberDto } from './workspaces.dto';

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  async getWorkspaceById(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { brands: true },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');
    return workspace;
  }

  async getWorkspacesForUser(userId: string) {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      include: { workspace: { include: { brands: true } } },
    });
    return memberships.map((m) => ({ ...m.workspace, role: m.role }));
  }

  async createWorkspace(userId: string, dto: CreateWorkspaceDto) {
    const slug = dto.slug ?? generateSlug(dto.name);
    return this.prisma.workspace.create({
      data: {
        name: dto.name,
        slug,
        timezone: dto.timezone ?? 'UTC',
        members: { create: { userId, role: WorkspaceRole.OWNER } },
      },
      include: { members: true, brands: true },
    });
  }

  async renameWorkspace(userId: string, workspaceId: string, name: string) {
    await this.assertMembership(userId, workspaceId);
    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { name },
    });
  }

  async deleteWorkspace(userId: string, workspaceId: string) {
    const member = await this.assertMembership(userId, workspaceId);
    if (member.role !== WorkspaceRole.OWNER) throw new ForbiddenException('Only owners can delete a workspace');
    return this.prisma.workspace.delete({ where: { id: workspaceId } });
  }

  async getWorkspaceMembers(userId: string, workspaceId: string) {
    await this.assertMembership(userId, workspaceId);
    const [members, rawInvites] = await Promise.all([
      this.prisma.workspaceMember.findMany({
        where: { workspaceId },
        include: { user: { select: { id: true, email: true, name: true } } },
      }),
      this.prisma.inviteToken.findMany({
        where: { workspaceId, usedAt: null },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const pendingInvites = rawInvites.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      token: inv.token,
      expiresAt: inv.expiresAt,
      expired: inv.expiresAt < new Date(),
      createdAt: inv.createdAt,
    }));

    return { members, pendingInvites };
  }

  async updateMemberRole(actorId: string, workspaceId: string, targetUserId: string, role: WorkspaceRole) {
    const actor = await this.assertMembership(actorId, workspaceId);
    if (actor.role !== WorkspaceRole.OWNER) throw new ForbiddenException('Only owners can change roles');
    return this.prisma.workspaceMember.update({
      where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
      data: { role },
    });
  }

  async addMember(actorId: string, workspaceId: string, dto: AddMemberDto) {
    const actor = await this.assertMembership(actorId, workspaceId);
    if (actor.role !== WorkspaceRole.OWNER && actor.role !== WorkspaceRole.ADMIN) {
      throw new ForbiddenException('Only owners and admins can add members');
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (existingUser) {
      const alreadyMember = await this.prisma.workspaceMember.findUnique({
        where: { userId_workspaceId: { userId: existingUser.id, workspaceId } },
      });
      if (alreadyMember) throw new ConflictException('User is already a member');

      const member = await this.prisma.workspaceMember.create({
        data: { userId: existingUser.id, workspaceId, role: (dto.role as WorkspaceRole) ?? WorkspaceRole.MEMBER },
        include: { user: { select: { id: true, email: true, name: true } } },
      });
      return { type: 'member' as const, member };
    }

    const pendingInvite = await this.prisma.inviteToken.findFirst({
      where: { email: dto.email, workspaceId, usedAt: null },
    });
    if (pendingInvite) throw new ConflictException('An invite is already pending for this email');

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invite = await this.prisma.inviteToken.create({
      data: {
        token,
        email: dto.email,
        workspaceId,
        role: (dto.role as WorkspaceRole) ?? WorkspaceRole.MEMBER,
        createdById: actorId,
        expiresAt,
      },
    });
    return { type: 'invite' as const, invite };
  }

  async regenerateInvite(actorId: string, workspaceId: string, inviteId: string) {
    const actor = await this.assertMembership(actorId, workspaceId);
    if (actor.role !== WorkspaceRole.OWNER && actor.role !== WorkspaceRole.ADMIN) {
      throw new ForbiddenException('Only owners and admins can manage invites');
    }

    const invite = await this.prisma.inviteToken.findFirst({
      where: { id: inviteId, workspaceId, usedAt: null },
    });
    if (!invite) throw new NotFoundException('Invite not found');

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    return this.prisma.inviteToken.update({
      where: { id: inviteId },
      data: { token, expiresAt },
    });
  }

  async deleteInvite(actorId: string, workspaceId: string, inviteId: string) {
    const actor = await this.assertMembership(actorId, workspaceId);
    if (actor.role !== WorkspaceRole.OWNER && actor.role !== WorkspaceRole.ADMIN) {
      throw new ForbiddenException('Only owners and admins can manage invites');
    }

    const invite = await this.prisma.inviteToken.findFirst({
      where: { id: inviteId, workspaceId, usedAt: null },
    });
    if (!invite) throw new NotFoundException('Invite not found');

    await this.prisma.inviteToken.delete({ where: { id: inviteId } });
  }

  async removeMember(actorId: string, workspaceId: string, targetUserId: string) {
    const actor = await this.assertMembership(actorId, workspaceId);
    if (actor.role !== WorkspaceRole.OWNER && actorId !== targetUserId) {
      throw new ForbiddenException('Only owners can remove members (or yourself)');
    }

    const member = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
    });
    if (!member) throw new NotFoundException('Member not found');
    if (member.role === WorkspaceRole.OWNER) {
      const ownerCount = await this.prisma.workspaceMember.count({
        where: { workspaceId, role: WorkspaceRole.OWNER },
      });
      if (ownerCount <= 1) throw new ForbiddenException('Cannot remove the last owner');
    }

    return this.prisma.workspaceMember.delete({ where: { id: member.id } });
  }

  async assertMembership(userId: string, workspaceId: string) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
    });
    if (!member) throw new ForbiddenException('Not a member of this workspace');
    return member;
  }
}
