import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../modules/shared/prisma';

export const dashboardController = async (fastify: FastifyInstance) => {
  // -------------------------------------------------------------------------
  // MEMBERSHIPS UI ENDPOINTS (URL kept as `/targets`; param renamed to `category`)
  // -------------------------------------------------------------------------
  fastify.get('/targets', async (request: FastifyRequest, reply: FastifyReply) => {
    const { brandId, category } = request.query as { brandId?: string; category?: string };
    if (!brandId) return reply.status(400).send({ error: 'Missing brandId' });

    const memberships = await prisma.categoryMembership.findMany({
      where: {
        brandId,
        category: category || undefined,
        socialProfileId: { not: null },
      },
      include: {
        socialProfile: { include: { _count: { select: { posts: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send(memberships);
  });

  fastify.patch('/targets/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { isActive, category } = request.body as { isActive?: boolean; category?: string };

    const dataToUpdate: { isActive?: boolean; category?: string } = {};
    if (isActive !== undefined) dataToUpdate.isActive = isActive;
    if (category !== undefined) dataToUpdate.category = category;

    const updated = await prisma.categoryMembership.update({
      where: { id },
      data: dataToUpdate,
    });
    return reply.send(updated);
  });
};
