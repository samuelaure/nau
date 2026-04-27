import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../modules/shared/prisma';

export const dashboardController = async (fastify: FastifyInstance) => {
  // -------------------------------------------------------------------------
  // TARGETS UI ENDPOINTS
  // -------------------------------------------------------------------------
  fastify.get('/targets', async (request: FastifyRequest, reply: FastifyReply) => {
    const { brandId, monitoringType } = request.query as { brandId?: string; monitoringType?: string };
    if (!brandId) return reply.status(400).send({ error: 'Missing brandId' });

    const targets = await prisma.socialProfileMonitor.findMany({
      where: { brandId, monitoringType: monitoringType || undefined },
      include: {
        socialProfile: { include: { _count: { select: { posts: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send(targets);
  });

  fastify.patch('/targets/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { isActive, settings } = request.body as any;

    const dataToUpdate: any = {};
    if (isActive !== undefined) dataToUpdate.isActive = isActive;
    if (settings !== undefined) dataToUpdate.settings = settings;

    const updated = await prisma.socialProfileMonitor.update({
      where: { id },
      data: dataToUpdate,
    });
    return reply.send(updated);
  });
};
