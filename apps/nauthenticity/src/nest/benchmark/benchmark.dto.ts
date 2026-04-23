import { IsString, IsOptional, IsBoolean } from 'class-validator'

export class GenerateCommentDto {
  @IsString()
  postUrl!: string

  @IsOptional()
  @IsString()
  postCaption?: string

  @IsOptional()
  @IsString()
  postTranscript?: string
}

export class CommentFeedbackDto {
  @IsString()
  postId!: string

  @IsString()
  commentText!: string

  @IsOptional()
  @IsBoolean()
  isSelected?: boolean
}
