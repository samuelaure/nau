export function renderBrandContextBlock(input: { name: string | null; context: unknown }): string {
  const name = input.name ? `Brand: ${input.name}` : null
  let body = typeof input.context === 'string' ? input.context.trim() : null
  // Unwrap legacy JSON-encoded string left by the Json→Text column migration
  if (body?.startsWith('"') && body.endsWith('"')) {
    try {
      body = (JSON.parse(body) as string).trim()
    } catch {}
  }

  if (!name && !body) return ''

  const lines = [name, body].filter(Boolean).join('\n')
  return `\nBRAND CONTEXT:\n${lines}\n`
}
