import pino from 'pino';
import { logContextStorage } from './context';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = isDev
  ? pino(
      {
        level: process.env.LOG_LEVEL || 'info',
        mixin() {
          return logContextStorage.getStore() || {};
        },
      },
      pino.transport({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
          singleLine: false,
        },
      }),
    )
  : pino({
      level: process.env.LOG_LEVEL || 'info',
      mixin() {
        return logContextStorage.getStore() || {};
      },
    });
