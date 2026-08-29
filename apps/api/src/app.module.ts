import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_PIPE } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { CoreModule } from './core/core.module';
import { BlocksModule } from './blocks/blocks.module';
import { HealthModule } from './health/health.module';
import { RelationsModule } from './relations/relations.module';
import { EventsModule } from './events/events.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { SyncModule } from './sync/sync.module';
import { MediaModule } from './media/media.module';
import { TriageModule } from './triage/triage.module';
import { JournalModule } from './journal/journal.module';
import { AgendaModule } from './agenda/agenda.module';
import { TimeModule } from './time/time.module';
import { AuthModule } from './auth/auth.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { BrandsModule } from './brands/brands.module';
import { ProjectsModule } from './projects/projects.module';
import { SocialProfilesModule } from './social-profiles/social-profiles.module';
import { PromptsModule } from './prompts/prompts.module';
import { UsageModule } from './usage/usage.module';
import { TagsModule } from './tags/tags.module';
// Nest's cron scheduler. The alias it once needed is gone: the module that
// clashed with this name is now TimeModule, which is what it was always about.
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { CapturesModule } from './captures/captures.module';

@Module({
  imports: [
    CapturesModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'development'}.local`, `.env.${process.env.NODE_ENV ?? 'development'}`, '.env.local', '.env'],
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 20 },
      { name: 'medium', ttl: 60_000, limit: 200 },
    ]),
    PrismaModule,
    CoreModule,
    BlocksModule,
    HealthModule,
    RelationsModule,
    TimeModule,
    EventsModule,
    IntegrationsModule,
    SyncModule,
    MediaModule,
    TriageModule,
    JournalModule,
    AgendaModule,
    AuthModule,
    WorkspacesModule,
    BrandsModule,
    ProjectsModule,
    SocialProfilesModule,
    PromptsModule,
    UsageModule,
    TagsModule,
  ],
  providers: [
    {
      provide: APP_PIPE,
      // Strict deliberately. Registered bare, an unknown field in a payload was
      // accepted and ignored, so a client sending the wrong shape got a 2xx and
      // no indication anything was wrong — which is how client and server drift
      // apart without either side noticing.
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
