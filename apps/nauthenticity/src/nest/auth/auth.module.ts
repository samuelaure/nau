import { Module } from '@nestjs/common'
import { JwtAuthGuard } from './jwt-auth.guard'
import { ServiceAuthGuard } from './service-auth.guard'
import { AnyAuthGuard } from './any-auth.guard'

@Module({
  providers: [JwtAuthGuard, ServiceAuthGuard, AnyAuthGuard],
  exports: [JwtAuthGuard, ServiceAuthGuard, AnyAuthGuard],
})
export class AuthModule {}
