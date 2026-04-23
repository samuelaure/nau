import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateInspoItemDto, UpdateInspoItemDto } from './inspo.dto'

@Injectable()
export class InspoService {
  constructor(private readonly prisma: PrismaService) {}

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

  private async assertOwnership(id: string, brandId: string) {
    const item = await this.prisma.inspoItem.findUnique({ where: { id } })
    if (!item || item.brandId !== brandId) throw new NotFoundException('Inspo item not found')
  }
}
