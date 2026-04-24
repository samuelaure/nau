import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateUsageEventDto {
  workspaceId: string;
  brandId?: string;
  userId?: string;
  service: string;
  operation: string;
  model?: string;
  provider?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  quantity?: number;
  unit?: string;
  costUsd?: number;
  metadata?: Record<string, unknown>;
}

export interface UsageSummaryParams {
  workspaceId?: string;
  brandId?: string;
  service?: string;
  fromDate?: Date;
  toDate?: Date;
}

@Injectable()
export class UsageService {
  constructor(private readonly prisma: PrismaService) {}

  async recordWithResolution(dto: CreateUsageEventDto) {
    let workspaceId = dto.workspaceId;
    if (!workspaceId && dto.brandId) {
      const brand = await this.prisma.brand.findUnique({
        where: { id: dto.brandId },
        select: { workspaceId: true },
      });
      workspaceId = brand?.workspaceId ?? 'unknown';
    }
    if (!workspaceId) workspaceId = 'unknown';
    return this.record({ ...dto, workspaceId });
  }

  async record(dto: CreateUsageEventDto) {
    return this.prisma.usageEvent.create({
      data: {
        workspaceId: dto.workspaceId,
        brandId: dto.brandId,
        userId: dto.userId,
        service: dto.service,
        operation: dto.operation,
        model: dto.model,
        provider: dto.provider,
        promptTokens: dto.promptTokens,
        completionTokens: dto.completionTokens,
        totalTokens: dto.totalTokens,
        quantity: dto.quantity,
        unit: dto.unit,
        costUsd: dto.costUsd,
        metadata: dto.metadata ?? {},
      },
    });
  }

  async recordBatch(events: CreateUsageEventDto[]) {
    return this.prisma.usageEvent.createMany({ data: events });
  }

  async getSummary(params: UsageSummaryParams) {
    const where: Record<string, unknown> = {};
    if (params.workspaceId) where.workspaceId = params.workspaceId;
    if (params.brandId) where.brandId = params.brandId;
    if (params.service) where.service = params.service;
    if (params.fromDate || params.toDate) {
      where.createdAt = {
        ...(params.fromDate ? { gte: params.fromDate } : {}),
        ...(params.toDate ? { lte: params.toDate } : {}),
      };
    }

    const events = await this.prisma.usageEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const totalCostUsd = events.reduce((sum, e) => sum + (e.costUsd ?? 0), 0);
    const totalTokens = events.reduce((sum, e) => sum + (e.totalTokens ?? 0), 0);

    const byService: Record<string, { count: number; costUsd: number; tokens: number }> = {};
    for (const e of events) {
      if (!byService[e.service]) byService[e.service] = { count: 0, costUsd: 0, tokens: 0 };
      byService[e.service].count++;
      byService[e.service].costUsd += e.costUsd ?? 0;
      byService[e.service].tokens += e.totalTokens ?? 0;
    }

    return {
      count: events.length,
      totalCostUsd: Math.round(totalCostUsd * 1_000_000) / 1_000_000,
      totalTokens,
      byService,
    };
  }
}
