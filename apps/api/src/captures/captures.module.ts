import { Module } from '@nestjs/common';
import { CapturesController } from './captures.controller';
import { CapturesService } from './captures.service';
import { JournalModule } from '../journal/journal.module';
import { PrivateStorageService } from '../media/private-storage.service';

@Module({
  imports: [JournalModule],
  controllers: [CapturesController],
  providers: [CapturesService, PrivateStorageService],
  exports: [CapturesService],
})
export class CapturesModule {}
