import { IsOptional, IsString } from 'class-validator';

export class FindBlocksQueryDto {
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  workspaceId?: string;

  /** Comma-separated list, for callers that need several types but not all. */
  @IsOptional()
  @IsString()
  types?: string;

  /** ISO date, inclusive. Filters on properties.date — the date the capture
   *  belongs to, which is not always the row's createdAt. */
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}
