import { Request, Response } from 'express';
import { OpenAIConfigService } from '../services/config.openai.service.js';
import { AppError, ValidationError } from '../core/errors/AppError.js';
import { logger } from '../core/logger.js';

// GET /api/config/openai
export async function getOpenAIConfig(req: Request, res: Response) {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) throw new AppError('Unauthorized: Tenant ID missing', 401);

    const config = await OpenAIConfigService.getConfig(tenantId);
    res.json(config || { hasApiKey: false });
}

// POST /api/config/openai
export async function upsertOpenAIConfig(req: Request, res: Response) {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) throw new AppError('Unauthorized: Tenant ID missing', 401);

    const { apiKey, primaryModel, cheapModel } = req.body;

    // Validate input
    if (!apiKey) {
        throw new ValidationError('API key is required');
    }

    const config = await OpenAIConfigService.upsertConfig(tenantId, {
        apiKey,
        primaryModel,
        cheapModel,
    });

    logger.info({ tenantId, configId: config.id }, 'OpenAI config updated');
    res.json({ success: true, configId: config.id });
}

// DELETE /api/config/openai/:id
export async function deleteOpenAIConfig(req: Request, res: Response) {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) throw new AppError('Unauthorized: Tenant ID missing', 401);

    const { id } = req.params;

    await OpenAIConfigService.deleteConfig(tenantId, id as string);

    logger.info({ tenantId, configId: id }, 'OpenAI config deleted');
    res.json({ success: true });
}

// POST /api/config/openai/test
export async function testOpenAIApiKey(req: Request, res: Response) {
    const { apiKey } = req.body;
    if (!apiKey) throw new ValidationError('API key is required');

    const result = await OpenAIConfigService.testApiKey(apiKey);
    res.json(result);
}
