import { IsString, IsOptional, IsUrl } from 'class-validator'

export class CreateInspoItemDto {
  @IsOptional()
  @IsUrl()
  sourceUrl?: string

  @IsString()
  type!: string

  @IsOptional()
  @IsString()
  note?: string
}

export class UpdateInspoItemDto {
  @IsOptional()
  @IsString()
  note?: string

  @IsOptional()
  @IsString()
  status?: string

  @IsOptional()
  @IsString()
  extractedHook?: string

  @IsOptional()
  @IsString()
  extractedTheme?: string
}
