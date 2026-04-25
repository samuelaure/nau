import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import helmet from 'helmet';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  // Enable graceful shutdown hooks (onModuleDestroy, onApplicationShutdown)
  app.enableShutdownHooks();
  app.use(helmet());
  app.use(cookieParser());

  const httpAdapter = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapter));

  const rawOrigins = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: rawOrigins.length > 0 ? rawOrigins : true,
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`9naŭ API listening on port ${port}`);
}
bootstrap();
