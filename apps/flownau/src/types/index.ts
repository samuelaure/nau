import { Prisma } from '@prisma/client'

export type TemplateWithRelations = Prisma.TemplateGetPayload<{
  include: {
    _count: { select: { renders: true } }
    brand: { select: { name: true } }
  }
}>

export type PostWithRelations = Prisma.PostGetPayload<{
  include: {
    brand: { select: { id: true; name: true } }
    renderJob: true
    template: { select: { id: true; name: true } }
  }
}>

export type RenderWithTemplate = Prisma.RenderGetPayload<{
  include: { template: true }
}>

export type SocialProfileWithCounts = Prisma.SocialProfileGetPayload<{
  include: Record<string, never>
}>

// Keep for any remaining usage during transition
export type AccountWithCounts = Prisma.SocialProfileGetPayload<{
  include: Record<string, never>
}>

export type AssetWithRelations = Prisma.AssetGetPayload<{
  include: {
    brand: true
  }
}>

export type ApiError = {
  error: string
  details?: string
}

export type UploadFormData = {
  file: File
  brandId?: string
  templateId?: string
}
