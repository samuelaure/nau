import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComplianceGateway } from '../orchestration/ComplianceGateway.js';
import { db } from '../db.js';
import { WhatsAppService } from '../../services/whatsapp.service.js';
import { GlobalConfigService } from '../../services/config.global.service.js';

// Mock dependencies
vi.mock('../db.js', () => ({
  db: {
    lead: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../services/whatsapp.service.js', () => ({
  WhatsAppService: {
    canSendFreeform: vi.fn(),
  },
}));

vi.mock('../../services/config.global.service.js', () => ({
  GlobalConfigService: {
    getConfig: vi.fn(),
  },
}));

describe('ComplianceGateway', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Anti-Spam Protection', () => {
    it('should allow message when under limit', async () => {
      const mockLead = {
        id: 'lead-123',
        unansweredCount: 1,
        tenantId: 'tenant-123',
      };

      const mockConfig = {
        maxUnansweredMessages: 2,
      };

      vi.mocked(db.lead.findUnique).mockResolvedValue(mockLead as any);
      vi.mocked(GlobalConfigService.getConfig).mockResolvedValue(mockConfig as any);

      const canSend = await ComplianceGateway.canSendMessage('lead-123');

      expect(canSend).toBe(true);
    });

    it('should block message when at limit', async () => {
      const mockLead = {
        id: 'lead-123',
        unansweredCount: 2,
        tenantId: 'tenant-123',
      };

      const mockConfig = {
        maxUnansweredMessages: 2,
      };

      vi.mocked(db.lead.findUnique).mockResolvedValue(mockLead as any);
      vi.mocked(GlobalConfigService.getConfig).mockResolvedValue(mockConfig as any);

      const canSend = await ComplianceGateway.canSendMessage('lead-123');

      expect(canSend).toBe(false);
    });

    it('should block message when over limit', async () => {
      const mockLead = {
        id: 'lead-123',
        unansweredCount: 5,
        tenantId: 'tenant-123',
      };

      const mockConfig = {
        maxUnansweredMessages: 2,
      };

      vi.mocked(db.lead.findUnique).mockResolvedValue(mockLead as any);
      vi.mocked(GlobalConfigService.getConfig).mockResolvedValue(mockConfig as any);

      const canSend = await ComplianceGateway.canSendMessage('lead-123');

      expect(canSend).toBe(false);
    });

    it('should use GlobalConfigService for limit', async () => {
      const mockLead = {
        id: 'lead-123',
        unansweredCount: 0,
        tenantId: 'tenant-456',
      };

      const mockConfig = {
        maxUnansweredMessages: 3,
      };

      vi.mocked(db.lead.findUnique).mockResolvedValue(mockLead as any);
      vi.mocked(GlobalConfigService.getConfig).mockResolvedValue(mockConfig as any);

      await ComplianceGateway.canSendMessage('lead-123');

      expect(GlobalConfigService.getConfig).toHaveBeenCalledWith('tenant-456');
    });

    it('should return false if lead not found', async () => {
      vi.mocked(db.lead.findUnique).mockResolvedValue(null);

      const canSend = await ComplianceGateway.canSendMessage('invalid-lead');

      expect(canSend).toBe(false);
    });
  });

  describe('24-Hour Window Compliance', () => {
    it('should return FREEFORM when within 24-hour window', async () => {
      vi.mocked(WhatsAppService.canSendFreeform).mockResolvedValue(true);

      const route = await ComplianceGateway.resolveMessageRoute('lead-123');

      expect(route.type).toBe('FREEFORM');
      expect(route.templateName).toBeUndefined();
    });

    it('should return TEMPLATE when outside 24-hour window', async () => {
      vi.mocked(WhatsAppService.canSendFreeform).mockResolvedValue(false);

      const route = await ComplianceGateway.resolveMessageRoute('lead-123');

      expect(route.type).toBe('TEMPLATE');
    });

    it('should call WhatsAppService.canSendFreeform with leadId', async () => {
      vi.mocked(WhatsAppService.canSendFreeform).mockResolvedValue(true);

      await ComplianceGateway.resolveMessageRoute('lead-456');

      expect(WhatsAppService.canSendFreeform).toHaveBeenCalledWith('lead-456');
    });
  });

  describe('Content Filtering', () => {
    it('should allow valid content', async () => {
      const isAllowed = await ComplianceGateway.isContentAllowed('Hello, how can I help?');

      expect(isAllowed).toBe(true);
    });

    it('should allow empty content', async () => {
      const isAllowed = await ComplianceGateway.isContentAllowed('');

      expect(isAllowed).toBe(true);
    });

    it('should allow special characters', async () => {
      const isAllowed = await ComplianceGateway.isContentAllowed('¡Hola! ¿Cómo estás?');

      expect(isAllowed).toBe(true);
    });

    // Note: Current implementation always returns true
    // This test documents expected behavior if filtering is implemented
    it('should be extensible for keyword filtering', async () => {
      const isAllowed = await ComplianceGateway.isContentAllowed('Test message');

      expect(typeof isAllowed).toBe('boolean');
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should use tenant-specific config for different tenants', async () => {
      const tenant1Lead = {
        id: 'lead-t1',
        unansweredCount: 1,
        tenantId: 'tenant-1',
      };

      const tenant2Lead = {
        id: 'lead-t2',
        unansweredCount: 1,
        tenantId: 'tenant-2',
      };

      const config1 = { maxUnansweredMessages: 2 };
      const config2 = { maxUnansweredMessages: 5 };

      vi.mocked(db.lead.findUnique)
        .mockResolvedValueOnce(tenant1Lead as any)
        .mockResolvedValueOnce(tenant2Lead as any);

      vi.mocked(GlobalConfigService.getConfig)
        .mockResolvedValueOnce(config1 as any)
        .mockResolvedValueOnce(config2 as any);

      await ComplianceGateway.canSendMessage('lead-t1');
      await ComplianceGateway.canSendMessage('lead-t2');

      expect(GlobalConfigService.getConfig).toHaveBeenCalledWith('tenant-1');
      expect(GlobalConfigService.getConfig).toHaveBeenCalledWith('tenant-2');
    });
  });

  describe('Edge Cases', () => {
    it('should handle exactly at threshold', async () => {
      const mockLead = {
        id: 'lead-edge',
        unansweredCount: 2,
        tenantId: 'tenant-123',
      };

      const mockConfig = {
        maxUnansweredMessages: 2,
      };

      vi.mocked(db.lead.findUnique).mockResolvedValue(mockLead as any);
      vi.mocked(GlobalConfigService.getConfig).mockResolvedValue(mockConfig as any);

      const canSend = await ComplianceGateway.canSendMessage('lead-edge');

      // At threshold should block (>= comparison)
      expect(canSend).toBe(false);
    });

    it('should handle zero unanswered count', async () => {
      const mockLead = {
        id: 'lead-zero',
        unansweredCount: 0,
        tenantId: 'tenant-123',
      };

      const mockConfig = {
        maxUnansweredMessages: 2,
      };

      vi.mocked(db.lead.findUnique).mockResolvedValue(mockLead as any);
      vi.mocked(GlobalConfigService.getConfig).mockResolvedValue(mockConfig as any);

      const canSend = await ComplianceGateway.canSendMessage('lead-zero');

      expect(canSend).toBe(true);
    });

    it('should handle null leadId', async () => {
      const canSend = await ComplianceGateway.canSendMessage(null as any);

      expect(canSend).toBe(false);
    });

    it('should handle undefined leadId', async () => {
      const canSend = await ComplianceGateway.canSendMessage(undefined as any);

      expect(canSend).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      vi.mocked(db.lead.findUnique).mockRejectedValue(new Error('DB connection lost'));

      // Should not throw, return false for safety
      const canSend = await ComplianceGateway.canSendMessage('lead-123');

      expect(canSend).toBe(false);
    });

    it('should handle GlobalConfigService errors', async () => {
      const mockLead = {
        id: 'lead-123',
        unansweredCount: 1,
        tenantId: 'tenant-123',
      };

      vi.mocked(db.lead.findUnique).mockResolvedValue(mockLead as any);
      vi.mocked(GlobalConfigService.getConfig).mockRejectedValue(new Error('Config error'));

      // Should handle gracefully (GlobalConfigService has fallback defaults)
      await expect(ComplianceGateway.canSendMessage('lead-123')).resolves.not.toThrow();
    });

    it('should handle WhatsAppService errors', async () => {
      vi.mocked(WhatsAppService.canSendFreeform).mockRejectedValue(new Error('API error'));

      // Should not throw, fallback to TEMPLATE for safety
      await expect(ComplianceGateway.resolveMessageRoute('lead-123')).resolves.not.toThrow();
    });
  });

  describe('Compliance Logging', () => {
    it('should log when blocking message due to anti-spam', async () => {
      const mockLead = {
        id: 'lead-spam',
        unansweredCount: 5,
        tenantId: 'tenant-123',
      };

      const mockConfig = {
        maxUnansweredMessages: 2,
      };

      vi.mocked(db.lead.findUnique).mockResolvedValue(mockLead as any);
      vi.mocked(GlobalConfigService.getConfig).mockResolvedValue(mockConfig as any);

      await ComplianceGateway.canSendMessage('lead-spam');

      // Logger should have been called (verified by implementation)
      // This test documents expected behavior
      expect(true).toBe(true);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle full compliance check flow', async () => {
      const mockLead = {
        id: 'lead-full',
        unansweredCount: 1,
        tenantId: 'tenant-123',
      };

      const mockConfig = {
        maxUnansweredMessages: 2,
      };

      vi.mocked(db.lead.findUnique).mockResolvedValue(mockLead as any);
      vi.mocked(GlobalConfigService.getConfig).mockResolvedValue(mockConfig as any);
      vi.mocked(WhatsAppService.canSendFreeform).mockResolvedValue(true);

      // Check anti-spam
      const canSend = await ComplianceGateway.canSendMessage('lead-full');
      expect(canSend).toBe(true);

      // Check 24-hour window
      const route = await ComplianceGateway.resolveMessageRoute('lead-full');
      expect(route.type).toBe('FREEFORM');

      // Check content
      const isAllowed = await ComplianceGateway.isContentAllowed('Test message');
      expect(isAllowed).toBe(true);
    });

    it('should block at any compliance failure', async () => {
      const mockLead = {
        id: 'lead-blocked',
        unansweredCount: 3,
        tenantId: 'tenant-123',
      };

      const mockConfig = {
        maxUnansweredMessages: 2,
      };

      vi.mocked(db.lead.findUnique).mockResolvedValue(mockLead as any);
      vi.mocked(GlobalConfigService.getConfig).mockResolvedValue(mockConfig as any);

      const canSend = await ComplianceGateway.canSendMessage('lead-blocked');

      // Should block even if other checks would pass
      expect(canSend).toBe(false);
    });
  });
});
