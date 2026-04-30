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

  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined

  logger.error(
    {
      context,
      message,
      stack,
      ...metadata,
    },
    `[${context}] ${message}`,
  )
}
