import { Injectable, NotFoundException, BadGatewayException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { CreateInspoItemDto, UpdateInspoItemDto } from './inspo.dto'

@Injectable()
export class InspoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async create(brandId: string, dto: CreateInspoItemDto) {
    return this.prisma.inspoItem.create({
      data: { brandId, ...dto },
    })
  }

  async list(brandId: string, filters: { type?: string; status?: string } = {}) {
    return this.prisma.inspoItem.findMany({
      where: { brandId, ...filters },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findOne(id: string) {
    const item = await this.prisma.inspoItem.findUnique({ where: { id } })
    if (!item) throw new NotFoundException('Inspo item not found')
    return item
  }

  async update(id: string, brandId: string, dto: UpdateInspoItemDto) {
    await this.assertOwnership(id, brandId)
    return this.prisma.inspoItem.update({ where: { id }, data: dto })
  }

  async delete(id: string, brandId: string) {
    await this.assertOwnership(id, brandId)
    await this.prisma.inspoItem.delete({ where: { id } })
  }

  async digest(brandId: string): Promise<{ content: string; attachedUrls: string[] }> {
    const items = await this.prisma.inspoItem.findMany({
      where: { brandId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const parts: string[] = []
    const attachedUrls: string[] = []

    for (const item of items) {
      const line = [item.extractedHook, item.extractedTheme, item.note].filter(Boolean).join(' — ')
      if (line) parts.push(line)
      if (item.sourceUrl) attachedUrls.push(item.sourceUrl)
    }

    return { content: parts.join('\n'), attachedUrls }
  }

  async repost(brandId: string, postUrl: string) {
    const brand = await this.prisma.brandIntelligence.findUnique({ where: { brandId } })
    if (!brand) throw new NotFoundException('Brand not found')

    const post = await this.prisma.post.findUnique({
      where: { instagramUrl: postUrl },
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
    const item = await this.prisma.inspoItem.findUnique({ where: { id } })
    if (!item || item.brandId !== brandId) throw new NotFoundException('Inspo item not found')
  }
}
