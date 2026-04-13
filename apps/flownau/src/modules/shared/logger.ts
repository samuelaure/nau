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
