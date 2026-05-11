import { Controller, Get } from '@nestjs/common'
import { version } from '../../../package.json'

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', service: 'nauthenticity', version }
  }
}
