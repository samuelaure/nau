import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Tag } from '@prisma/client';

export interface TagTree extends Tag {
  children: TagTree[];
}

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForWorkspace(workspaceId: string): Promise<TagTree[]> {
    const tags = await this.prisma.tag.findMany({
      where: { workspaceId },
      orderBy: { name: 'asc' },
    });

    const map = new Map<string, TagTree>();
    for (const tag of tags) {
      map.set(tag.id, { ...tag, children: [] });
    }

    const roots: TagTree[] = [];
    for (const node of map.values()) {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  async create(
    workspaceId: string,
    data: { name: string; parentId?: string | null; color?: string },
  ) {
    return this.prisma.tag.create({
      data: {
        workspaceId,
        name: data.name,
        parentId: data.parentId ?? null,
        color: data.color ?? null,
      },
    });
  }

  async update(
    id: string,
    data: { name?: string; parentId?: string | null; color?: string | null },
  ) {
    const tag = await this.prisma.tag.findUnique({ where: { id } });
    if (!tag) throw new NotFoundException(`Tag ${id} not found`);

    return this.prisma.tag.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.parentId !== undefined && { parentId: data.parentId }),
        ...(data.color !== undefined && { color: data.color }),
      },
    });
  }

  async remove(id: string) {
    const tag = await this.prisma.tag.findUnique({ where: { id } });
    if (!tag) throw new NotFoundException(`Tag ${id} not found`);
    return this.prisma.tag.delete({ where: { id } });
  }
}
