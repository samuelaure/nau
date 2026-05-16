export type PromptLayer =
  | 'base'
  | 'brand_context'
  | 'custom_prompt'
  | 'template_schema'
  | 'template_custom_prompt'
  | 'selected_idea'

export interface KernelInput {
  base: 'ideation' | 'draft'
  brandContext?: string | null
  customPrompt?: string | null
  templateSchema?: string | null
  brandTemplatePrompt?: string | null
  selectedIdea?: string | null
  language?: string | null
}

export interface KernelOutput {
  systemPrompt: string
  layers: Partial<Record<PromptLayer, string>>
}

// ─── Base prompts ─────────────────────────────────────────────────────────────

const IDEATION_BASE = `You are a content strategist generating ideas.

Resonance is the quality standard. Content resonates when it meets a person at the exact intersection of what they already feel, believe, or want to understand, and articulates it better than they could themselves. Everything downstream follows from resonance.

Three mechanisms drive resonance, each grounded in documented psychology:

- **Identity alignment** (Social Identity Theory, Tajfel & Turner) — content that expresses who a person is or what they stand for. The person is the subject; the brand is the author, never the protagonist.
- **Curiosity gap** (Information Gap Theory, Loewenstein, 1994) — curiosity is the felt distance between what someone knows and what they sense they should know. Ideas that name this gap precisely earn disproportionate attention.
- **Schema disruption** — expectations create cognitive demand when violated. Ideas that reframe something familiar produce the distinct satisfaction of a genuine perspective shift.

Quality criteria: a specific claim is more credible, more memorable, and more resonant than a general one — specificity signals real observation, not inference. A topic is not an idea; an idea commits to a position the audience can align with, reject, or be moved by. An idea that lands deeply for one person outweighs an idea that lands weakly for many.

Never generate ideas that could have been produced without knowing the specific brand and audience, ideas where the brand is the protagonist, or ideas that state a position but give the audience nothing to feel, question, or do with it.`

const DRAFT_BASE = `You are a short-form video script writer transforming a content idea into a script.

Resonance is the quality standard. Content resonates when it meets a person at the exact intersection of what they already feel, believe, or want to understand, and articulates it better than they could themselves.

The Elaboration Likelihood Model (Petty & Cacioppo, 1986) distinguishes two processing routes:
- The **peripheral route** is automatic and affect-driven — active before conscious evaluation begins, governed by emotional salience, novelty, or pattern violation.
- The **central route** is deliberate and argument-based — active once the audience is engaged enough to process substance. A script must engage the peripheral route to earn entry to the central route. 
Resonance operates at the central route through three mechanisms: identity expression (Social Identity Theory, Tajfel & Turner), dissonance resolution, and epistemic utility (Information Gap Theory, Loewenstein). Content that reaches neither route is processed and forgotten.

Quality criteria: concrete over abstract — a named example beats a category, specificity signals authenticity and aids recall. Write for one person; content addressed to everyone lands for no one. Every piece opens a tension and resolves it — the ending is the inevitable completion of what the opening began, not an appendage.

Never use @handles or social media usernames. Never restate the source idea verbatim.`

const BASES: Record<'ideation' | 'draft', string> = {
  ideation: IDEATION_BASE,
  draft: DRAFT_BASE,
}

// ─── Builder ──────────────────────────────────────────────────────────────────

const SECTION_DESCRIPTIONS: Partial<Record<PromptLayer, string>> = {
  brand_context: '`<brand_context>` — the brand identity: voice, audience, point of view. Write as this brand.',
  custom_prompt: '`<custom_prompt>` — standing brand-level instructions: angles, priorities, tone. Apply throughout.',
  template_schema: '`<template_schema>` — the output structure to fill. Slot constraints are binding.',
  template_custom_prompt: '`<template_custom_prompt>` — template-specific instructions for this brand. Takes precedence over `<custom_prompt>` for decisions within this format.',
  selected_idea: '`<selected_idea>` — the specific idea to develop into content.',
}

function buildStructureOverview(presentSections: PromptLayer[]): string {
  const lines = presentSections
    .filter((s) => SECTION_DESCRIPTIONS[s])
    .map((s) => `- ${SECTION_DESCRIPTIONS[s]}`)
  if (lines.length === 0) return ''
  return `## PROMPT STRUCTURE\n\nThis prompt is composed of layered sections. Read all before generating — later sections narrow and override earlier ones within their scope.\n\n${lines.join('\n')}`
}

function section(tag: PromptLayer, content: string): string {
  return `<${tag}>\n${content.trim()}\n</${tag}>`
}

export function buildPrompt(input: KernelInput): KernelOutput {
  const layers: Partial<Record<PromptLayer, string>> = {}
  const parts: string[] = []

  const presentSections: PromptLayer[] = []
  if (input.brandContext?.trim()) presentSections.push('brand_context')
  if (input.customPrompt?.trim()) presentSections.push('custom_prompt')
  if (input.templateSchema?.trim()) presentSections.push('template_schema')
  if (input.brandTemplatePrompt?.trim()) presentSections.push('template_custom_prompt')
  if (input.selectedIdea?.trim()) presentSections.push('selected_idea')

  const base = BASES[input.base]
  layers.base = base
  const structureOverview = buildStructureOverview(presentSections)
  parts.push(section('base', structureOverview ? `${base}\n\n${structureOverview}` : base))

  if (input.brandContext?.trim()) {
    layers.brand_context = input.brandContext.trim()
    parts.push(section('brand_context', input.brandContext.trim()))
  }

  if (input.customPrompt?.trim()) {
    layers.custom_prompt = input.customPrompt.trim()
    parts.push(section('custom_prompt', input.customPrompt.trim()))
  }

  if (input.templateSchema?.trim()) {
    layers.template_schema = input.templateSchema.trim()
    parts.push(section('template_schema', input.templateSchema.trim()))
  }

  if (input.brandTemplatePrompt?.trim()) {
    layers.template_custom_prompt = input.brandTemplatePrompt.trim()
    parts.push(section('template_custom_prompt', input.brandTemplatePrompt.trim()))
  }

  if (input.selectedIdea?.trim()) {
    layers.selected_idea = input.selectedIdea.trim()
    parts.push(section('selected_idea', input.selectedIdea.trim()))
  }

  parts.push(`## OUTPUT FORMATTING\n\nShort-form content is consumed vertically and fast. Avoid too long paragraphs and Separate every paragraph with a blank line (\\n\\n between paragraphs).`)

  if (input.language?.trim()) {
    parts.push(`Write all output in ${input.language.trim()}.`)
  }

  return { systemPrompt: parts.join('\n\n'), layers }
}
