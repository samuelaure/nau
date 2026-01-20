import OpenAI from 'openai';
import { config } from '../core/config.js';
import { logger } from '../core/logger.js';
import { withRetry } from '../core/errors/withRetry.js';
import { ExternalServiceError } from '../core/errors/AppError.js';

export class AIService {
  private static _openai: OpenAI | null = null;

  static get client(): OpenAI {
    if (!this._openai) {
      this._openai = new OpenAI({
        apiKey: config.OPENAI_API_KEY,
      });
    }
    return this._openai;
  }

  /**
   * For testing purposes to inject a mock client
   */
  static setClient(mockClient: any) {
    this._openai = mockClient;
  }

  /**
   * General purpose completion for conversational agents.
   */
  static async getChatResponse(
    systemPrompt: string,
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
    usePremium = false
  ) {
    const model = usePremium ? config.PRIMARY_AI_MODEL : config.CHEAP_AI_MODEL;
    const globalGuidelines = `
### DIRECTRICES DE RESPUESTA:
1. Mantén tus respuestas lo más cortas posible sin sacrificar la "integridad" (wholeness).
2. La calidad y la completitud del mensaje son prioritarias.
3. Solo envía respuestas largas si es estrictamente necesario para que la respuesta sea completa y de alta calidad basado en el contexto. Una respuesta "completa" es aquella que cumple su deber comunicativo eficientemente.
4. Tu tono debe ser extremadamente humano, evita sonar como un asistente robótico.
`;

    return withRetry(
      async () => {
        logger.info({ model }, 'Requesting AI response');

        const response = await this.client.chat.completions.create({
          model,
          messages: [{ role: 'system', content: `${systemPrompt}\n${globalGuidelines}` }, ...messages],
          temperature: 0.7,
        });

        return response.choices[0].message.content;
      },
      {
        retries: 2,
        delay: 1000,
        onRetry: (err) => logger.warn({ err }, 'Retrying OpenAI chat response'),
      }
    ).catch((error) => {
      throw new ExternalServiceError('OpenAI', error.message, error);
    });
  }

  /**
   * Detects lead intent and tags from a message (Spanish).
   */
  static async classifyIntent(message: string, contextSummaries: string = '') {
    const prompt = `
      Eres un experto analista de ventas para whatsnaŭ. Tu tarea es clasificar el intento de un mensaje de WhatsApp en español.
      Contexto previo: ${contextSummaries}
      Mensaje del cliente: "${message}"

      Responde únicamente en formato JSON con la siguiente estructura:
      {
        "intent": "interesado" | "no_interesado" | "duda" | "nurturing_opt_in" | "request_human" | "desconocido",
        "confidence": 0-1,
        "reasoning": "Breve explicación en español",
        "tags": ["tag1", "tag2"]
      }
    `;

    return withRetry(
      async () => {
        const result = await this.client.chat.completions.create({
          model: config.CHEAP_AI_MODEL,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
        });

        const content = result.choices[0].message.content;
        return content ? JSON.parse(content) : null;
      },
      { retries: 2 }
    ).catch((error) => {
      logger.error({ err: error }, 'Intent classification failed after retries');
      return null;
    });
  }
}
