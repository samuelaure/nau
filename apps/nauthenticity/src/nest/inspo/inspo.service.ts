import { Injectable, NotFoundException, BadGatewayException, BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { CreateInspoMembershipDto, UpdateInspoMembershipDto } from './inspo.dto'

@Injectable()
export class InspoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Add a profile or post to a brand's InspoBase.
   * Exactly one of socialProfileId or postId must be provided.
   */
  async create(brandId: string, dto: CreateInspoMembershipDto) {
    const profileSet = !!dto.socialProfileId
    const postSet = !!dto.postId
    if (profileSet === postSet) {
      throw new BadRequestException('Provide exactly one of socialProfileId or postId')
    }
    const existing = await this.prisma.categoryMembership.findFirst({
      where: {
        brandId,
        category: 'INSPO',
        socialProfileId: dto.socialProfileId ?? null,
        postId: dto.postId ?? null,
      },
      select: { id: true },
    })
    if (existing) {
      return this.prisma.categoryMembership.update({
        where: { id: existing.id },
        data: { isActive: true },
      })
    }
    return this.prisma.categoryMembership.create({
      data: {
        brandId,
        category: 'INSPO',
        socialProfileId: dto.socialProfileId ?? null,
        postId: dto.postId ?? null,
        isActive: true,
      },
    })
  }

  async list(brandId: string) {
    return this.prisma.categoryMembership.findMany({
      where: { brandId, category: 'INSPO' },
      include: {
        socialProfile: { select: { id: true, username: true, profileImageUrl: true } },
        post: { select: { id: true, url: true, caption: true, postedAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findOne(id: string) {
    const membership = await this.prisma.categoryMembership.findUnique({
      where: { id },
      include: {
        socialProfile: true,
        post: true,
      },
    })
    if (!membership || membership.category !== 'INSPO') {
      throw new NotFoundException('Inspo membership not found')
    }
    return membership
  }

  async update(id: string, brandId: string, dto: UpdateInspoMembershipDto) {
    await this.assertOwnership(id, brandId)
    return this.prisma.categoryMembership.update({
      where: { id },
      data: { isActive: dto.isActive },
    })
  }

  async delete(id: string, brandId: string) {
    const membership = await this.assertOwnership(id, brandId)
    await this.prisma.categoryMembership.delete({ where: { id } })

    // Default-absorption: if post/profile has no remaining non-OWN membership for this brand, add BENCHMARK
    const { socialProfileId, postId } = membership
    const remaining = await this.prisma.categoryMembership.count({
      where: { brandId, socialProfileId: socialProfileId ?? undefined, postId: postId ?? undefined },
    })
    if (remaining === 0) {
      await this.prisma.categoryMembership.create({
        data: { brandId, socialProfileId, postId, category: 'BENCHMARK', isActive: true },
      })
    }
  }

  async repost(brandId: string, postUrl: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id: brandId } })
    if (!brand) throw new NotFoundException('Brand not found')

    const post = await this.prisma.post.findUnique({
      where: { url: postUrl },
      include: { media: true },
    })
    if (!post) throw new NotFoundException('Post not found in database. Scrape it first.')

    const flownauUrl = this.config.get<string>('FLOWNAU_URL') ?? 'http://flownau:3000'
    const serviceKey = this.config.getOrThrow<string>('NAU_SERVICE_KEY')

    const response = await fetch(`${flownauUrl}/api/v1/content/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-nau-service-key': serviceKey },
      body: JSON.stringify({ brandId, postUrl, type: 'repost' }),
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new BadGatewayException(`Failed to forward to flownaŭ: ${errText}`)
    }

    return { success: true, message: 'Repost forwarded to flownaŭ' }
  }

  private async assertOwnership(id: string, brandId: string) {
    const membership = await this.prisma.categoryMembership.findUnique({ where: { id } })
    if (!membership || membership.brandId !== brandId || membership.category !== 'INSPO') {
      throw new NotFoundException('Inspo membership not found')
    }
    return membership
  }
}
