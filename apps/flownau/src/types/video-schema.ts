import { z } from 'zod'

export const AssetSchema = z.object({
  id: z.string(),
  url: z.string(),
  r2Key: z.string(),
  systemFilename: z.string(),
  originalFilename: z.string(),
  type: z.string(),
  size: z.number(),
  mimeType: z.string(),
})

export const ElementStyleSchema = z.object({
  x: z.number().default(0),
  y: z.number().default(0),
  width: z.number().optional(),
  height: z.number().optional(),
  rotation: z.number().default(0),
  opacity: z.number().default(1),
  scale: z.number().default(1),
  color: z.string().optional(),
  backgroundColor: z.string().optional(),
  fontSize: z.number().optional(),
  fontFamily: z.string().optional(),
  textAlign: z.enum(['left', 'center', 'right']).default('left'),
})

export const ElementSchema = z.object({
  id: z.string(),
  type: z.enum(['video', 'image', 'text', 'audio']),
  name: z.string(),
  content: z.string().optional(), // Text content or URL
  startFrame: z.number(),
  durationInFrames: z.number(),
  mediaStartOffset: z.number().default(0), // Frame offset into the source media
  fadeInDuration: z.number().default(0),
  fadeOutDuration: z.number().default(0),
  style: ElementStyleSchema,
})

export const TemplateSchema = z.object({
  width: z.number().default(1080),
  height: z.number().default(1920),
  fps: z.number().default(30),
  durationInFrames: z.number().default(150),
  elements: z.array(ElementSchema).default([]),
})

export type ElementStyle = z.infer<typeof ElementStyleSchema>
export type VideoElement = z.infer<typeof ElementSchema>
export type VideoTemplate = z.infer<typeof TemplateSchema>
export type Asset = z.infer<typeof AssetSchema>
