import pino, { Logger, LoggerOptions } from 'pino'

export interface NauLoggerOptions {
  service: string
  level?: string
}

export type NauLogger = Logger

export function createLogger(options: NauLoggerOptions): NauLogger {
  const pinoOptions: LoggerOptions = {
    level: options.level ?? process.env['LOG_LEVEL'] ?? (process.env['NODE_ENV'] === 'production' ? 'info' : 'debug'),
    base: { service: options.service },
    timestamp: pino.stdTimeFunctions.isoTime,
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
    },
    formatters: {
      level(label) {
        return { level: label }
      },
    },
  }

  return pino(pinoOptions)
}
