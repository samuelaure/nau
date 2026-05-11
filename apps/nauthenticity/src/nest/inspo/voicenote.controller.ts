import { Controller, Post, Body, Param, UseGuards } from '@nestjs/common'
import { VoicenoteService } from './voicenote.service'
import { ServiceAuthGuard } from '../auth/service-auth.guard'

@Controller('api/v1/_service')
@UseGuards(ServiceAuthGuard)
export class VoicenoteController {
  constructor(private readonly voicenoteService: VoicenoteService) {}

  @Post('audio/process')
  async processAudio(@Body() body: { audioUrl: string }) {
    return this.voicenoteService.processAudio(body.audioUrl)
  }

  @Post('brands/:brandId/voicenotes')
  async createFromCapture(
    @Param('brandId') brandId: string,
    @Body() body: { cleanTranscription: string; synthesis: string; sourceRef?: string },
  ) {
    return this.voicenoteService.createFromCapture(brandId, body)
  }
}
