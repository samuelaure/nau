import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ScopedPrismaService } from './scoped-prisma.service';
import type { PrismaService } from '../../prisma/prisma.service';

/**
 * The authorization half of the tenancy layer.
 *
 * These were previously two identical implementations on two unrelated
 * services, called by hand from roughly twenty places and covered by no test of
 * their own — the security decision with the widest blast radius in the api,
 * verified only incidentally through whatever called it.
 */
describe('ScopedPrismaService — authorization', () => {
  let findUniqueMember: jest.Mock;
  let findUniqueBlock: jest.Mock;
  let findManyMember: jest.Mock;
  let service: ScopedPrismaService;

  beforeEach(() => {
    findUniqueMember = jest.fn().mockResolvedValue({ id: 'm1', role: 'OWNER' });
    findUniqueBlock = jest
      .fn()
      .mockResolvedValue({ id: 'b1', workspaceId: 'ws-1', deletedAt: null });
    findManyMember = jest.fn().mockResolvedValue([{ workspaceId: 'ws-1' }]);

    service = new ScopedPrismaService({
      workspaceMember: { findUnique: findUniqueMember, findMany: findManyMember },
      block: { findUnique: findUniqueBlock },
    } as unknown as PrismaService);
  });

  describe('assertMembership', () => {
    it('returns the membership when the user belongs', async () => {
      await expect(service.assertMembership('u-1', 'ws-1')).resolves.toEqual({
        id: 'm1',
        role: 'OWNER',
      });
    });

    it('refuses a user who is not a member', async () => {
      findUniqueMember.mockResolvedValue(null);
      await expect(service.assertMembership('u-1', 'ws-other')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('assertBlockAccess', () => {
    it('returns the block when the caller is a member of its workspace', async () => {
      await expect(service.assertBlockAccess('u-1', 'b1')).resolves.toMatchObject({ id: 'b1' });
    });

    it('refuses a block in a workspace the caller does not belong to', async () => {
      findUniqueBlock.mockResolvedValue({ id: 'b1', workspaceId: 'ws-other', deletedAt: null });
      findUniqueMember.mockResolvedValue(null);
      await expect(service.assertBlockAccess('u-1', 'b1')).rejects.toThrow(ForbiddenException);
    });

    it('treats a missing block as not found', async () => {
      findUniqueBlock.mockResolvedValue(null);
      await expect(service.assertBlockAccess('u-1', 'nope')).rejects.toThrow(NotFoundException);
    });

    it('treats a soft-deleted block as not found', async () => {
      findUniqueBlock.mockResolvedValue({ id: 'b1', workspaceId: 'ws-1', deletedAt: new Date() });
      await expect(service.assertBlockAccess('u-1', 'b1')).rejects.toThrow(NotFoundException);
    });

    it('refuses a block with no workspace rather than treating it as public', async () => {
      // The column is still nullable (nau#67). Until it is tightened, a row
      // without a workspace must fail closed — it has no membership to check.
      findUniqueBlock.mockResolvedValue({ id: 'b1', workspaceId: null, deletedAt: null });
      await expect(service.assertBlockAccess('u-1', 'b1')).rejects.toThrow(ForbiddenException);
    });

    it('checks membership against the block, not against a caller-supplied id', async () => {
      // The point of loading the block first: the caller names a block, never
      // the workspace it is checked against.
      findUniqueBlock.mockResolvedValue({ id: 'b1', workspaceId: 'ws-9', deletedAt: null });
      await service.assertBlockAccess('u-1', 'b1');
      expect(findUniqueMember).toHaveBeenCalledWith({
        where: { userId_workspaceId: { userId: 'u-1', workspaceId: 'ws-9' } },
      });
    });
  });

  describe('memberWorkspaceIds', () => {
    it('lists every workspace the user belongs to', async () => {
      await expect(service.memberWorkspaceIds('u-1')).resolves.toEqual(['ws-1']);
    });
  });
});
