export function renderBrandContextBlock(input: {
  name: string | null
  context: unknown
}): string {
  const name = input.name ? `Brand: ${input.name}` : null
  const body = typeof input.context === 'string' ? input.context.trim() : null

  if (!name && !body) return ''

  const lines = [name, body].filter(Boolean).join('\n')
  return `\nBRAND CONTEXT:\n${lines}\n`
}
