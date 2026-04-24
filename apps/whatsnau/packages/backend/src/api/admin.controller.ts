import { Router } from 'express';
import { HealthCheck } from '../core/observability/HealthCheck.js';
import { db } from '../core/db.js';

const router = Router();

/**
 * GET /api/admin/health
 * Returns comprehensive system health status
 */
router.get('/health', async (req, res) => {
  try {
    const health = await HealthCheck.getSystemHealth();
    res.json(health);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get health status', message: error.message });
  }
});

/**
 * GET /api/admin/leads/:id/conversation
 * Returns full conversation history for a lead
 */
router.get('/leads/:id/conversation', async (req, res) => {
  try {
    const messages = await db.message.findMany({
      where: { leadId: req.params.id },
      orderBy: { timestamp: 'asc' },
      include: {
        lead: {
          select: {
            name: true,
            phoneNumber: true,
            state: true,
            status: true,
          },
        },
      },
    });

    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch conversation', message: error.message });
  }
});

/**
 * POST /api/admin/messages/:id/retry
 * Retry a failed message by re-queuing it
 */
router.post('/messages/:id/retry', async (req, res) => {
  try {
    const message = await db.message.findUnique({
      where: { id: req.params.id },
      include: { lead: true },
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Re-queue the message
    const { outboundQueue } = await import('../infrastructure/queues/outbound.queue.js');
    await outboundQueue.add('outbound-message', {
      campaignId: message.lead.campaignId,
      phoneNumber: message.lead.phoneNumber,
      type: 'text',
      payload: { body: message.content },
      messageId: message.id,
      leadId: message.leadId,
    });

    res.json({ success: true, message: 'Message queued for retry' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retry message', message: error.message });
  }
});

/**
 * GET /api/admin/alerts
 * Returns recent system alerts (paginated)
 */
router.get('/alerts', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 50;

    const [alerts, total] = await Promise.all([
      db.systemAlert.findMany({
        where: { resolved: false },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.systemAlert.count({ where: { resolved: false } }),
    ]);

    res.json({
      alerts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch alerts', message: error.message });
  }
});

/**
 * POST /api/admin/alerts/:id/resolve
 * Mark an alert as resolved
 */
router.post('/alerts/:id/resolve', async (req, res) => {
  try {
    await db.systemAlert.update({
      where: { id: req.params.id },
      data: { resolved: true, resolvedAt: new Date() },
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to resolve alert', message: error.message });
  }
});

/**
 * GET /api/admin/metrics
 * Returns performance metrics for the last 24 hours
 */
router.get('/metrics', async (req, res) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24h

    const metrics = await db.performanceMetric.groupBy({
      by: ['operation'],
      where: { createdAt: { gte: since } },
      _avg: { duration: true },
      _count: true,
      _max: { duration: true },
      _min: { duration: true },
    });

    // Calculate success rate per operation
    const metricsWithSuccessRate = await Promise.all(
      metrics.map(async (metric) => {
        const successCount = await db.performanceMetric.count({
          where: {
            operation: metric.operation,
            createdAt: { gte: since },
            success: true,
          },
        });

        return {
          operation: metric.operation,
          avgDuration: Math.round(metric._avg.duration || 0),
          maxDuration: metric._max.duration,
          minDuration: metric._min.duration,
          totalCalls: metric._count,
          successRate: ((successCount / metric._count) * 100).toFixed(2) + '%',
        };
      })
    );

    res.json({
      period: '24h',
      metrics: metricsWithSuccessRate,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch metrics', message: error.message });
  }
});

export default router;
