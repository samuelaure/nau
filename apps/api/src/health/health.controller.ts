import { Controller, Get } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

const { version } = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8')) as { version: string };

@Controller('health')
export class HealthController {
  private readonly startTime = Date.now();

  @Get()
  check() {
    return {
      status: 'ok',
      service: '9nau-api',
      version,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      timestamp: new Date().toISOString(),
    };
  }
}
