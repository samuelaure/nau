import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';
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
    let slug = dto.slug ?? generateSlug(dto.name);

    // Handle slug collisions by appending a counter
    let counter = 1;
    const originalSlug = slug;
    while (await this.prisma.workspace.findUnique({ where: { slug } })) {
      slug = `${originalSlug}-${counter++}`;
    }

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
    return this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
  }

  async updateMemberRole(actorId: string, workspaceId: string, targetUserId: string, role: WorkspaceRole) {
    const actor = await this.assertMembership(actorId, workspaceId);
    if (actor.role !== WorkspaceRole.OWNER) throw new ForbiddenException('Only owners can change roles');
    return this.prisma.workspaceMember.update({
      where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
      data: { role },
    });
  }

  async addMemberByEmail(actorId: string, workspaceId: string, dto: AddMemberDto) {
    const actor = await this.assertMembership(actorId, workspaceId);
    if (actor.role !== WorkspaceRole.OWNER) throw new ForbiddenException('Only owners can add members');

    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new NotFoundException('User with that email not found');

    const existing = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: user.id, workspaceId } },
    });
    if (existing) throw new ConflictException('User is already a member');

    return this.prisma.workspaceMember.create({
      data: { userId: user.id, workspaceId, role: (dto.role as WorkspaceRole) ?? WorkspaceRole.MEMBER },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
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
