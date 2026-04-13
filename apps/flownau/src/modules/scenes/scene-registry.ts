import React from 'react'
import { z } from 'zod'
import type { VideoSceneType, ResolvedScene, BrandStyle } from '@/types/scenes'
import {
  HookTextSlots,
  TextOverMediaSlots,
  QuoteCardSlots,
  ListRevealSlots,
  MediaOnlySlots,
  CTACardSlots,
  TransitionSlots,
  getSceneCatalogEntry,
} from '@/types/scenes'

import { HookTextScene } from './video/HookTextScene'
import { TextOverMediaScene } from './video/TextOverMediaScene'
import { QuoteCardScene } from './video/QuoteCardScene'
import { ListRevealScene } from './video/ListRevealScene'
import { MediaOnlyScene } from './video/MediaOnlyScene'
import { CTACardScene } from './video/CTACardScene'
import { TransitionScene } from './video/TransitionScene'

// ─── Scene Component Props ─────────────────────────────────────────

export interface SceneComponentProps {
  slots: Record<string, unknown>
  brandStyle: BrandStyle
  asset: ResolvedScene['asset']
  handle?: string
}

// ─── Registry Types ────────────────────────────────────────────────

interface SceneRegistryEntry {
  component: React.FC<SceneComponentProps>
  slotSchema: z.ZodSchema
  defaultDurationSec: number
  minDurationSec: number
  maxDurationSec: number
}

// ─── Registry Map ──────────────────────────────────────────────────

const REGISTRY: Record<VideoSceneType, SceneRegistryEntry> = {
  'hook-text': {
    component: HookTextScene as unknown as React.FC<SceneComponentProps>,
    slotSchema: HookTextSlots,
    defaultDurationSec: 2,
    minDurationSec: 1,
    maxDurationSec: 4,
  },
  'text-over-media': {
    component: TextOverMediaScene as unknown as React.FC<SceneComponentProps>,
    slotSchema: TextOverMediaSlots,
    defaultDurationSec: 3,
    minDurationSec: 2,
    maxDurationSec: 6,
  },
  'quote-card': {
    component: QuoteCardScene as unknown as React.FC<SceneComponentProps>,
    slotSchema: QuoteCardSlots,
    defaultDurationSec: 3.5,
    minDurationSec: 2.5,
    maxDurationSec: 6,
  },
  'list-reveal': {
    component: ListRevealScene as unknown as React.FC<SceneComponentProps>,
    slotSchema: ListRevealSlots,
    defaultDurationSec: 4,
    minDurationSec: 3,
    maxDurationSec: 8,
  },
  'media-only': {
    component: MediaOnlyScene as unknown as React.FC<SceneComponentProps>,
    slotSchema: MediaOnlySlots,
    defaultDurationSec: 2,
    minDurationSec: 1,
    maxDurationSec: 5,
  },
  'cta-card': {
    component: CTACardScene as unknown as React.FC<SceneComponentProps>,
    slotSchema: CTACardSlots,
    defaultDurationSec: 2.5,
    minDurationSec: 2,
    maxDurationSec: 4,
  },
  transition: {
    component: TransitionScene as unknown as React.FC<SceneComponentProps>,
    slotSchema: TransitionSlots,
    defaultDurationSec: 0.5,
    minDurationSec: 0.3,
    maxDurationSec: 1.5,
  },
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * Get the Remotion component for a given scene type.
 */
export function getSceneComponent(type: VideoSceneType): React.FC<SceneComponentProps> {
  const entry = REGISTRY[type]
  if (!entry) throw new Error(`[SceneRegistry] Unknown scene type: ${type}`)
  return entry.component
}

/**
 * Get the Zod slot validation schema for a scene type.
 */
export function getSceneSchema(type: VideoSceneType): z.ZodSchema {
  const entry = REGISTRY[type]
  if (!entry) throw new Error(`[SceneRegistry] Unknown scene type: ${type}`)
  return entry.slotSchema
}

/**
 * Get duration defaults for a scene type.
 */
export function getSceneDefaults(type: VideoSceneType): {
  minDurationSec: number
  maxDurationSec: number
  defaultDurationSec: number
} {
  const entry = REGISTRY[type]
  if (!entry) throw new Error(`[SceneRegistry] Unknown scene type: ${type}`)
  return {
    minDurationSec: entry.minDurationSec,
    maxDurationSec: entry.maxDurationSec,
    defaultDurationSec: entry.defaultDurationSec,
  }
}

/**
 * Validates slots against the scene type's schema.
 * Returns parsed slots or throws ZodError.
 */
export function validateSceneSlots(type: VideoSceneType, slots: Record<string, unknown>): Record<string, unknown> {
  const schema = getSceneSchema(type)
  return schema.parse(slots) as Record<string, unknown>
}
