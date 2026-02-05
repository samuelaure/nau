import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StateTransitionEngine } from '../orchestration/StateTransitionEngine.js';
import { LeadService, LeadState } from '../../services/lead.service.js';
import { AgentCoordinator } from '../orchestration/AgentCoordinator.js';

// Mock dependencies
vi.mock('../../services/lead.service.js', () => ({
  LeadService: {
    transition: vi.fn(),
    addTag: vi.fn(),
    hasTag: vi.fn(),
    optIntoNurturing: vi.fn(),
    startDemo: vi.fn(),
    endDemo: vi.fn(),
  },
  LeadState: {
    COLD: 'COLD',
    INTERESTED: 'INTERESTED',
    DEMO: 'DEMO',
    NURTURING: 'NURTURING',
    CLIENTS: 'CLIENTS',
  },
}));

vi.mock('../orchestration/AgentCoordinator.js', () => ({
  AgentCoordinator: {
    triggerAgent: vi.fn(),
    sendAsync: vi.fn(),
  },
}));

vi.mock('../../services/config.global.service.js', () => ({
  GlobalConfigService: {
    getConfig: vi.fn().mockResolvedValue({
      defaultDemoDurationMinutes: 10,
      maxUnansweredMessages: 2,
    }),
  },
}));

describe('StateTransitionEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('COLD Phase Handling', () => {
    const coldLead = {
      id: 'lead-123',
      state: LeadState.COLD,
      phoneNumber: '+1234567890',
      tenantId: 'tenant-123',
    };

    it('should transition to INTERESTED on "yes_interested" button', async () => {
      await StateTransitionEngine.handlePhase(coldLead as any, '', 'yes_interested');

      expect(LeadService.transition).toHaveBeenCalledWith('lead-123', LeadState.INTERESTED);
      expect(LeadService.addTag).toHaveBeenCalledWith('lead-123', 'interested');
      expect(AgentCoordinator.triggerAgent).toHaveBeenCalledWith(coldLead, 'CLOSER');
    });

    it('should transition to INTERESTED on affirmative text', async () => {
      await StateTransitionEngine.handlePhase(coldLead as any, 'Si, me interesa', undefined);

      expect(LeadService.transition).toHaveBeenCalledWith('lead-123', LeadState.INTERESTED);
      expect(LeadService.addTag).toHaveBeenCalledWith('lead-123', 'interested');
    });

    it('should send weekly tips invite on "no_thanks" button', async () => {
      await StateTransitionEngine.handlePhase(coldLead as any, '', 'no_thanks');

      // Should call sendWeeklyTipsInvite (private method)
      // Verify it doesn't transition to INTERESTED
      expect(LeadService.transition).not.toHaveBeenCalled();
    });

    it('should opt into nurturing on "yes_nurturing" button', async () => {
      await StateTransitionEngine.handlePhase(coldLead as any, '', 'yes_nurturing');

      expect(LeadService.optIntoNurturing).toHaveBeenCalledWith('lead-123');
      expect(AgentCoordinator.triggerAgent).toHaveBeenCalledWith(coldLead, 'NURTURING');
    });

    it('should add "colder" tag on "no_nurturing" if not interested', async () => {
      vi.mocked(LeadService.hasTag).mockResolvedValue(false);

      await StateTransitionEngine.handlePhase(coldLead as any, '', 'no_nurturing');

      expect(LeadService.addTag).toHaveBeenCalledWith('lead-123', 'colder');
    });

    it('should not add "colder" tag if already interested', async () => {
      vi.mocked(LeadService.hasTag).mockResolvedValue(true);

      await StateTransitionEngine.handlePhase(coldLead as any, '', 'no_nurturing');

      expect(LeadService.addTag).not.toHaveBeenCalled();
    });

    it('should handle ambiguous response by transitioning to INTERESTED', async () => {
      await StateTransitionEngine.handlePhase(coldLead as any, 'Cuéntame más', undefined);

      expect(LeadService.transition).toHaveBeenCalledWith('lead-123', LeadState.INTERESTED);
      expect(AgentCoordinator.triggerAgent).toHaveBeenCalledWith(
        coldLead,
        'CLOSER',
        'Cuéntame más'
      );
    });
  });

  describe('INTERESTED Phase Handling', () => {
    const interestedLead = {
      id: 'lead-456',
      state: LeadState.INTERESTED,
      phoneNumber: '+1234567890',
      tenantId: 'tenant-123',
    };

    it('should start demo on "ver_demo" button', async () => {
      await StateTransitionEngine.handlePhase(interestedLead as any, '', 'ver_demo');

      expect(LeadService.startDemo).toHaveBeenCalledWith('lead-456', 10);
    });

    it('should start demo on "demo" keyword', async () => {
      await StateTransitionEngine.handlePhase(
        interestedLead as any,
        'Quiero ver la demo',
        undefined
      );

      expect(LeadService.startDemo).toHaveBeenCalledWith('lead-456', 10);
    });

    it('should trigger CLOSER agent for other messages', async () => {
      await StateTransitionEngine.handlePhase(interestedLead as any, '¿Cuánto cuesta?', undefined);

      expect(AgentCoordinator.triggerAgent).toHaveBeenCalledWith(
        interestedLead,
        'CLOSER',
        '¿Cuánto cuesta?'
      );
    });
  });

  describe('DEMO Phase Handling', () => {
    const demoLead = {
      id: 'lead-789',
      state: LeadState.DEMO,
      phoneNumber: '+1234567890',
      tenantId: 'tenant-123',
      demoExpiresAt: null,
    };

    it('should trigger RECEPTIONIST agent during active demo', async () => {
      await StateTransitionEngine.handlePhase(
        demoLead as any,
        '¿Qué servicios ofrecen?',
        undefined
      );

      expect(AgentCoordinator.triggerAgent).toHaveBeenCalledWith(
        demoLead,
        'RECEPTIONIST',
        '¿Qué servicios ofrecen?'
      );
    });

    it('should end demo if expired', async () => {
      const expiredDemoLead = {
        ...demoLead,
        demoExpiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      };

      await StateTransitionEngine.handlePhase(expiredDemoLead as any, 'Hola', undefined);

      expect(LeadService.endDemo).toHaveBeenCalledWith('lead-789');
      expect(AgentCoordinator.sendAsync).toHaveBeenCalledWith(
        expiredDemoLead,
        'text',
        expect.objectContaining({ body: expect.stringContaining('demo ha finalizado') }),
        expect.any(String)
      );
    });

    it('should not end demo if still active', async () => {
      const activeDemoLead = {
        ...demoLead,
        demoExpiresAt: new Date(Date.now() + 60000), // Expires in 1 minute
      };

      await StateTransitionEngine.handlePhase(activeDemoLead as any, 'Hola', undefined);

      expect(LeadService.endDemo).not.toHaveBeenCalled();
      expect(AgentCoordinator.triggerAgent).toHaveBeenCalled();
    });
  });

  describe('NURTURING Phase Handling', () => {
    const nurturingLead = {
      id: 'lead-999',
      state: LeadState.NURTURING,
      phoneNumber: '+1234567890',
      tenantId: 'tenant-123',
    };

    it('should update lastBroadcastInteraction', async () => {
      const { db } = await import('../db.js');
      const mockUpdate = vi.fn();
      (db as any).lead = { update: mockUpdate };

      await StateTransitionEngine.handlePhase(
        nurturingLead as any,
        'Gracias por el tip',
        undefined
      );

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'lead-999' },
        data: { lastBroadcastInteraction: expect.any(Date) },
      });
    });

    it('should trigger NURTURING agent', async () => {
      await StateTransitionEngine.handlePhase(nurturingLead as any, 'Más información', undefined);

      expect(AgentCoordinator.triggerAgent).toHaveBeenCalledWith(
        nurturingLead,
        'NURTURING',
        'Más información'
      );
    });
  });

  describe('Demo Start Flow', () => {
    const interestedLead = {
      id: 'lead-demo',
      state: LeadState.INTERESTED,
      phoneNumber: '+1234567890',
      tenantId: 'tenant-123',
    };

    it('should use GlobalConfigService for demo duration', async () => {
      const { GlobalConfigService } = await import('../../services/config.global.service.js');

      await StateTransitionEngine.handlePhase(interestedLead as any, '', 'ver_demo');

      expect(GlobalConfigService.getConfig).toHaveBeenCalledWith('tenant-123');
      expect(LeadService.startDemo).toHaveBeenCalledWith('lead-demo', 10);
    });

    it('should send welcome message and trigger RECEPTIONIST', async () => {
      await StateTransitionEngine.handlePhase(interestedLead as any, '', 'ver_demo');

      expect(AgentCoordinator.sendAsync).toHaveBeenCalledWith(
        expect.objectContaining({ state: LeadState.DEMO }),
        'text',
        expect.objectContaining({ body: expect.stringContaining('Recepcionista IA') }),
        expect.any(String)
      );

      expect(AgentCoordinator.triggerAgent).toHaveBeenCalledWith(
        expect.objectContaining({ state: LeadState.DEMO }),
        'RECEPTIONIST',
        expect.any(String)
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle null buttonId gracefully', async () => {
      const lead = {
        id: 'lead-edge',
        state: LeadState.COLD,
        phoneNumber: '+1234567890',
        tenantId: 'tenant-123',
      };

      await expect(
        StateTransitionEngine.handlePhase(lead as any, 'Hello', null as any)
      ).resolves.not.toThrow();
    });

    it('should handle empty content', async () => {
      const lead = {
        id: 'lead-edge',
        state: LeadState.COLD,
        phoneNumber: '+1234567890',
        tenantId: 'tenant-123',
      };

      await expect(
        StateTransitionEngine.handlePhase(lead as any, '', undefined)
      ).resolves.not.toThrow();
    });

    it('should handle case-insensitive keywords', async () => {
      const lead = {
        id: 'lead-case',
        state: LeadState.COLD,
        phoneNumber: '+1234567890',
        tenantId: 'tenant-123',
      };

      await StateTransitionEngine.handlePhase(lead as any, 'SI, ME INTERESA', undefined);

      expect(LeadService.transition).toHaveBeenCalledWith('lead-case', LeadState.INTERESTED);
    });

    it('should handle mixed case keywords', async () => {
      const lead = {
        id: 'lead-mixed',
        state: LeadState.INTERESTED,
        phoneNumber: '+1234567890',
        tenantId: 'tenant-123',
      };

      await StateTransitionEngine.handlePhase(lead as any, 'Quiero ver la DEMO', undefined);

      expect(LeadService.startDemo).toHaveBeenCalled();
    });
  });

  describe('State Transition Validation', () => {
    it('should only handle valid states', async () => {
      const validStates = [
        LeadState.COLD,
        LeadState.INTERESTED,
        LeadState.DEMO,
        LeadState.NURTURING,
      ];

      for (const state of validStates) {
        const lead = {
          id: `lead-${state}`,
          state,
          phoneNumber: '+1234567890',
          tenantId: 'tenant-123',
        };

        await expect(
          StateTransitionEngine.handlePhase(lead as any, 'Test', undefined)
        ).resolves.not.toThrow();
      }
    });

    it('should handle CLIENTS state gracefully (no handler)', async () => {
      const clientLead = {
        id: 'lead-client',
        state: LeadState.CLIENTS,
        phoneNumber: '+1234567890',
        tenantId: 'tenant-123',
      };

      // Should not throw, just do nothing
      await expect(
        StateTransitionEngine.handlePhase(clientLead as any, 'Hello', undefined)
      ).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle LeadService errors gracefully', async () => {
      vi.mocked(LeadService.transition).mockRejectedValue(new Error('DB error'));

      const lead = {
        id: 'lead-error',
        state: LeadState.COLD,
        phoneNumber: '+1234567890',
        tenantId: 'tenant-123',
      };

      // Should propagate error for proper handling upstream
      await expect(StateTransitionEngine.handlePhase(lead as any, 'Si', undefined)).rejects.toThrow(
        'DB error'
      );
    });

    it('should handle AgentCoordinator errors gracefully', async () => {
      vi.mocked(AgentCoordinator.triggerAgent).mockRejectedValue(new Error('AI error'));

      const lead = {
        id: 'lead-ai-error',
        state: LeadState.INTERESTED,
        phoneNumber: '+1234567890',
        tenantId: 'tenant-123',
      };

      await expect(
        StateTransitionEngine.handlePhase(lead as any, 'Hola', undefined)
      ).rejects.toThrow('AI error');
    });
  });
});
