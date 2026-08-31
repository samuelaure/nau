import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EventsController],
  providers: [EventsService],
  // Exported so relations/gtd can reuse it as the movement log (nau#118)
  // rather than a second Event-shaped table for the same kind of row.
  exports: [EventsService],
})
export class EventsModule {}
