import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  isWorkspaceOwned,
  scopedWhere,
  scopedData,
  READ_AND_MUTATE_OPERATIONS,
} from './workspace-scope';

/** A Prisma client whose every query is confined to one workspace. */
export type ScopedPrismaClient = ReturnType<ScopedPrismaService['forWorkspace']>;

/**
 * The single place workspace isolation is enforced.
 *
 * Two things were true before this existed, both of which it replaces:
 *
 *   1. Membership was asserted by hand in each service, in two different
 *      implementations of the same check. Two implementations of one security
 *      decision will eventually disagree, and only one of them will be audited
 *      when it matters.
 *   2. Scoping was the caller's responsibility. Isolation therefore held only
 *      as long as every caller remembered — including callers written later, by
 *      someone reading a service that happened not to show the pattern.
 *
 * Here the scope is applied by the client, so a query that crosses a workspace
 * cannot be expressed by accident. Crossing deliberately means calling
 * `unscoped()`, which reads as what it is.
 */
@Injectable()
export class ScopedPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Confirms the user belongs to the workspace.
   *
   * The one implementation. Called by `forUser` rather than by services, so
   * that forgetting it is not among the things a service can do.
   */
  async assertMembership(userId: string, workspaceId: string) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
    });
    if (!member) throw new ForbiddenException('Not a member of this workspace');
    return member;
  }

  /** Asserts membership, then returns a client scoped to that workspace. */
  async forUser(userId: string, workspaceId: string) {
    await this.assertMembership(userId, workspaceId);
    return this.forWorkspace(workspaceId);
  }

  /** Every workspace the user belongs to. */
  async memberWorkspaceIds(userId: string): Promise<string[]> {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      select: { workspaceId: true },
    });
    return memberships.map((m) => m.workspaceId);
  }

  /**
   * Loads a block only if the caller is a member of its workspace.
   *
   * Lives here rather than on the service that owns blocks because it is an
   * authorization decision, not a block operation — and because four separate
   * services were calling it across a module boundary purely to get at the
   * check. A block is reachable by id otherwise, and blocks carry personal
   * journal content.
   *
   * This is the transitional shape. Once every caller holds a scoped client the
   * check becomes unnecessary — a query that cannot leave the workspace cannot
   * load a block from another one — and this method goes with them. It exists
   * so that the callers can stop importing the blocks module *now*, without
   * waiting for each of their own rebuilds.
   */
  async assertBlockAccess(userId: string, blockId: string) {
    const block = await this.prisma.block.findUnique({ where: { id: blockId } });
    if (!block || block.deletedAt) {
      throw new NotFoundException(`Block with ID ${blockId} not found`);
    }
    if (!block.workspaceId) throw new ForbiddenException('Block has no workspace');
    await this.assertMembership(userId, block.workspaceId);
    return block;
  }

  /**
   * A client confined to one workspace.
   *
   * Membership is *not* checked here — this is the trusted path used once
   * membership is already established, and by service-to-service callers acting
   * on a workspace's behalf without a user. Prefer `forUser` wherever a user is
   * present.
   */
  forWorkspace(workspaceId: string) {
    return this.prisma.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            if (!isWorkspaceOwned(model)) return query(args);

            const shaped = args as Record<string, unknown>;

            if (
              (READ_AND_MUTATE_OPERATIONS as readonly string[]).includes(operation) &&
              'where' in shaped
            ) {
              shaped.where = scopedWhere(
                shaped.where as Record<string, unknown> | undefined,
                workspaceId,
                operation,
              );
            } else if (
              (READ_AND_MUTATE_OPERATIONS as readonly string[]).includes(operation)
            ) {
              shaped.where = scopedWhere(undefined, workspaceId, operation);
            }

            if ((operation === 'create' || operation === 'createMany') && 'data' in shaped) {
              shaped.data = scopedData(
                shaped.data as Record<string, unknown>,
                workspaceId,
              );
            }

            if (operation === 'upsert' && 'create' in shaped) {
              shaped.create = scopedData(
                shaped.create as Record<string, unknown>,
                workspaceId,
              );
            }

            return query(shaped);
          },
        },
      },
    });
  }

  /**
   * The unscoped client, for the few places that legitimately see across
   * workspaces: authentication, workspace administration, cron sweeps.
   *
   * Named so that its use is visible in review and greppable in audit. It must
   * never appear inside a relation — the boundary test enforces where Prisma
   * may be injected at all, and this is the escape hatch that the enforcement
   * is designed to make conspicuous rather than impossible.
   */
  unscoped(): PrismaService {
    return this.prisma;
  }
}
