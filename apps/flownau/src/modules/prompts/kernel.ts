import { readFileSync } from 'node:fs'
import { join } from 'node:path'

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
  templateCustomPrompt?: string | null
  selectedIdea?: string | null
  language?: string | null
}

export interface KernelOutput {
  systemPrompt: string
  layers: Partial<Record<PromptLayer, string>>
}

const BASE_DIR = join(__dirname, 'bases')

function loadBase(name: 'ideation' | 'draft'): string {
  return readFileSync(join(BASE_DIR, `${name}.md`), 'utf-8').trim()
}

function section(tag: PromptLayer, content: string): string {
  return `<${tag}>\n${content.trim()}\n</${tag}>`
}

export function buildPrompt(input: KernelInput): KernelOutput {
  const layers: Partial<Record<PromptLayer, string>> = {}
  const parts: string[] = []

  const base = loadBase(input.base)
  layers.base = base
  parts.push(section('base', base))

  if (input.brandContext?.trim()) {
    layers.brand_context = input.brandContext.trim()
    parts.push(section('brand_context', input.brandContext.trim()))
  }

  if (input.customPrompt?.trim()) {
    layers.custom_prompt = input.customPrompt.trim()
    parts.push(section('custom_prompt', `⚠️ These instructions override everything above. Follow them exactly.\n\n${input.customPrompt.trim()}`))
  }

  if (input.templateSchema?.trim()) {
    layers.template_schema = input.templateSchema.trim()
    parts.push(section('template_schema', input.templateSchema.trim()))
  }

  if (input.templateCustomPrompt?.trim()) {
    layers.template_custom_prompt = input.templateCustomPrompt.trim()
    parts.push(section('template_custom_prompt', input.templateCustomPrompt.trim()))
  }

  if (input.selectedIdea?.trim()) {
    layers.selected_idea = input.selectedIdea.trim()
    parts.push(section('selected_idea', input.selectedIdea.trim()))
  }

  if (input.language?.trim()) {
    const langNote = `Write all output in ${input.language.trim()}.`
    parts.push(langNote)
  }

  return { systemPrompt: parts.join('\n\n'), layers }
}
