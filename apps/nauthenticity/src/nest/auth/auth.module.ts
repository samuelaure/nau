import { Module } from '@nestjs/common'
import { JwtAuthGuard } from './jwt-auth.guard'
import { ServiceAuthGuard } from './service-auth.guard'

@Module({
  providers: [JwtAuthGuard, ServiceAuthGuard],
  exports: [JwtAuthGuard, ServiceAuthGuard],
})
export class AuthModule {}
