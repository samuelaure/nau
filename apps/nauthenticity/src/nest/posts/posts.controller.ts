import { Body, Controller, Post, UseGuards } from '@nestjs/common'
import { PostsService, PostSyncPayload } from './posts.service'
import { ServiceAuthGuard } from '../auth/service-auth.guard'

@Controller()
export class PostsController {
  constructor(private readonly svc: PostsService) {}

  @Post('_service/posts/sync')
  @UseGuards(ServiceAuthGuard)
  sync(@Body() body: PostSyncPayload) {
    return this.svc.syncPublishedPost(body)
  }
}
