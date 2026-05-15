import { Controller, Patch, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ServiceAuthGuard } from '../auth/service-auth.guard'

@Controller()
export class BrandSettingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Patch('_service/brands/:brandId/settings')
  @UseGuards(ServiceAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateSettings(
    @Param('brandId') brandId: string,
    @Body() body: { language?: string },
  ) {
    await this.prisma.brand.upsert({
      where: { id: brandId },
      create: { id: brandId, language: body.language ?? 'Spanish' },
      update: { ...(body.language !== undefined && { language: body.language }) },
    })
    return { success: true }
  }
}
