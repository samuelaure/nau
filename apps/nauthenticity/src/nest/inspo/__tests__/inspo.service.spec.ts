/**
 * InspoService unit tests.
 *
 * InspoService is a thin CRUD layer over Prisma. All Prisma methods are mocked
 * with jest-mock-extended so no real database connection is required.
 * Tests verify:
 *   - Correct Prisma calls are made with expected arguments
 *   - NotFoundException is thrown when ownership check fails
 *   - NotFoundException is thrown when an item is not found
 */
import { NotFoundException } from '@nestjs/common'
import { mock, MockProxy } from 'jest-mock-extended'
import { InspoService } from '../inspo.service'
import { PrismaService } from '../../prisma/prisma.service'

describe('InspoService', () => {
  let service: InspoService
  let prisma: MockProxy<PrismaService>

  beforeEach(() => {
    prisma = mock<PrismaService>()
    service = new InspoService(prisma)
  })

  describe('create', () => {
    it('calls prisma.inspoItem.create with brandId and dto merged', async () => {
      const dto = { title: 'My Inspiration', type: 'image', url: 'https://example.com/img.jpg' }
      const created = { id: 'item-1', brandId: 'brand-1', ...dto, createdAt: new Date() }
      prisma.inspoItem.create.mockResolvedValue(created as any)

      const result = await service.create('brand-1', dto as any)

      expect(prisma.inspoItem.create).toHaveBeenCalledWith({
        data: { brandId: 'brand-1', ...dto },
      })
      expect(result).toEqual(created)
    })
  })

  describe('list', () => {
    it('returns items filtered by brandId only when no extra filters', async () => {
      prisma.inspoItem.findMany.mockResolvedValue([])
      await service.list('brand-1')
      expect(prisma.inspoItem.findMany).toHaveBeenCalledWith({
        where: { brandId: 'brand-1' },
        orderBy: { createdAt: 'desc' },
      })
    })

    it('passes additional type and status filters to Prisma', async () => {
      prisma.inspoItem.findMany.mockResolvedValue([])
      await service.list('brand-1', { type: 'video', status: 'saved' })
      expect(prisma.inspoItem.findMany).toHaveBeenCalledWith({
        where: { brandId: 'brand-1', type: 'video', status: 'saved' },
        orderBy: { createdAt: 'desc' },
      })
    })
  })

  describe('findOne', () => {
    it('returns the item when it exists', async () => {
      const item = { id: 'item-1', brandId: 'brand-1' }
      prisma.inspoItem.findUnique.mockResolvedValue(item as any)
      const result = await service.findOne('item-1')
      expect(result).toEqual(item)
    })

    it('throws NotFoundException when item does not exist', async () => {
      prisma.inspoItem.findUnique.mockResolvedValue(null)
      await expect(service.findOne('missing-id')).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  describe('update', () => {
    it('updates the item when caller owns it', async () => {
      const item = { id: 'item-1', brandId: 'brand-1' }
      const updated = { ...item, title: 'Updated' }
      prisma.inspoItem.findUnique.mockResolvedValue(item as any)
      prisma.inspoItem.update.mockResolvedValue(updated as any)

      const result = await service.update('item-1', 'brand-1', { title: 'Updated' } as any)
      expect(result).toEqual(updated)
    })

    it('throws NotFoundException when caller does not own the item', async () => {
      prisma.inspoItem.findUnique.mockResolvedValue({ id: 'item-1', brandId: 'other-brand' } as any)
      await expect(service.update('item-1', 'brand-1', {} as any)).rejects.toBeInstanceOf(
        NotFoundException,
      )
    })

    it('throws NotFoundException when item does not exist', async () => {
      prisma.inspoItem.findUnique.mockResolvedValue(null)
      await expect(service.update('missing', 'brand-1', {} as any)).rejects.toBeInstanceOf(
        NotFoundException,
      )
    })
  })

  describe('delete', () => {
    it('deletes the item when caller owns it', async () => {
      prisma.inspoItem.findUnique.mockResolvedValue({ id: 'item-1', brandId: 'brand-1' } as any)
      prisma.inspoItem.delete.mockResolvedValue({} as any)

      await service.delete('item-1', 'brand-1')
      expect(prisma.inspoItem.delete).toHaveBeenCalledWith({ where: { id: 'item-1' } })
    })

    it('throws NotFoundException when caller does not own the item', async () => {
      prisma.inspoItem.findUnique.mockResolvedValue({ id: 'item-1', brandId: 'other' } as any)
      await expect(service.delete('item-1', 'brand-1')).rejects.toBeInstanceOf(NotFoundException)
    })
  })
})
