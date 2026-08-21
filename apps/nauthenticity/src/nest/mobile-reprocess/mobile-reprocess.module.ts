import { Module } from '@nestjs/common';
import { MobileReprocessController } from './mobile-reprocess.controller';
import { MobileReprocessService } from './mobile-reprocess.service';

@Module({
  controllers: [MobileReprocessController],
  providers: [MobileReprocessService],
})
export class MobileReprocessModule {}
