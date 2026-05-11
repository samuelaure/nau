import { Controller, Param, Post, UseGuards } from '@nestjs/common'
import { ProfileSyncService } from './profile-sync.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

@Controller()
export class ProfileSyncController {
  constructor(private readonly svc: ProfileSyncService) {}

  @Post('social-profiles/:id/sync')
  @UseGuards(JwtAuthGuard)
  sync(@Param('id') id: string) {
    return this.svc.syncProfile(id)
  }
}
