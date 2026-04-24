import { IsString, IsEnum, IsOptional } from 'class-validator';
import { PromptOwnerType, PromptType } from '@prisma/client';

export class UpsertPromptDto {
  @IsEnum(PromptOwnerType)
  ownerType!: PromptOwnerType;

  @IsString()
  ownerId!: string;

  @IsEnum(PromptType)
  type!: PromptType;

  @IsString()
  body!: string;

  @IsOptional()
  @IsString()
  brandId?: string;
}

export class PromptFilterDto {
  @IsOptional()
  @IsEnum(PromptOwnerType)
  ownerType?: PromptOwnerType;

  @IsOptional()
  @IsString()
  ownerId?: string;
}
