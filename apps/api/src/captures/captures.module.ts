import { Module } from '@nestjs/common';
import { CapturesController } from './captures.controller';
import { CapturesService } from './captures.service';
import { JournalModule } from '../relations/journal/journal.module';
import { PrivateStorageService } from '../core/storage/private-storage.service';

@Module({
  imports: [JournalModule],
  controllers: [CapturesController],
  providers: [CapturesService, PrivateStorageService],
  exports: [CapturesService],
})
export class CapturesModule {}
