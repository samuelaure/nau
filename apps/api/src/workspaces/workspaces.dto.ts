import { IsString, MinLength, IsOptional, IsIn } from 'class-validator';
import { WorkspaceRole } from '@prisma/client';

export class CreateWorkspaceDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}

export class AddMemberDto {
  @IsString()
  email!: string;

  @IsOptional()
  @IsIn(['OWNER', 'ADMIN', 'MEMBER'] satisfies WorkspaceRole[])
  role?: WorkspaceRole;
}
