import { AIService } from './ai.service.js';

describe('AIService Unit Tests', () => {
    let mockClient: any;

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
    });

    describe('getChatResponse', () => {
        it('should return AI content on success', async () => {
            const mockResponse = {
                choices: [{ message: { content: 'Mocked AI Response' } }],
            };

            mockClient.chat.completions.create.mockResolvedValue(mockResponse);

            const result = await AIService.getChatResponse('System Prompt', [{ role: 'user', content: 'Hello' }]);

            expect(result).toBe('Mocked AI Response');
        });

        it('should throw ExternalServiceError on failure after retries', async () => {
            mockClient.chat.completions.create.mockRejectedValue(new Error('OpenAI Overloaded'));

            await expect(
                AIService.getChatResponse('System Prompt', [{ role: 'user', content: 'Hello' }])
            ).rejects.toThrow('OpenAI');
        });
    });
});
