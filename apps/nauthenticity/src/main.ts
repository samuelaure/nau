import { NestFactory } from '@nestjs/core'
import { Logger } from '@nestjs/common'
import { AppModule } from './nest/app.module'

async function bootstrap() {
  const logger = new Logger('Bootstrap')
  const app = await NestFactory.create(AppModule)
  app.enableShutdownHooks()
  app.setGlobalPrefix('api/v1')

  const origins = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)

  app.enableCors({ origin: origins.length ? origins : '*', credentials: true })

  const port = process.env.PORT ?? 4000
  await app.listen(port)
  logger.log(`nauthenticity listening on port ${port}`)
}

bootstrap().catch((err: unknown) => {
  console.error('Failed to start nauthenticity:', err)
  process.exit(1)
})
