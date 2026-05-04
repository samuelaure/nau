import path from 'path'
import { Module, ValidationPipe } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_PIPE, APP_GUARD } from '@nestjs/core'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { ServeStaticModule } from '@nestjs/serve-static'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { WorkersModule } from './workers/workers.module'
import { InspoModule } from './inspo/inspo.module'
import { IngestionModule } from './ingestion/ingestion.module'
import { ContentModule } from './content/content.module'
import { AnalyticsModule } from './analytics/analytics.module'
import { WorkspacesModule } from './workspaces/workspaces.module'
import { IntelligenceModule } from './intelligence/intelligence.module'
import { SchedulerModule } from './scheduler/scheduler.module'
import { BenchmarkModule } from './benchmark/benchmark.module'
import { ScrapingModule } from './scraping/scraping.module'
import { HealthController } from './health/health.controller'
import { AuthCallbackController } from './auth/auth-callback.controller'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'development'}.local`, `.env.${process.env.NODE_ENV ?? 'development'}`, '.env.local', '.env'],
    }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 20 },
      { name: 'medium', ttl: 60_000, limit: 200 },
    ]),
    ServeStaticModule.forRoot({
      rootPath: path.join(__dirname, '../../dashboard/dist'),
      exclude: ['/api/(.*)', '/health', '/auth/(.*)'],
    }),
    PrismaModule,
    AuthModule,
    WorkersModule,
    InspoModule,
    IngestionModule,
    ContentModule,
    AnalyticsModule,
    WorkspacesModule,
    IntelligenceModule,
    SchedulerModule,
    BenchmarkModule,
    ScrapingModule,
  ],
  controllers: [HealthController, AuthCallbackController],
  providers: [
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
