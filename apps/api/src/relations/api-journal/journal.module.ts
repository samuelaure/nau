import { Module } from '@nestjs/common';
import { JournalService } from './journal.service';
import { JournalController } from './journal.controller';
import { JournalReadController } from './journal-read.controller';
import { JournalReadService } from './journal-read.service';
import { BlocksModule } from '../../blocks/blocks.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [BlocksModule, PrismaModule],
  controllers: [JournalController, JournalReadController],
  providers: [JournalService, JournalReadService],
  exports: [JournalService, JournalReadService],
})
export class JournalModule {}
