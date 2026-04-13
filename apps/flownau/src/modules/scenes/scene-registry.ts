import React from 'react'
import { z } from 'zod'
import type {
  VideoSceneType,
  ImageSceneType,
  AnySceneType,
  ResolvedScene,
  BrandStyle,
} from '@/types/scenes'
import {
  HookTextSlots,
  TextOverMediaSlots,
  QuoteCardSlots,
  ListRevealSlots,
  MediaOnlySlots,
  CTACardSlots,
  TransitionSlots,
  CoverSlideSlots,
  ContentSlideSlots,
  QuoteSlideSlots,
  ListSlideSlots,
  CTASlideSlots,
  getSceneCatalogEntry,
} from '@/types/scenes'

import { HookTextScene } from './video/HookTextScene'
import { TextOverMediaScene } from './video/TextOverMediaScene'
import { QuoteCardScene } from './video/QuoteCardScene'
import { ListRevealScene } from './video/ListRevealScene'
import { MediaOnlyScene } from './video/MediaOnlyScene'
import { CTACardScene } from './video/CTACardScene'
import { TransitionScene } from './video/TransitionScene'

import { CoverSlide } from './image/CoverSlide'
import { ContentSlide } from './image/ContentSlide'
import { QuoteSlide } from './image/QuoteSlide'
import { ListSlide } from './image/ListSlide'
import { CTASlide } from './image/CTASlide'

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
  format: 'video' | 'image'
  defaultDurationSec: number
  minDurationSec: number
  maxDurationSec: number
}

// ─── Registry Map ──────────────────────────────────────────────────

const REGISTRY: Record<AnySceneType, SceneRegistryEntry> = {
  // ─── Video Scenes ────────────────────────────────────────────
  'hook-text': {
    component: HookTextScene as unknown as React.FC<SceneComponentProps>,
    slotSchema: HookTextSlots,
    format: 'video',
    defaultDurationSec: 2,
    minDurationSec: 1,
    maxDurationSec: 4,
  },
  'text-over-media': {
    component: TextOverMediaScene as unknown as React.FC<SceneComponentProps>,
    slotSchema: TextOverMediaSlots,
    format: 'video',
    defaultDurationSec: 3,
    minDurationSec: 2,
    maxDurationSec: 6,
  },
  'quote-card': {
    component: QuoteCardScene as unknown as React.FC<SceneComponentProps>,
    slotSchema: QuoteCardSlots,
    format: 'video',
    defaultDurationSec: 3.5,
    minDurationSec: 2.5,
    maxDurationSec: 6,
  },
  'list-reveal': {
    component: ListRevealScene as unknown as React.FC<SceneComponentProps>,
    slotSchema: ListRevealSlots,
    format: 'video',
    defaultDurationSec: 4,
    minDurationSec: 3,
    maxDurationSec: 8,
  },
  'media-only': {
    component: MediaOnlyScene as unknown as React.FC<SceneComponentProps>,
    slotSchema: MediaOnlySlots,
    format: 'video',
    defaultDurationSec: 2,
    minDurationSec: 1,
    maxDurationSec: 5,
  },
  'cta-card': {
    component: CTACardScene as unknown as React.FC<SceneComponentProps>,
    slotSchema: CTACardSlots,
    format: 'video',
    defaultDurationSec: 2.5,
    minDurationSec: 2,
    maxDurationSec: 4,
  },
  transition: {
    component: TransitionScene as unknown as React.FC<SceneComponentProps>,
    slotSchema: TransitionSlots,
    format: 'video',
    defaultDurationSec: 0.5,
    minDurationSec: 0.3,
    maxDurationSec: 1.5,
  },
  // ─── Image Scenes ────────────────────────────────────────────
  'cover-slide': {
    component: CoverSlide as unknown as React.FC<SceneComponentProps>,
    slotSchema: CoverSlideSlots,
    format: 'image',
    defaultDurationSec: 0,
    minDurationSec: 0,
    maxDurationSec: 0,
  },
  'content-slide': {
    component: ContentSlide as unknown as React.FC<SceneComponentProps>,
    slotSchema: ContentSlideSlots,
    format: 'image',
    defaultDurationSec: 0,
    minDurationSec: 0,
    maxDurationSec: 0,
  },
  'quote-slide': {
    component: QuoteSlide as unknown as React.FC<SceneComponentProps>,
    slotSchema: QuoteSlideSlots,
    format: 'image',
    defaultDurationSec: 0,
    minDurationSec: 0,
    maxDurationSec: 0,
  },
  'list-slide': {
    component: ListSlide as unknown as React.FC<SceneComponentProps>,
    slotSchema: ListSlideSlots,
    format: 'image',
    defaultDurationSec: 0,
    minDurationSec: 0,
    maxDurationSec: 0,
  },
  'cta-slide': {
    component: CTASlide as unknown as React.FC<SceneComponentProps>,
    slotSchema: CTASlideSlots,
    format: 'image',
    defaultDurationSec: 0,
    minDurationSec: 0,
    maxDurationSec: 0,
  },
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * Get the Remotion component for a given scene type (video or image).
 */
export function getSceneComponent(type: AnySceneType): React.FC<SceneComponentProps> {
  const entry = REGISTRY[type]
  if (!entry) throw new Error(`[SceneRegistry] Unknown scene type: ${type}`)
  return entry.component
}

/**
 * Get the Zod slot validation schema for a scene type.
 */
export function getSceneSchema(type: AnySceneType): z.ZodSchema {
  const entry = REGISTRY[type]
  if (!entry) throw new Error(`[SceneRegistry] Unknown scene type: ${type}`)
  return entry.slotSchema
}

/**
 * Get duration defaults for a scene type.
 */
export function getSceneDefaults(type: AnySceneType): {
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
 * Get the format for a scene type.
 */
export function getSceneFormat(type: AnySceneType): 'video' | 'image' {
  const entry = REGISTRY[type]
  if (!entry) throw new Error(`[SceneRegistry] Unknown scene type: ${type}`)
  return entry.format
}

/**
 * Validates slots against the scene type's schema.
 * Returns parsed slots or throws ZodError.
 */
export function validateSceneSlots(
  type: AnySceneType,
  slots: Record<string, unknown>,
): Record<string, unknown> {
  const schema = getSceneSchema(type)
  return schema.parse(slots) as Record<string, unknown>
}
