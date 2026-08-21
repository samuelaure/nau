import { Body, Controller, Post, UseGuards, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CapturesService } from './captures.service';
import { PrivateStorageService } from '../media/private-storage.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AccessTokenPayload } from '@nau/types';

class TextCaptureDto {
  text!: string;
  workspaceId?: string;
  capturedAt?: string;
}

class VoiceCaptureDto {
  audioKey!: string;
  workspaceId?: string;
  capturedAt?: string;
  source?: string;
}

class VoiceUploadUrlDto {
  mimeType?: string;
}

@Controller('captures')
@UseGuards(JwtAuthGuard)
export class CapturesController {
  constructor(
    private readonly captures: CapturesService,
    private readonly storage: PrivateStorageService,
  ) {}

  /**
   * Step 1 of a voice capture: a presigned URL into the private bucket. The
   * client PUTs the audio straight to R2, so recordings never travel through
   * this server and no bucket credential leaves it.
   */
  @Post('voice/upload-url')
  async voiceUploadUrl(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: VoiceUploadUrlDto,
  ) {
    const mimeType = dto.mimeType || 'audio/ogg';
    const ext = mimeType.split('/')[1]?.split(';')[0] || 'ogg';
    const key = `captures/${user.sub}/${randomUUID()}.${ext}`;

    const { uploadUrl, storageKey } = await this.storage.getUploadUrl(key, mimeType);
    return { uploadUrl, audioKey: storageKey };
  }

  /** Step 2: transcribe what was uploaded and file it as a journal entry. */
  @Post('voice')
  async voice(@CurrentUser() user: AccessTokenPayload, @Body() dto: VoiceCaptureDto) {
    if (!dto.audioKey) throw new BadRequestException('audioKey is required');
    return this.captures.captureVoice({
      audioKey: dto.audioKey,
      userId: user.sub,
      workspaceId: dto.workspaceId ?? user.workspaceId,
      capturedAt: dto.capturedAt,
      source: dto.source,
    });
  }

  @Post('text')
  async text(@CurrentUser() user: AccessTokenPayload, @Body() dto: TextCaptureDto) {
    return this.captures.captureText({
      text: dto.text,
      userId: user.sub,
      workspaceId: dto.workspaceId ?? user.workspaceId,
      capturedAt: dto.capturedAt,
    });
  }

  /** A time-limited link to replay a stored capture. */
  @Post('playback-url')
  async playbackUrl(@Body() dto: { audioKey?: string }) {
    if (!dto.audioKey) throw new BadRequestException('audioKey is required');
    return { url: await this.storage.getPlaybackUrl(dto.audioKey) };
  }
}
