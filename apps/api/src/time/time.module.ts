import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BlocksModule } from '../blocks/blocks.module';
import { JournalModule } from '../relations/api-journal/journal.module';
import { TimeController } from './time.controller';
import { WorkspaceTimeService } from './workspace-time.service';
import { PlanningService } from './planning.service';
import { PeriodsService } from './periods.service';
import { SynthesisSchedulerService } from './synthesis-scheduler.service';
import { OccurrencesService } from './occurrences.service';

/**
 * Time: which periods exist, and when planned things occur.
 *
 * Replaces the former `schedule/` and `calendar/` modules. It depends on
 * Journal in one direction only — Time decides when a period closed and which
 * sources compose it, then hands Journal resolved ids. Journal knows nothing
 * about periods and must never query by date.
 */
@Module({
  imports: [PrismaModule, BlocksModule, JournalModule],
  controllers: [TimeController],
  providers: [
    WorkspaceTimeService,
    PlanningService,
    PeriodsService,
    OccurrencesService,
    SynthesisSchedulerService,
  ],
  exports: [WorkspaceTimeService, PlanningService, PeriodsService, OccurrencesService],
})
export class TimeModule {}
