import { z } from 'zod'

export const SafeZoneEnum = z.enum(['top-third', 'center-safe', 'bottom-third'])

export const MediaNodeSchema = z.object({
  id: z.string(),
  type: z.literal('media'),
  assetUrl: z.string(), // Could be from DB asset, mapped to presigned URL
  startFrame: z.number(),
  durationInFrames: z.number(),
  mediaStartAt: z.number().default(0), // Offset in frames from the start of the source video
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

export const AudioNodeSchema = z.object({
  id: z.string(),
  type: z.literal('audio'),
  assetUrl: z.string(),
  startFrame: z.number(),
  durationInFrames: z.number(),
  volume: z.number().default(1),
})

export const DynamicCompositionSchema = z.object({
  _thought: z.string().optional(),
  format: z.enum(['reel', 'post', 'story']).default('reel'),
  fps: z.number().default(30),
  durationInFrames: z.number(),
  width: z.number().default(1080),
  height: z.number().default(1920),
  tracks: z.object({
    media: z.array(MediaNodeSchema).default([]),
    text: z.array(TypographyNodeSchema).default([]),
    audio: z.array(AudioNodeSchema).default([]),
  }),
})

export type DynamicCompositionSchemaType = z.infer<typeof DynamicCompositionSchema>
export type MediaNodeSchemaType = z.infer<typeof MediaNodeSchema>
export type TypographyNodeSchemaType = z.infer<typeof TypographyNodeSchema>
export type AudioNodeSchemaType = z.infer<typeof AudioNodeSchema>
