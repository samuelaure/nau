import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { MessageRouter } from '../orchestration/MessageRouter.js';
import { db } from '../db.js';
import { LeadService } from '../../services/lead.service.js';

vi.mock('../../services/lead.service.js', () => ({
    LeadService: {
        initiateLead: vi.fn(),
    },
}));

// Mock dependencies
vi.mock('../db.js', () => ({
    db: {
        whatsAppConfig: {
            findUnique: vi.fn(),
        },
        lead: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        },
        message: {
            create: vi.fn(),
            update: vi.fn(),
            upsert: vi.fn(),
            findUnique: vi.fn(),
        },
        campaign: {
            findFirst: vi.fn(),
        },
        takeoverKeyword: {
            findMany: vi.fn(),
        },
        globalConfig: {
            findUnique: vi.fn(),
        },
    },
}));

describe('MessageRouter', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Tenant Resolution', () => {
        it('should resolve tenant from phoneNumberId', async () => {
            const mockConfig = {
                id: 'config-123',
                phoneNumberId: 'phone-123',
                tenantId: 'tenant-123',
            };

            vi.mocked(db.whatsAppConfig.findUnique).mockResolvedValue(mockConfig as any);

            const tenantId = await MessageRouter.resolveTenantId('phone-123');

            expect(tenantId).toBe('tenant-123');
            expect(db.whatsAppConfig.findUnique).toHaveBeenCalledWith({
                where: { phoneNumberId: 'phone-123' },
                select: { tenantId: true },
            });
        });

        it('should return null if phoneNumberId not found', async () => {
            vi.mocked(db.whatsAppConfig.findUnique).mockResolvedValue(null);

            const tenantId = await MessageRouter.resolveTenantId('invalid-phone');

            expect(tenantId).toBeUndefined();
        });

        it('should handle database errors gracefully', async () => {
            vi.mocked(db.whatsAppConfig.findUnique).mockRejectedValue(new Error('DB error'));

            const tenantId = await MessageRouter.resolveTenantId('phone-123');

            expect(tenantId).toBeUndefined();
        });
    });

    describe('Lead Lookup and Creation', () => {
        const mockTenantId = 'tenant-123';
        const mockPhoneNumber = '+1234567890';

        it('should find existing lead', async () => {
            const mockLead = {
                id: 'lead-123',
                phoneNumber: mockPhoneNumber,
                tenantId: mockTenantId,
                campaignId: 'campaign-123',
            };

            vi.mocked(db.lead.findUnique).mockResolvedValue(mockLead as any);

            const lead = await MessageRouter.findOrInitializeLead(mockPhoneNumber, mockTenantId);

            expect(lead).toEqual(mockLead);
            expect(db.lead.findUnique).toHaveBeenCalledWith({
                where: {
                    tenantId_phoneNumber: {
                        tenantId: mockTenantId,
                        phoneNumber: mockPhoneNumber,
                    },
                },
                include: expect.any(Object),
            });
        });

        it('should create new lead if not found', async () => {
            const mockCampaign = { id: 'campaign-123' };
            const mockNewLead = {
                id: 'lead-new',
                phoneNumber: mockPhoneNumber,
                tenantId: mockTenantId,
                campaignId: 'campaign-123',
            };

            vi.mocked(db.lead.findUnique).mockResolvedValue(null);
            vi.mocked(db.campaign.findFirst).mockResolvedValue(mockCampaign as any);
            vi.mocked(LeadService.initiateLead).mockResolvedValue(mockNewLead as any);
            // Mock the second findUnique call after initiation
            vi.mocked(db.lead.findUnique)
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(mockNewLead as any);

            const lead = await MessageRouter.findOrInitializeLead(mockPhoneNumber, mockTenantId);

            expect(lead).toEqual(mockNewLead);
            expect(LeadService.initiateLead).toHaveBeenCalled();
        });

        it('should handle multi-tenant isolation', async () => {
            const tenant1Lead = {
                id: 'lead-tenant1',
                phoneNumber: mockPhoneNumber,
                tenantId: 'tenant-1',
            };

            const tenant2Lead = {
                id: 'lead-tenant2',
                phoneNumber: mockPhoneNumber,
                tenantId: 'tenant-2',
            };

            // Same phone number, different tenants
            vi.mocked(db.lead.findUnique)
                .mockResolvedValueOnce(tenant1Lead as any)
                .mockResolvedValueOnce(tenant2Lead as any);

            const lead1 = await MessageRouter.findOrInitializeLead(mockPhoneNumber, 'tenant-1');
            const lead2 = await MessageRouter.findOrInitializeLead(mockPhoneNumber, 'tenant-2');

            expect(lead1?.id).toBe('lead-tenant1');
            expect(lead2?.id).toBe('lead-tenant2');
            expect(lead1?.id).not.toBe(lead2?.id);
        });

        it('should return null if tenant not found', async () => {
            const lead = await MessageRouter.findOrInitializeLead(mockPhoneNumber, null as any);

            expect(lead).toBeUndefined();
        });
    });

    describe('Message Persistence', () => {
        it('should persist inbound message', async () => {
            const mockMessage = {
                id: 'msg-123',
                leadId: 'lead-123',
                direction: 'INBOUND',
                content: 'Hello',
                whatsappId: 'wa-msg-123',
            };

            vi.mocked(db.message.upsert).mockResolvedValue(mockMessage as any);

            await MessageRouter.persistMessage({
                leadId: 'lead-123',
                direction: 'INBOUND',
                content: 'Hello',
                whatsappId: 'wa-msg-123',
                type: 'TEXT',
            });

            expect(db.message.upsert).toHaveBeenCalledWith({
                where: { whatsappId: 'wa-msg-123' },
                create: expect.objectContaining({
                    leadId: 'lead-123',
                    direction: 'INBOUND',
                    content: 'Hello',
                    whatsappId: 'wa-msg-123',
                    type: 'TEXT',
                }),
                update: expect.any(Object),
            });
        });

        it('should handle duplicate whatsappId (idempotency)', async () => {
            const duplicateError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
                code: 'P2002',
                clientVersion: 'test'
            });

            vi.mocked(db.message.upsert).mockRejectedValue(duplicateError);

            // Should not throw
            await expect(
                MessageRouter.persistMessage({
                    leadId: 'lead-123',
                    direction: 'INBOUND',
                    content: 'Hello',
                    whatsappId: 'wa-msg-123',
                    type: 'TEXT',
                })
            ).resolves.not.toThrow();
        });

        it('should persist outbound message', async () => {
            const mockMessage = {
                id: 'msg-456',
                leadId: 'lead-123',
                direction: 'OUTBOUND',
                content: 'Response',
                aiGenerated: true,
            };

            vi.mocked(db.message.upsert).mockResolvedValue(mockMessage as any);

            await MessageRouter.persistMessage({
                leadId: 'lead-123',
                direction: 'OUTBOUND',
                content: 'Response',
                type: 'TEXT',
                aiGenerated: true,
            });

            expect(db.message.upsert).toHaveBeenCalledWith({
                where: expect.any(Object),
                create: expect.objectContaining({
                    direction: 'OUTBOUND',
                    aiGenerated: true,
                }),
                update: expect.any(Object),
            });
        });
    });

    describe('Outbound Takeover Detection', () => {
        it('should detect manual takeover from owner', async () => {
            const mockLead = {
                id: 'lead-123',
                aiEnabled: true,
                status: 'ACTIVE',
                tenantId: 'tenant-123',
            };

            vi.mocked(db.message.findUnique).mockResolvedValue(null);
            vi.mocked(db.takeoverKeyword.findMany).mockResolvedValue([]);
            vi.mocked(db.lead.update).mockResolvedValue(mockLead as any);
            vi.mocked(db.globalConfig.findUnique).mockResolvedValue({
                recoveryTimeoutMinutes: 60,
            } as any);

            await MessageRouter.handleOutboundTakeover(
                mockLead as any,
                'wa-msg-123',
                'Manual message from owner'
            );

            expect(db.lead.update).toHaveBeenCalledWith({
                where: { id: 'lead-123' },
                data: {
                    status: 'HANDOVER',
                },
            });
        });

        it('should not trigger takeover if already in handover', async () => {
            const mockLead = {
                id: 'lead-123',
                aiEnabled: false,
                status: 'HANDOVER',
                tenantId: 'tenant-123',
            };

            vi.mocked(db.message.findUnique).mockResolvedValue(null);
            vi.mocked(db.takeoverKeyword.findMany).mockResolvedValue([]);

            await MessageRouter.handleOutboundTakeover(
                mockLead as any,
                'wa-msg-123',
                'Follow-up message'
            );

            expect(db.lead.update).not.toHaveBeenCalled();
        });
    });

    describe('Status Updates', () => {
        it('should update message status to delivered', async () => {
            vi.mocked(db.message.update).mockResolvedValue({} as any);

            await MessageRouter.handleStatusUpdate('wa-msg-123', 'delivered');

            expect(db.message.update).toHaveBeenCalledWith({
                where: { whatsappId: 'wa-msg-123' },
                data: { status: 'delivered' },
            });
        });

        it('should update message status to read', async () => {
            vi.mocked(db.message.update).mockResolvedValue({} as any);

            await MessageRouter.handleStatusUpdate('wa-msg-123', 'read');

            expect(db.message.update).toHaveBeenCalledWith({
                where: { whatsappId: 'wa-msg-123' },
                data: { status: 'read', wasRead: true },
            });
        });

        it('should handle status update for non-existent message', async () => {
            vi.mocked(db.message.update).mockRejectedValue(new Error('Not found'));

            // Should not throw
            await expect(
                MessageRouter.handleStatusUpdate('invalid-id', 'delivered')
            ).resolves.not.toThrow();
        });
    });

    describe('Edge Cases', () => {
        it('should handle null phoneNumberId', async () => {
            const tenantId = await MessageRouter.resolveTenantId(null as any);
            expect(tenantId).toBeUndefined();
        });

        it('should handle empty phone number', async () => {
            const lead = await MessageRouter.findOrInitializeLead('', 'tenant-123');
            expect(lead).toBeNull();
        });

        it('should handle concurrent message persistence', async () => {
            const messages = [
                { leadId: 'lead-1', content: 'Msg 1', whatsappId: 'wa-1' },
                { leadId: 'lead-1', content: 'Msg 2', whatsappId: 'wa-2' },
                { leadId: 'lead-1', content: 'Msg 3', whatsappId: 'wa-3' },
            ];

            vi.mocked(db.message.upsert).mockResolvedValue({} as any);

            await Promise.all(
                messages.map((msg) =>
                    MessageRouter.persistMessage({
                        ...msg,
                        direction: 'INBOUND',
                        type: 'TEXT',
                    })
                )
            );

            expect(db.message.upsert).toHaveBeenCalledTimes(3);
        });
    });

    describe('Error Handling', () => {
        it('should log errors but not throw on tenant resolution failure', async () => {
            vi.mocked(db.whatsAppConfig.findUnique).mockRejectedValue(new Error('DB timeout'));

            const tenantId = await MessageRouter.resolveTenantId('phone-123');

            expect(tenantId).toBeUndefined();
        });

        it('should handle database connection errors during lead creation', async () => {
            vi.mocked(db.lead.findUnique).mockRejectedValue(new Error('Connection lost'));

            const lead = await MessageRouter.findOrInitializeLead('+1234567890', 'tenant-123');

            expect(lead).toBeUndefined();
        });
    });
});
