import { Injectable, ForbiddenException } from '@nestjs/common';
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

  async assertAdmin(userId: string): Promise<void> {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) throw new ForbiddenException('Admin access required');
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user || user.email !== adminEmail) throw new ForbiddenException('Admin access required');
  }

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
        metadata: (dto.metadata ?? {}) as any,
      },
    });
  }

  async recordBatch(events: CreateUsageEventDto[]) {
    return this.prisma.usageEvent.createMany({ data: events as any });
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

    type Bucket = { count: number; costUsd: number; tokens: number };
    const makeBucket = (): Bucket => ({ count: 0, costUsd: 0, tokens: 0 });

    const byService: Record<string, Bucket> = {};
    const byWorkspace: Record<string, Bucket> = {};
    const byBrand: Record<string, Bucket> = {};
    const byUser: Record<string, Bucket> = {};
    const byOperation: Record<string, Bucket> = {};

    for (const e of events) {
      const add = (map: Record<string, Bucket>, key: string) => {
        if (!map[key]) map[key] = makeBucket();
        map[key].count++;
        map[key].costUsd += e.costUsd ?? 0;
        map[key].tokens += e.totalTokens ?? 0;
      };
      add(byService, e.service);
      add(byWorkspace, e.workspaceId);
      add(byOperation, e.operation);
      if (e.brandId) add(byBrand, e.brandId);
      if (e.userId) add(byUser, e.userId);
    }

    // Resolve names for known IDs
    const brandIds = Object.keys(byBrand).filter(Boolean);
    const workspaceIds = Object.keys(byWorkspace).filter((id) => id !== 'unknown' && id !== '');
    const userIds = Object.keys(byUser).filter(Boolean);

    const [brands, workspaces, users] = await Promise.all([
      brandIds.length > 0
        ? this.prisma.brand.findMany({ where: { id: { in: brandIds } }, select: { id: true, name: true, workspaceId: true } })
        : [],
      workspaceIds.length > 0
        ? this.prisma.workspace.findMany({ where: { id: { in: workspaceIds } }, select: { id: true, name: true } })
        : [],
      userIds.length > 0
        ? this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
        : [],
    ]);

    const brandMap = Object.fromEntries(brands.map((b) => [b.id, { name: b.name, workspaceId: b.workspaceId }]));
    const workspaceMap = Object.fromEntries(workspaces.map((w) => [w.id, w.name]));
    const userMap = Object.fromEntries(users.map((u) => [u.id, u.name ?? u.email]));

    const round = (n: number) => Math.round(n * 1_000_000) / 1_000_000;

    return {
      count: events.length,
      totalCostUsd: round(totalCostUsd),
      totalTokens,
      byService: Object.entries(byService).map(([service, b]) => ({ service, ...b, costUsd: round(b.costUsd) })),
      byOperation: Object.entries(byOperation).map(([operation, b]) => ({ operation, ...b, costUsd: round(b.costUsd) })),
      byWorkspace: Object.entries(byWorkspace).map(([id, b]) => ({ id, name: workspaceMap[id] ?? id, ...b, costUsd: round(b.costUsd) })),
      byBrand: Object.entries(byBrand).map(([id, b]) => ({ id, name: brandMap[id]?.name ?? id, workspaceId: brandMap[id]?.workspaceId, ...b, costUsd: round(b.costUsd) })),
      byUser: Object.entries(byUser).map(([id, b]) => ({ id, name: userMap[id] ?? id, ...b, costUsd: round(b.costUsd) })),
    };
  }
}
