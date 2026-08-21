import { Module } from '@nestjs/common';
import { CapturesController } from './captures.controller';
import { CapturesService } from './captures.service';
import { BlocksModule } from '../blocks/blocks.module';
import { PrivateStorageService } from '../media/private-storage.service';

@Module({
  imports: [BlocksModule],
  controllers: [CapturesController],
  providers: [CapturesService, PrivateStorageService],
  exports: [CapturesService],
})
export class CapturesModule {}
