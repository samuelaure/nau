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

  async getWorkspaceOverview(workspaceId: string, userToken: string) {
    const nauApiUrl = process.env['NAU_API_URL'] ?? 'https://api.9nau.com'

    const [apiBrands, projects] = await Promise.all([
      fetch(`${nauApiUrl}/workspaces/${workspaceId}/brands`, {
        headers: { Authorization: `Bearer ${userToken}` },
      }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      this.prisma.project.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'asc' },
      }),
    ])

    return { brands: apiBrands, projects }
  }
}
