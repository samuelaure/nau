import { IsNotEmpty, IsString, IsObject, IsOptional } from 'class-validator';
import { CreateBlockDto as ICreateBlockDto } from '@nau/types';

export class CreateBlockDto implements ICreateBlockDto {
  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsString()
  @IsOptional()
  parentId?: string | null;

  @IsObject()
  properties!: Record<string, unknown>;

  @IsString()
  @IsOptional()
  workspaceId?: string;

  @IsString()
  @IsOptional()
  userId?: string;
}
