import { z } from 'zod'

export const SafeZoneEnum = z.enum(['top-third', 'center-safe', 'bottom-third'])

export const MediaNodeSchema = z.object({
  id: z.string(),
  type: z.literal('media'),
  assetUrl: z.string(), // Could be from DB asset, mapped to presigned URL
  startFrame: z.number(),
  durationInFrames: z.number(),
  scale: z.enum(['cover', 'contain']).default('cover'),
})

export const TypographyNodeSchema = z.object({
  id: z.string(),
  type: z.literal('text'),
  content: z.string(),
  startFrame: z.number(),
  durationInFrames: z.number(),
  safeZone: SafeZoneEnum.default('center-safe'),
  color: z.string().default('#FFFFFF'),
  fontFamily: z.string().optional(),
  fontSize: z.number().default(60),
  animation: z.enum(['fade', 'pop', 'slide-up', 'none']).default('fade'),
})

export const SceneSchema = z.object({
  id: z.string(),
  startFrame: z.number(),
  durationInFrames: z.number(),
  layout: z.enum(['full', 'split-horizontal', 'split-vertical']).default('full'),
  nodes: z.array(z.union([MediaNodeSchema, TypographyNodeSchema])),
})

export const DynamicCompositionSchema = z.object({
  format: z.enum(['reel', 'post', 'story']).default('reel'),
  fps: z.number().default(30),
  durationInFrames: z.number(),
  width: z.number().default(1080),
  height: z.number().default(1920),
  scenes: z.array(SceneSchema),
})

export type DynamicCompositionSchemaType = z.infer<typeof DynamicCompositionSchema>
export type SceneSchemaType = z.infer<typeof SceneSchema>
export type MediaNodeSchemaType = z.infer<typeof MediaNodeSchema>
export type TypographyNodeSchemaType = z.infer<typeof TypographyNodeSchema>
