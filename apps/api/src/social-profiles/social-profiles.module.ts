import { Module } from '@nestjs/common';
import { SocialProfilesController } from './social-profiles.controller';
import { SocialProfilesService } from './social-profiles.service';
import { BrandsModule } from '../brands/brands.module';

@Module({
  imports: [BrandsModule],
  controllers: [SocialProfilesController],
  providers: [SocialProfilesService],
  exports: [SocialProfilesService],
})
export class SocialProfilesModule {}
