import { Controller, Get, Post, Patch, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common'
import { AnyAuthGuard } from '../auth/any-auth.guard'
import { BrandContextService, type GenerateSources } from './brand-context.service'

@Controller()
@UseGuards(AnyAuthGuard)
export class BrandContextController {
  constructor(private readonly brandContextService: BrandContextService) {}

  @Get('brands/:brandId/context')
  async getContext(@Param('brandId') brandId: string) {
    const ctx = await this.brandContextService.getContext(brandId)
    if (!ctx) return { status: 'none' }
    return ctx
  }

  @Post('brands/:brandId/context/generate')
  @HttpCode(HttpStatus.ACCEPTED)
  async generateContext(
    @Param('brandId') brandId: string,
    @Body() body: { sources?: Partial<GenerateSources> },
  ) {
    const sources: GenerateSources = {
      ownedProfile: body.sources?.ownedProfile ?? false,
      inspoBase: body.sources?.inspoBase ?? false,
      previousContext: body.sources?.previousContext ?? false,
      manual: body.sources?.manual ?? null,
    }
    await this.brandContextService.generateContext(brandId, sources)
    return { status: 'generating' }
  }

  @Patch('brands/:brandId/context')
  async saveContext(
    @Param('brandId') brandId: string,
    @Body() body: { content: string },
  ) {
    await this.brandContextService.saveContext(brandId, body.content)
    return { success: true }
  }
}
