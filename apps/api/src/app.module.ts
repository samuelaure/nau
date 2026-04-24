import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_PIPE } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { BlocksModule } from './blocks/blocks.module';
import { HealthModule } from './health/health.module';
import { RelationsModule } from './relations/relations.module';
import { ScheduleModule } from './schedule/schedule.module';
import { EventsModule } from './events/events.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { SyncModule } from './sync/sync.module';
import { MediaModule } from './media/media.module';
import { TriageModule } from './triage/triage.module';
import { JournalModule } from './journal/journal.module';
import { AuthModule } from './auth/auth.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { BrandsModule } from './brands/brands.module';
import { SocialProfilesModule } from './social-profiles/social-profiles.module';
import { PromptsModule } from './prompts/prompts.module';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'development'}.local`, `.env.${process.env.NODE_ENV ?? 'development'}`, '.env.local', '.env'],
    }),
    NestScheduleModule.forRoot(),
    PrismaModule,
    BlocksModule,
    HealthModule,
    RelationsModule,
    ScheduleModule,
    EventsModule,
    IntegrationsModule,
    SyncModule,
    MediaModule,
    TriageModule,
    JournalModule,
    AuthModule,
    WorkspacesModule,
    BrandsModule,
    SocialProfilesModule,
    PromptsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
  ],
})
export class AppModule {}
