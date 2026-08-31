import { Module } from '@nestjs/common';
import { TriageService } from './triage.service';
import { TriageController } from './triage.controller';
import { BlocksModule } from '../blocks/blocks.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { PrismaModule } from '../prisma/prisma.module';
import { JournalModule } from '../relations/journal/journal.module';

@Module({
  imports: [BlocksModule, IntegrationsModule, PrismaModule, JournalModule],
  controllers: [TriageController],
  providers: [TriageService],
  exports: [TriageService],
})
export class TriageModule {}
