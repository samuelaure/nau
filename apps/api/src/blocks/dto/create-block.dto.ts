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

  /**
   * When it is due, set in the same request that creates it.
   *
   * Typing a line and scheduling it are one act from the person's side, and
   * splitting them into two calls made the keyboard flow lag and left a window
   * where a block existed but was due nowhere.
   */
  schedule?: {
    startDate: string;
    endDate?: string | null;
    rrule?: string | null;
    recurrenceMode?: 'FIXED' | 'AFTER_COMPLETION';
  };
}
