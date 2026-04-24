import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PromptOwnerType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { UpsertPromptDto, PromptFilterDto } from './prompts.dto';

@Injectable()
export class PromptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaces: WorkspacesService,
  ) {}

  async list(userId: string, filter: PromptFilterDto) {
    // Enforce ownership: if filtering by ownerId, verify access
    if (filter.ownerId && filter.ownerType === PromptOwnerType.BRAND) {
      const brand = await this.prisma.brand.findUnique({ where: { id: filter.ownerId } });
      if (!brand) throw new NotFoundException('Brand not found');
      await this.workspaces.assertMembership(userId, brand.workspaceId);
    } else if (filter.ownerId && filter.ownerType === PromptOwnerType.WORKSPACE) {
      await this.workspaces.assertMembership(userId, filter.ownerId);
    } else if (filter.ownerId && filter.ownerType === PromptOwnerType.USER) {
      if (filter.ownerId !== userId) throw new ForbiddenException('Cannot access other users\' prompts');
    }

    return this.prisma.prompt.findMany({
      where: {
        ...(filter.ownerType && { ownerType: filter.ownerType }),
        ...(filter.ownerId && { ownerId: filter.ownerId }),
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async listService(filter: PromptFilterDto) {
    return this.prisma.prompt.findMany({
      where: {
        ...(filter.ownerType && { ownerType: filter.ownerType }),
        ...(filter.ownerId && { ownerId: filter.ownerId }),
      },
    });
  }

  async upsert(userId: string, dto: UpsertPromptDto) {
    // Validate ownership context
    if (dto.ownerType === PromptOwnerType.BRAND) {
      const brand = await this.prisma.brand.findUnique({ where: { id: dto.ownerId } });
      if (!brand) throw new NotFoundException('Brand not found');
      await this.workspaces.assertMembership(userId, brand.workspaceId);
    } else if (dto.ownerType === PromptOwnerType.WORKSPACE) {
      await this.workspaces.assertMembership(userId, dto.ownerId);
    } else if (dto.ownerType === PromptOwnerType.USER) {
      if (dto.ownerId !== userId) throw new ForbiddenException('Cannot modify other users\' prompts');
    }

    return this.prisma.prompt.upsert({
      where: { ownerType_ownerId_type: { ownerType: dto.ownerType, ownerId: dto.ownerId, type: dto.type } },
      create: {
        ownerType: dto.ownerType,
        ownerId: dto.ownerId,
        type: dto.type,
        body: dto.body,
        brandId: dto.brandId ?? null,
      },
      update: { body: dto.body },
    });
  }

  async upsertService(dto: UpsertPromptDto) {
    return this.prisma.prompt.upsert({
      where: { ownerType_ownerId_type: { ownerType: dto.ownerType, ownerId: dto.ownerId, type: dto.type } },
      create: {
        ownerType: dto.ownerType,
        ownerId: dto.ownerId,
        type: dto.type,
        body: dto.body,
        brandId: dto.brandId ?? null,
      },
      update: { body: dto.body },
    });
  }

  async delete(userId: string, promptId: string) {
    const prompt = await this.prisma.prompt.findUnique({ where: { id: promptId } });
    if (!prompt) throw new NotFoundException('Prompt not found');

    if (prompt.ownerType === PromptOwnerType.BRAND) {
      const brand = await this.prisma.brand.findUnique({ where: { id: prompt.ownerId } });
      if (brand) await this.workspaces.assertMembership(userId, brand.workspaceId);
    } else if (prompt.ownerType === PromptOwnerType.WORKSPACE) {
      await this.workspaces.assertMembership(userId, prompt.ownerId);
    } else if (prompt.ownerType === PromptOwnerType.USER) {
      if (prompt.ownerId !== userId) throw new ForbiddenException('Cannot delete other users\' prompts');
    }

    return this.prisma.prompt.delete({ where: { id: promptId } });
  }
}
