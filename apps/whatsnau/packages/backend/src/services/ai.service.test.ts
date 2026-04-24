import { AIService } from './ai.service.js';
import { db } from '../core/db.js';

// Mock DB
vi.mock('../core/db.js', () => ({
  db: {
    openAIConfig: {
      findFirst: vi.fn(),
    },
  },
}));

describe('AIService Unit Tests', () => {
  let mockClient: any;
  const mockTenantId = 'tenant-123';

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    };
    AIService.setClient(mockClient);

    // Mock DB response for config
    (db.openAIConfig.findFirst as any).mockResolvedValue({
      apiKey: 'sk-test',
      primaryModel: 'gpt-4o',
      cheapModel: 'gpt-4o-mini',
    });
  });

  describe('getChatResponse', () => {
    it('should return AI content on success', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Mocked AI Response' } }],
      };

      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await AIService.getChatResponse(mockTenantId, 'System Prompt', [
        { role: 'user', content: 'Hello' },
      ]);

      expect(result).toBe('Mocked AI Response');
    });

    it('should throw ExternalServiceError on failure after retries', async () => {
      mockClient.chat.completions.create.mockRejectedValue(new Error('OpenAI Overloaded'));

      await expect(
        AIService.getChatResponse(mockTenantId, 'System Prompt', [{ role: 'user', content: 'Hello' }])
      ).rejects.toThrow('OpenAI');
    });
  });
});
