import { Response } from 'express';
import { logger } from '../core/logger.js';
import { logStream } from '../core/logStream.js';

interface SSEClient {
  id: string;
  res: Response;
}

export class EventsService {
  private static clients: SSEClient[] = [];

  static {
    // Bridge internal logs to SSE
    logStream.subscribe((log) => {
      this.emit('log', log);
    });
  }

  static addClient(id: string, res: Response) {
    // 1. Initial setup for SSE - MUST happen before any logging or broadcasting
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // 2. Now it is safe to add to broadcast list and log
    this.clients.push({ id, res });
    logger.info({ clientId: id }, 'SSE Client connected');

    // 3. Heartbeat
    const heartbeat = setInterval(() => {
      res.write(':\n\n');
    }, 15000);

    res.on('close', () => {
      clearInterval(heartbeat);
      this.clients = this.clients.filter((c) => c.id !== id);
      logger.info({ clientId: id }, 'SSE Client disconnected');
    });
  }

  static emit(type: string, data: any) {
    logger.debug({ type }, 'Emitting SSE event');
    const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
    this.clients.forEach((client) => {
      client.res.write(payload);
    });
  }
}
