/**
 * InspoService unit tests.
 *
 * InspoService is a thin layer over Prisma's `categoryMembership` model
 * (filtered to category='INSPO'). All Prisma methods are mocked with
 * jest-mock-extended so no real database connection is required.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { mockDeep, DeepMockProxy } from 'jest-mock-extended'
import { InspoService } from '../inspo.service'
import { PrismaService } from '../../prisma/prisma.service'

describe('InspoService', () => {
  let service: InspoService
  let prisma: DeepMockProxy<PrismaService>

  beforeEach(() => {
    prisma = mockDeep<PrismaService>()
    const config = mockDeep<ConfigService>()
    service = new InspoService(prisma, config)
  })

  describe('create', () => {
    it('creates a profile-level INSPO membership when none exists', async () => {
      const created = {
        id: 'm-1',
        brandId: 'brand-1',
        category: 'INSPO',
        socialProfileId: 'sp-1',
        postId: null,
      }
      prisma.categoryMembership.findFirst.mockResolvedValue(null)
      prisma.categoryMembership.create.mockResolvedValue(created as any)

      const result = await service.create('brand-1', { socialProfileId: 'sp-1' })

      expect(prisma.categoryMembership.findFirst).toHaveBeenCalled()
      expect(prisma.categoryMembership.create).toHaveBeenCalled()
      expect(result).toEqual(created)
    })

    it('updates existing INSPO membership instead of creating duplicate', async () => {
      prisma.categoryMembership.findFirst.mockResolvedValue({ id: 'm-existing' } as any)
      const updated = { id: 'm-existing', isActive: true }
      prisma.categoryMembership.update.mockResolvedValue(updated as any)

      const result = await service.create('brand-1', { postId: 'p-1' })

      expect(prisma.categoryMembership.findFirst).toHaveBeenCalled()
      expect(prisma.categoryMembership.update).toHaveBeenCalledWith({
        where: { id: 'm-existing' },
        data: { isActive: true },
      })
      expect(result).toEqual(updated)
    })

    it('creates a post-level INSPO membership when none exists', async () => {
      const created = {
        id: 'm-2',
        brandId: 'brand-1',
        category: 'INSPO',
        socialProfileId: null,
        postId: 'p-1',
      }
      prisma.categoryMembership.findFirst.mockResolvedValue(null)
      prisma.categoryMembership.create.mockResolvedValue(created as any)

      const result = await service.create('brand-1', { postId: 'p-1' })

      expect(prisma.categoryMembership.create).toHaveBeenCalled()
      expect(result).toEqual(created)
    })

    it('throws BadRequestException if both socialProfileId and postId are provided', async () => {
      await expect(
        service.create('brand-1', { socialProfileId: 'sp-1', postId: 'p-1' }),
      ).rejects.toBeInstanceOf(BadRequestException)
    })

    it('throws BadRequestException if neither is provided', async () => {
      await expect(service.create('brand-1', {})).rejects.toBeInstanceOf(BadRequestException)
    })
  })

  describe('list', () => {
    it('returns INSPO memberships for the brand', async () => {
      prisma.categoryMembership.findMany.mockResolvedValue([])
      await service.list('brand-1')
      expect(prisma.categoryMembership.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { brandId: 'brand-1', category: 'INSPO' } }),
      )
    })
  })

  describe('findOne', () => {
    it('returns the membership when it exists and is INSPO', async () => {
      const m = { id: 'm-1', brandId: 'brand-1', category: 'INSPO' }
      prisma.categoryMembership.findUnique.mockResolvedValue(m as any)
      const result = await service.findOne('m-1')
      expect(result).toEqual(m)
    })

    it('throws NotFoundException when membership is not INSPO', async () => {
      prisma.categoryMembership.findUnique.mockResolvedValue({ id: 'm-1', category: 'BENCHMARK' } as any)
      await expect(service.findOne('m-1')).rejects.toBeInstanceOf(NotFoundException)
    })

    it('throws NotFoundException when membership does not exist', async () => {
      prisma.categoryMembership.findUnique.mockResolvedValue(null)
      await expect(service.findOne('missing-id')).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  describe('update', () => {
    it('updates the membership when caller owns it', async () => {
      const m = { id: 'm-1', brandId: 'brand-1', category: 'INSPO' }
      const updated = { ...m, isActive: false }
      prisma.categoryMembership.findUnique.mockResolvedValue(m as any)
      prisma.categoryMembership.update.mockResolvedValue(updated as any)

      const result = await service.update('m-1', 'brand-1', { isActive: false })
      expect(result).toEqual(updated)
    })

    it('throws NotFoundException when caller does not own the membership', async () => {
      prisma.categoryMembership.findUnique.mockResolvedValue({
        id: 'm-1',
        brandId: 'other-brand',
        category: 'INSPO',
      } as any)
      await expect(service.update('m-1', 'brand-1', {})).rejects.toBeInstanceOf(NotFoundException)
    })

    it('throws NotFoundException when membership is not INSPO', async () => {
      prisma.categoryMembership.findUnique.mockResolvedValue({
        id: 'm-1',
        brandId: 'brand-1',
        category: 'COMMENT',
      } as any)
      await expect(service.update('m-1', 'brand-1', {})).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  describe('delete', () => {
    it('deletes the membership when caller owns it', async () => {
      prisma.categoryMembership.findUnique.mockResolvedValue({
        id: 'm-1',
        brandId: 'brand-1',
        category: 'INSPO',
      } as any)
      prisma.categoryMembership.delete.mockResolvedValue({} as any)

      await service.delete('m-1', 'brand-1')
      expect(prisma.categoryMembership.delete).toHaveBeenCalledWith({ where: { id: 'm-1' } })
    })

    it('throws NotFoundException when caller does not own the membership', async () => {
      prisma.categoryMembership.findUnique.mockResolvedValue({
        id: 'm-1',
        brandId: 'other',
        category: 'INSPO',
      } as any)
      await expect(service.delete('m-1', 'brand-1')).rejects.toBeInstanceOf(NotFoundException)
    })
  })
})
