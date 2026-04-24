import { Request, Response } from 'express';
import { db } from '../core/db.js';
import { logger } from '../core/logger.js';

export class ConfigController {
  /**
   * Get all takeover/reactivation keywords for a tenant.
   */
  static async getKeywords(req: Request, res: Response) {
    const { tenantId } = (req as any).user;
    try {
      const keywords = await (db as any).takeoverKeyword.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      });
      res.json(keywords);
    } catch (error) {
      logger.error({ error }, 'Failed to fetch keywords');
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Add a new keyword.
   */
  static async addKeyword(req: Request, res: Response) {
    const { tenantId } = (req as any).user;
    const { word, type, category } = req.body;

    if (!word) return res.status(400).json({ error: 'Word is required' });

    try {
      const keyword = await (db as any).takeoverKeyword.create({
        data: {
          word,
          type: type || 'INTERNAL',
          category: category || 'TAKEOVER',
          tenantId,
        },
      });
      res.status(201).json(keyword);
    } catch (error) {
      logger.error({ error }, 'Failed to add keyword');
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Delete a keyword.
   */
  static async deleteKeyword(req: Request, res: Response) {
    const { id } = req.params;
    const { tenantId } = (req as any).user;

    try {
      await (db as any).takeoverKeyword.delete({
        where: { id, tenantId },
      });
      res.status(204).send();
    } catch (error) {
      logger.error({ error }, 'Failed to delete keyword');
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get global config (including recovery timeout).
   */
  static async getConfig(req: Request, res: Response) {
    const { tenantId } = (req as any).user;
    try {
      const config = await (db as any).globalConfig.findUnique({
        where: { tenantId },
      });
      res.json(config);
    } catch (error) {
      logger.error({ error }, 'Failed to fetch global config');
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Update global config.
   */
  static async updateConfig(req: Request, res: Response) {
    const { tenantId } = (req as any).user;
    const { recoveryTimeoutMinutes, ownerName, availabilityStatus } = req.body;

    try {
      const config = await (db as any).globalConfig.upsert({
        where: { tenantId },
        update: {
          recoveryTimeoutMinutes,
          ownerName,
          availabilityStatus,
        },
        create: {
          id: `config-${tenantId}`,
          tenantId,
          recoveryTimeoutMinutes: recoveryTimeoutMinutes || 240,
          ownerName: ownerName || 'Owner',
        },
      });
      res.json(config);
    } catch (error) {
      logger.error({ error }, 'Failed to update global config');
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
