import { WhatsAppService } from './whatsapp.service.js';
import { db } from '../core/db.js';

vi.mock('../core/db.js', () => ({
  db: {
    campaign: {
      findUnique: vi.fn(),
    },
    whatsAppConfig: {
      findFirst: vi.fn(),
    },
  },
}));

describe('WhatsAppService Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock global fetch
    global.fetch = vi.fn();
  });

  describe('sendMessage', () => {
    it('should use campaign-specific credentials if available', async () => {
      const mockCampaign = {
        id: 'camp-1',
        whatsAppConfig: {
          accessToken: 'camp-token',
          phoneNumberId: 'camp-phone-id',
          wabaId: 'camp-waba-id',
        },
      };

      (db.campaign.findUnique as any).mockResolvedValue(mockCampaign);
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ messages: [{ id: 'wa-msg-id' }] }),
      });

      const payload = {
        messaging_product: 'whatsapp' as const,
        to: '34600111222',
        type: 'text' as const,
        text: { body: 'Hello' },
      };

      await WhatsAppService.sendMessage(payload, 'camp-1');

      expect(db.campaign.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'camp-1' },
        })
      );

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('camp-phone-id'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer camp-token',
          }),
        })
      );
    });

    it('should fallback to default config if campaign config is missing', async () => {
      const mockDefaultConfig = {
        accessToken: 'default-token',
        phoneNumberId: 'default-phone-id',
        wabaId: 'default-waba-id',
      };

      (db.campaign.findUnique as any).mockResolvedValue(null);
      ((db as any).whatsAppConfig.findFirst as any).mockResolvedValue(mockDefaultConfig);
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ messages: [{ id: 'wa-msg-id' }] }),
      });

      await WhatsAppService.sendText('34600111222', 'Hello');

      expect((db as any).whatsAppConfig.findFirst).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('default-phone-id'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer default-token',
          }),
        })
      );
    });
  });
});
