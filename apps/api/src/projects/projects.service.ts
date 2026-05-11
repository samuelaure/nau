import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { NauthenticityService } from '../integrations/nauthenticity.service';
import { CreateProjectDto, UpdateProjectDto } from './projects.dto';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaces: WorkspacesService,
    private readonly nauthenticity: NauthenticityService,
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
    const project = await this.prisma.project.create({
      data: { workspaceId, name: dto.name, description: dto.description, brandId: dto.brandId },
    });
    this.nauthenticity.syncProject(project).catch((e: unknown) =>
      this.logger.error(`nauthenticity sync failed for project ${project.id}: ${e}`),
    );
    return project;
  }

  async createService(workspaceId: string, dto: CreateProjectDto) {
    const project = await this.prisma.project.create({
      data: { workspaceId, name: dto.name, description: dto.description, brandId: dto.brandId },
    });
    this.nauthenticity.syncProject(project).catch((e: unknown) =>
      this.logger.error(`nauthenticity sync failed for project ${project.id}: ${e}`),
    );
    return project;
  }

  async update(userId: string, projectId: string, dto: UpdateProjectDto) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    await this.workspaces.assertMembership(userId, project.workspaceId);
    const updated = await this.prisma.project.update({ where: { id: projectId }, data: dto });
    this.nauthenticity.syncProject(updated).catch((e: unknown) =>
      this.logger.error(`nauthenticity sync failed for project ${projectId}: ${e}`),
    );
    return updated;
  }

  async delete(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    await this.workspaces.assertMembership(userId, project.workspaceId);
    await this.prisma.project.delete({ where: { id: projectId } });
    this.nauthenticity.deleteProject(projectId).catch((e: unknown) =>
      this.logger.error(`nauthenticity delete failed for project ${projectId}: ${e}`),
    );
    return { id: projectId };
  }

  async deleteService(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    await this.prisma.project.delete({ where: { id: projectId } });
    this.nauthenticity.deleteProject(projectId).catch((e: unknown) =>
      this.logger.error(`nauthenticity delete failed for project ${projectId}: ${e}`),
    );
    return { id: projectId };
  }
}
