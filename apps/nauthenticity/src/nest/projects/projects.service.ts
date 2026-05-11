import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

export interface ProjectUpsertData {
  id: string
  workspaceId: string
  brandId?: string | null
  name: string
  isActive?: boolean
}

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(data: ProjectUpsertData) {
    return this.prisma.project.upsert({
      where: { id: data.id },
      create: {
        id: data.id,
        workspaceId: data.workspaceId,
        brandId: data.brandId ?? null,
        name: data.name,
        isActive: data.isActive ?? true,
      },
      update: {
        workspaceId: data.workspaceId,
        brandId: data.brandId ?? null,
        name: data.name,
        isActive: data.isActive ?? true,
      },
    })
  }

  async getById(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } })
    if (!project) throw new NotFoundException('Project not found')
    return project
  }

  async listByWorkspace(workspaceId: string) {
    return this.prisma.project.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
    })
  }

  async delete(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } })
    if (!project) throw new NotFoundException('Project not found')
    return this.prisma.project.delete({ where: { id: projectId } })
  }

  async getWorkspaceOverview(workspaceId: string) {
    const [brands, projects] = await Promise.all([
      this.prisma.brand.findMany({
        where: { workspaceId },
        select: { id: true, workspaceId: true, mainUsername: true, commentPrompt: true, suggestionsCount: true, timezone: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.project.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'asc' },
      }),
    ])
    return { brands, projects }
  }
}
