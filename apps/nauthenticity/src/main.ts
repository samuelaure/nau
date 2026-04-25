import { NestFactory, HttpAdapterHost } from '@nestjs/core'
import { Logger } from '@nestjs/common'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { AppModule } from './nest/app.module'
import { AllExceptionsFilter } from './nest/common/filters/all-exceptions.filter'

async function bootstrap() {
  const logger = new Logger('Bootstrap')
  const app = await NestFactory.create(AppModule)
  app.enableShutdownHooks()
  app.use(helmet())
  app.use(cookieParser())
  app.setGlobalPrefix('api/v1', { exclude: ['health'] })

  const httpAdapter = app.get(HttpAdapterHost)
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapter))

  const origins = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)

  if (origins.length === 0) throw new Error('ALLOWED_ORIGINS environment variable is required')
  app.enableCors({ origin: origins, credentials: true })

  const port = process.env.PORT ?? 3000
  await app.listen(port)
  logger.log(`nauthenticity listening on port ${port}`)
}

bootstrap().catch((err: unknown) => {
  console.error('Failed to start nauthenticity:', err)
  process.exit(1)
})
