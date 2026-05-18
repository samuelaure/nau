import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common'
import { VoicenoteService } from './voicenote.service'
import { ServiceAuthGuard } from '../auth/service-auth.guard'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

@Controller()
export class VoicenoteController {
  constructor(private readonly voicenoteService: VoicenoteService) {}

  @Get('brands/:brandId/voicenotes')
  @UseGuards(JwtAuthGuard)
  listForBrand(@Param('brandId') brandId: string) {
    return this.voicenoteService.listForBrand(brandId)
  }

  @Get('voicenotes/:id')
  @UseGuards(JwtAuthGuard)
  getOne(@Param('id') id: string) {
    return this.voicenoteService.getOne(id)
  }

  @Post('_service/audio/process')
  @UseGuards(ServiceAuthGuard)
  async processAudio(@Body() body: { audioUrl: string; brandId?: string }) {
    return this.voicenoteService.processAudio(body.audioUrl, body.brandId)
  }

  @Post('_service/brands/:brandId/voicenotes')
  @UseGuards(ServiceAuthGuard)
  async createFromCapture(
    @Param('brandId') brandId: string,
    @Body() body: { cleanTranscription: string; synthesis: string; sourceRef?: string },
  ) {
    return this.voicenoteService.createFromCapture(brandId, body)
  }
}
