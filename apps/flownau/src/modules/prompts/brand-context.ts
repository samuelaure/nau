// Brand context renderer.
// Renders Brand.context (BrandContext shape) into a prompt-ready block.
// PR 1: minimal renderer; full BrandContext rendering lands when nauthenticity ships the generator.

export interface BrandContext {
  identity?: { name?: string; oneLiner?: string; niche?: string }
  audience?: { description?: string; pains?: string[]; aspirations?: string[] }
  pillars?: Array<{ name: string; description?: string }>
  voice?: {
    descriptors?: string[]
    register?: 'casual' | 'mixed' | 'professional'
    energy?: 'calm' | 'measured' | 'high'
    pov?: 'first-person' | 'second-person' | 'third-person'
  }
  style?: {
    hookPatterns?: string[]
    signaturePhrases?: string[]
    emojiUse?: 'none' | 'sparing' | 'frequent'
    captionLengthPref?: 'short' | 'medium' | 'long'
  }
  doDont?: { do?: string[]; dont?: string[] }
  positioning?: { pov?: string; contrasts?: string[] }
}

export function renderBrandContextBlock(input: {
  name: string | null
  context: unknown
}): string {
  const lines: string[] = []
  if (input.name) lines.push(`Brand: ${input.name}`)

  const ctx = (input.context ?? null) as BrandContext | null
  if (ctx) {
    if (ctx.identity?.oneLiner) lines.push(`About: ${ctx.identity.oneLiner}`)
    if (ctx.identity?.niche) lines.push(`Niche: ${ctx.identity.niche}`)

    if (ctx.audience?.description) lines.push(`Audience: ${ctx.audience.description}`)
    if (ctx.audience?.pains?.length) lines.push(`Audience pains: ${ctx.audience.pains.join('; ')}`)
    if (ctx.audience?.aspirations?.length) lines.push(`Audience aspirations: ${ctx.audience.aspirations.join('; ')}`)

    if (ctx.pillars?.length) {
      const pillarList = ctx.pillars.map(p => p.description ? `${p.name} (${p.description})` : p.name).join('; ')
      lines.push(`Content pillars: ${pillarList}`)
    }

    if (ctx.voice) {
      const vBits: string[] = []
      if (ctx.voice.descriptors?.length) vBits.push(ctx.voice.descriptors.join(', '))
      if (ctx.voice.register) vBits.push(`register: ${ctx.voice.register}`)
      if (ctx.voice.energy) vBits.push(`energy: ${ctx.voice.energy}`)
      if (ctx.voice.pov) vBits.push(`POV: ${ctx.voice.pov}`)
      if (vBits.length) lines.push(`Voice: ${vBits.join(' · ')}`)
    }

    if (ctx.style) {
      if (ctx.style.hookPatterns?.length) lines.push(`Hook patterns: ${ctx.style.hookPatterns.join('; ')}`)
      if (ctx.style.signaturePhrases?.length) lines.push(`Signature phrases: ${ctx.style.signaturePhrases.join('; ')}`)
      if (ctx.style.emojiUse) lines.push(`Emoji use: ${ctx.style.emojiUse}`)
      if (ctx.style.captionLengthPref) lines.push(`Caption length: ${ctx.style.captionLengthPref}`)
    }

    if (ctx.doDont?.do?.length) lines.push(`Do: ${ctx.doDont.do.join('; ')}`)
    if (ctx.doDont?.dont?.length) lines.push(`Don't: ${ctx.doDont.dont.join('; ')}`)

    if (ctx.positioning?.pov) lines.push(`POV: ${ctx.positioning.pov}`)
    if (ctx.positioning?.contrasts?.length) lines.push(`Pushes back against: ${ctx.positioning.contrasts.join('; ')}`)
  }

  if (lines.length === 0) return ''
  return `\nBRAND CONTEXT:\n${lines.join('\n')}\n`
}
