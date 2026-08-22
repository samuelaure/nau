import { Module } from '@nestjs/common';
import { JournalService } from './journal.service';
import { ActivityService } from './activity.service';
import { JournalController } from './journal.controller';
import { BlocksModule } from '../blocks/blocks.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [BlocksModule, PrismaModule],
  controllers: [JournalController],
  providers: [JournalService, ActivityService],
  exports: [JournalService, ActivityService],
})
export class JournalModule {}
