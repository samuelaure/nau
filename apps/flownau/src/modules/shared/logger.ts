import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname',
    },
  },
})

export function logError(context: string, error: unknown, metadata?: any) {
  // Next.js redirect/notFound errors must propagate — never swallow them
  if (error instanceof Error && (error.message === 'NEXT_REDIRECT' || error.message === 'NEXT_NOT_FOUND')) {
    throw error
  }

  const fullMessage = error instanceof Error ? error.message : String(error)
  // Prisma errors embed huge multi-line diagnostics with Turbopack module paths.
  // Extract the human-readable summary line (e.g. "Unknown field `x` for select statement on model `Y`.")
  const summaryLine = fullMessage.split('\n').map((l) => l.trim()).find((l) => l.length > 0 && !l.startsWith('Invalid `') && !l.startsWith('at '))
  const message = summaryLine ?? fullMessage.split('\n').map((l) => l.trim()).find((l) => l.length > 0) ?? fullMessage

  // One most-relevant stack frame: prefer the first line that contains 'at async' and isn't node_modules or Next internals
  const stack = error instanceof Error && error.stack
    ? (() => {
        const frames = error.stack.split('\n').slice(1)
        const appFrame = frames.find(
          (l) => l.includes(' at ') && !l.includes('node_modules') && !l.includes('next/dist'),
        ) ?? frames[0]
        return appFrame ? '  ' + appFrame.trim() : ''
      })()
    : ''

  const meta = metadata ? ' ' + JSON.stringify(metadata) : ''
  const stackStr = stack ? '\n' + stack : ''

  logger.error(`[${context}] ${message}${meta}${stackStr}`)
}
