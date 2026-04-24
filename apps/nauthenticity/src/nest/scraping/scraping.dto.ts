import { IsString, IsOptional, IsArray, IsInt, Min, Max, ArrayMinSize } from 'class-validator'

export class StartScrapingDto {
  @IsString()
  brandId!: string

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  targets!: string[]

  @IsOptional()
  @IsString()
  platform?: string

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(500)
  limit?: number
}

export class IngestPostsDto {
  @IsString()
  runId!: string

  @IsArray()
  posts!: Array<{
    id: string
    url?: string
    username?: string
    caption?: string
    postedAt?: string
    likes?: number
    comments?: number
    views?: number
    platform?: string
  }>
}
