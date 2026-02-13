import { db } from '../core/db.js';
import { AppError, ValidationError, NotFoundError } from '../core/errors/AppError.js';
import OpenAI from 'openai';

export class OpenAIConfigService {
    /**
     * Get tenant's OpenAI config (masked API key)
     */
    static async getConfig(tenantId: string) {
        const config = await db.openAIConfig.findFirst({
            where: { tenantId, isDefault: true },
        });
        if (!config) return null;

        return {
            id: config.id,
            primaryModel: config.primaryModel,
            cheapModel: config.cheapModel,
            isDefault: config.isDefault,
            hasApiKey: !!config.apiKey,
            apiKeyPreview: config.apiKey ? `${config.apiKey.substring(0, 7)}...` : null,
            createdAt: config.createdAt,
            updatedAt: config.updatedAt,
        };
    }

    /**
     * Create or update tenant's OpenAI config
     */
    static async upsertConfig(tenantId: string, data: {
        apiKey: string;
        primaryModel?: string;
        cheapModel?: string;
    }) {
        // Validate API key format (basic check)
        if (!data.apiKey.startsWith('sk-')) {
            throw new ValidationError('Invalid OpenAI API key format. Must start with sk-');
        }

        // Upsert config
        // Note: We only support ONE default config per tenant for now (isDefault=true)
        // The unique constraint is on [tenantId, isDefault] usually, or enforce logic here.
        // Schema likely has @@unique([tenantId, isDefault])?
        // Let's assume so or handle upsert logic carefully.

        // Check if exists first to get ID for update, or just use findFirst
        const existing = await db.openAIConfig.findFirst({
            where: { tenantId, isDefault: true }
        });

        if (existing) {
            return db.openAIConfig.update({
                where: { id: existing.id },
                data: {
                    apiKey: data.apiKey,
                    primaryModel: data.primaryModel || existing.primaryModel,
                    cheapModel: data.cheapModel || existing.cheapModel,
                }
            });
        } else {
            return db.openAIConfig.create({
                data: {
                    tenantId,
                    apiKey: data.apiKey,
                    primaryModel: data.primaryModel || 'gpt-4o',
                    cheapModel: data.cheapModel || 'gpt-4o-mini',
                    isDefault: true,
                }
            });
        }
    }

    /**
     * Delete tenant's OpenAI config
     */
    static async deleteConfig(tenantId: string, configId: string) {
        const config = await db.openAIConfig.findUnique({
            where: { id: configId },
        });

        if (!config || config.tenantId !== tenantId) {
            throw new NotFoundError('OpenAI config not found');
        }

        return db.openAIConfig.delete({ where: { id: configId } });
    }

    /**
     * Test API key validity
     */
    static async testApiKey(apiKey: string) {
        try {
            const client = new OpenAI({ apiKey });
            await client.models.list();
            return { valid: true };
        } catch (error: any) {
            return { valid: false, error: error.message };
        }
    }
}
