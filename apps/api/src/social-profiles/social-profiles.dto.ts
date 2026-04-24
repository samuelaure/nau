import { IsString, IsEnum, IsOptional } from 'class-validator';
import { SocialPlatform, SocialProfileRole } from '@prisma/client';

export class CreateSocialProfileDto {
  @IsEnum(SocialPlatform)
  platform!: SocialPlatform;

  @IsString()
  platformId!: string;

  @IsString()
  handle!: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsEnum(SocialProfileRole)
  role!: SocialProfileRole;
}

export class UpdateSocialProfileDto {
  @IsOptional()
  @IsString()
  handle?: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsEnum(SocialProfileRole)
  role?: SocialProfileRole;
}
