import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JournalService } from './journal.service';
import { ServiceAuthGuard } from '../common/guards/service-auth.guard';
import type { GenerateSynthesisDto } from '@nau/types';
import type { SynthesisSourceKind } from '@nau/journal';

export class GenerateSynthesisBody implements GenerateSynthesisDto {
  workspaceId!: string;
  /** The period this synthesis belongs to. A label, never a query. */
  from!: string;
  to!: string;
  sourceKind!: SynthesisSourceKind;
  /** Resolved by Time. Journal reads these and nothing else. */
  sourceIds!: string[];
}

/**
 * Synthesis is asked for by the Time module, which is the only thing that knows
 * what a period is. There is no route here for a person to ask directly: a
 * human picking "summarise this range" is still choosing a period, and that
 * choice belongs on Time's side of the boundary — it resolves the range into
 * ids and calls this.
 */
@Controller('journal')
export class JournalController {
  constructor(private readonly journalService: JournalService) {}

  @Post('synthesis')
  @UseGuards(ServiceAuthGuard)
  async generateSynthesis(@Body() body: GenerateSynthesisBody) {
    return this.journalService.generateSynthesis({
      workspaceId: body.workspaceId,
      from: body.from,
      to: body.to,
      sourceKind: body.sourceKind,
      sourceIds: body.sourceIds ?? [],
    });
  }
}
