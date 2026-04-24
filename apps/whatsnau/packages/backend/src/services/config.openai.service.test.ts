import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIConfigService } from './config.openai.service.js';
import { db } from '../core/db.js';
import { ValidationError, NotFoundError } from '../core/errors/AppError.js';
import OpenAI from 'openai';

// Mock dependencies
vi.mock('../core/db.js', () => ({
    db: {
        openAIConfig: {
            findFirst: vi.fn(),
            upsert: vi.fn(),
            findUnique: vi.fn(),
            delete: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        },
    },
}));

vi.mock('openai', () => {
    return {
        default: class MockOpenAI {
            models = { list: vi.fn().mockResolvedValue({}) };
            constructor(opts: any) { }
        }
    }
});

describe('OpenAIConfigService', () => {
    const mockTenantId = 'tenant-123';
    const mockConfigId = 'config-456';
    const validApiKey = 'sk-valid-api-key';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getConfig', () => {
        it('should return masked config if exists', async () => {
            (db.openAIConfig.findFirst as any).mockResolvedValue({
                id: mockConfigId,
                tenantId: mockTenantId,
                apiKey: validApiKey,
                primaryModel: 'gpt-4o',
                cheapModel: 'gpt-4o-mini',
                isDefault: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const result = await OpenAIConfigService.getConfig(mockTenantId);

            expect(result).not.toBeNull();
            expect(result?.apiKeyPreview).toBe('sk-vali...');
            expect(result?.hasApiKey).toBe(true);
        });

        it('should return null if not found', async () => {
            (db.openAIConfig.findFirst as any).mockResolvedValue(null);
            const result = await OpenAIConfigService.getConfig(mockTenantId);
            expect(result).toBeNull();
        });
    });

    describe('upsertConfig', () => {
        it('should throw ValidationError for invalid API key', async () => {
            await expect(
                OpenAIConfigService.upsertConfig(mockTenantId, { apiKey: 'invalid' })
            ).rejects.toThrow(ValidationError);
        });

        it('should update existing config', async () => {
            // Mock existing
            (db.openAIConfig.findFirst as any).mockResolvedValue({ id: mockConfigId });

            await OpenAIConfigService.upsertConfig(mockTenantId, { apiKey: validApiKey });

            expect(db.openAIConfig.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: mockConfigId },
                data: expect.objectContaining({ apiKey: validApiKey })
            }));
        });

        it('should create new config if none exists', async () => {
            (db.openAIConfig.findFirst as any).mockResolvedValue(null);

            await OpenAIConfigService.upsertConfig(mockTenantId, { apiKey: validApiKey });

            expect(db.openAIConfig.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    tenantId: mockTenantId,
                    apiKey: validApiKey,
                    isDefault: true
                })
            }));
        });
    });

    describe('deleteConfig', () => {
        it('should delete existing config', async () => {
            (db.openAIConfig.findUnique as any).mockResolvedValue({ id: mockConfigId, tenantId: mockTenantId });

            await OpenAIConfigService.deleteConfig(mockTenantId, mockConfigId);

            expect(db.openAIConfig.delete).toHaveBeenCalledWith({ where: { id: mockConfigId } });
        });

        it('should throw NotFoundError if config missing or belongs to other tenant', async () => {
            (db.openAIConfig.findUnique as any).mockResolvedValue(null);
            await expect(OpenAIConfigService.deleteConfig(mockTenantId, mockConfigId)).rejects.toThrow(NotFoundError);

            (db.openAIConfig.findUnique as any).mockResolvedValue({ id: mockConfigId, tenantId: 'other-tenant' });
            await expect(OpenAIConfigService.deleteConfig(mockTenantId, mockConfigId)).rejects.toThrow(NotFoundError);
        });
    });
});
