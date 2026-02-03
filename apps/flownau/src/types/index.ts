import { Prisma } from '@prisma/client'

// Template with relations
export type TemplateWithRelations = Prisma.TemplateGetPayload<{
  include: {
    _count: { select: { renders: true } }
    account: { select: { username: true; platform: true } }
  }
}>

export type TemplateWithAccount = Prisma.TemplateGetPayload<{
  include: {
    account: { select: { username: true; platform: true } }
  }
}>

// Render with relations
export type RenderWithTemplate = Prisma.RenderGetPayload<{
  include: { template: true }
}>

// Account with relations
export type AccountWithCounts = Prisma.SocialAccountGetPayload<{
  include: {
    _count: { select: { templates: true; assets: true } }
  }
}>

export type SimpleAccount = {
  id: string
  username: string | null
  platform: string
}

// Asset types
export type AssetWithRelations = Prisma.AssetGetPayload<{
  include: {
    account: true
  }
}>

// Error types
export type ApiError = {
  error: string
  details?: string
}

// Form data types
export type UploadFormData = {
  file: File
  accountId?: string
  templateId?: string
}
