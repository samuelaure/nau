import pino from 'pino';
import { logStream } from './logStream.js';

const streams = [
  {
    level: (process.env.LOG_LEVEL as any) || 'info',
    stream: pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    }),
  },
  {
    level: (process.env.LOG_LEVEL as any) || 'info',
    stream: {
      write: (msg: string) => {
        try {
          const log = JSON.parse(msg);
          logStream.write(log);
        } catch (e) {
          // If not JSON (unlikely with pino), send as raw string
          logStream.write({ msg });
        }
      },
    },
  },
];

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
  },
  pino.multistream(streams)
);
