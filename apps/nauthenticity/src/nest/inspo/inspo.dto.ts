import { IsString, IsOptional, IsBoolean } from 'class-validator'

export class CreateInspoMembershipDto {
  // Exactly one of these must be set.
  @IsOptional()
  @IsString()
  socialProfileId?: string

  @IsOptional()
  @IsString()
  postId?: string
}

export class UpdateInspoMembershipDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}
