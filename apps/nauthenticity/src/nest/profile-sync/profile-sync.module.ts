import { Module } from '@nestjs/common'
import { ProfileSyncController } from './profile-sync.controller'
import { ProfileSyncService } from './profile-sync.service'
import { PrismaModule } from '../prisma/prisma.module'
import { IngestionModule } from '../ingestion/ingestion.module'

@Module({
  imports: [PrismaModule, IngestionModule],
  controllers: [ProfileSyncController],
  providers: [ProfileSyncService],
})
export class ProfileSyncModule {}
