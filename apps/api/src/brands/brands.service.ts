import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { CreateBrandDto, UpdateBrandDto } from './brands.dto';

function generateHandle(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 30) || 'brand';
}

@Injectable()
export class BrandsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaces: WorkspacesService,
  ) {}

  async listByWorkspace(userId: string, workspaceId: string) {
    await this.workspaces.assertMembership(userId, workspaceId);
    return this.prisma.brand.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async listByWorkspaceService(workspaceId: string) {
    return this.prisma.brand.findMany({ where: { workspaceId }, orderBy: { createdAt: 'asc' } });
  }

  async getById(userId: string, brandId: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) throw new NotFoundException('Brand not found');
    await this.workspaces.assertMembership(userId, brand.workspaceId);
    return brand;
  }

  async getByIdService(brandId: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }

  async create(userId: string, workspaceId: string, dto: CreateBrandDto) {
    await this.workspaces.assertMembership(userId, workspaceId);
    const handle = dto.handle ?? generateHandle(dto.name);
    return this.prisma.brand.create({
      data: { workspaceId, name: dto.name, handle },
    });
  }

  async createService(workspaceId: string, dto: CreateBrandDto) {
    const handle = dto.handle ?? generateHandle(dto.name);
    return this.prisma.brand.create({
      data: { workspaceId, name: dto.name, handle },
    });
  }

  async update(userId: string, brandId: string, dto: UpdateBrandDto) {
    const brand = await this.prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) throw new NotFoundException('Brand not found');
    await this.workspaces.assertMembership(userId, brand.workspaceId);
    return this.prisma.brand.update({ where: { id: brandId }, data: dto });
  }

  async delete(userId: string, brandId: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) throw new NotFoundException('Brand not found');
    await this.workspaces.assertMembership(userId, brand.workspaceId);
    return this.prisma.brand.delete({ where: { id: brandId } });
  }

  async deleteService(brandId: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) throw new NotFoundException('Brand not found');
    return this.prisma.brand.delete({ where: { id: brandId } });
  }
}
