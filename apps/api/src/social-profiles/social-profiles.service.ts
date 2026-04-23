import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BrandsService } from '../brands/brands.service';
import { CreateSocialProfileDto, UpdateSocialProfileDto } from './social-profiles.dto';

@Injectable()
export class SocialProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly brands: BrandsService,
  ) {}

  async listByBrand(userId: string, brandId: string) {
    await this.brands.getById(userId, brandId); // verifies membership
    return this.prisma.socialProfile.findMany({
      where: { brandId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async listByBrandService(brandId: string) {
    return this.prisma.socialProfile.findMany({ where: { brandId }, orderBy: { createdAt: 'asc' } });
  }

  async getById(userId: string, profileId: string) {
    const profile = await this.prisma.socialProfile.findUnique({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('Social profile not found');
    await this.brands.getById(userId, profile.brandId);
    return profile;
  }

  async create(userId: string, brandId: string, dto: CreateSocialProfileDto) {
    await this.brands.getById(userId, brandId);
    return this.prisma.socialProfile.create({
      data: { brandId, ...dto },
    });
  }

  async createService(brandId: string, dto: CreateSocialProfileDto) {
    return this.prisma.socialProfile.create({
      data: { brandId, ...dto },
    });
  }

  async update(userId: string, profileId: string, dto: UpdateSocialProfileDto) {
    const profile = await this.prisma.socialProfile.findUnique({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('Social profile not found');
    await this.brands.getById(userId, profile.brandId);
    return this.prisma.socialProfile.update({ where: { id: profileId }, data: dto });
  }

  async delete(userId: string, profileId: string) {
    const profile = await this.prisma.socialProfile.findUnique({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('Social profile not found');
    await this.brands.getById(userId, profile.brandId);
    return this.prisma.socialProfile.delete({ where: { id: profileId } });
  }

  async deleteService(profileId: string) {
    const profile = await this.prisma.socialProfile.findUnique({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('Social profile not found');
    return this.prisma.socialProfile.delete({ where: { id: profileId } });
  }
}
