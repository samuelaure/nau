import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { CreateProjectDto, UpdateProjectDto } from './projects.dto';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaces: WorkspacesService,
  ) {}

  async listByWorkspace(userId: string, workspaceId: string) {
    await this.workspaces.assertMembership(userId, workspaceId);
    return this.prisma.project.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async listByWorkspaceService(workspaceId: string) {
    return this.prisma.project.findMany({ where: { workspaceId }, orderBy: { createdAt: 'asc' } });
  }

  async getById(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    await this.workspaces.assertMembership(userId, project.workspaceId);
    return project;
  }

  async getByIdService(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async create(userId: string, workspaceId: string, dto: CreateProjectDto) {
    await this.workspaces.assertMembership(userId, workspaceId);
    return this.prisma.project.create({
      data: { workspaceId, name: dto.name, description: dto.description, brandId: dto.brandId },
    });
  }

  async createService(workspaceId: string, dto: CreateProjectDto) {
    return this.prisma.project.create({
      data: { workspaceId, name: dto.name, description: dto.description, brandId: dto.brandId },
    });
  }

  async update(userId: string, projectId: string, dto: UpdateProjectDto) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    await this.workspaces.assertMembership(userId, project.workspaceId);
    return this.prisma.project.update({ where: { id: projectId }, data: dto });
  }

  async delete(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    await this.workspaces.assertMembership(userId, project.workspaceId);
    return this.prisma.project.delete({ where: { id: projectId } });
  }

  async deleteService(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    return this.prisma.project.delete({ where: { id: projectId } });
  }
}
