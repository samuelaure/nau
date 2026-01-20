import OpenAI from 'openai';
import { config } from '../core/config.js';
import { logger } from '../core/logger.js';

const openai = new OpenAI({
    apiKey: config.OPENAI_API_KEY,
});

export class AIService {
    /**
     * General purpose completion for conversational agents.
     */
    static async getChatResponse(
        systemPrompt: string,
        messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
        usePremium = false
    ) {
        try {
            const model = usePremium ? config.PRIMARY_AI_MODEL : config.CHEAP_AI_MODEL;

            logger.info({ model }, 'Requesting AI response');

            const response = await openai.chat.completions.create({
                model,
                messages: [{ role: 'system', content: systemPrompt }, ...messages],
                temperature: 0.7,
            });

            return response.choices[0].message.content;
        } catch (error) {
            logger.error({ err: error }, 'AI Request failed');
            throw error;
        }
    }

    /**
     * Detects lead intent and tags from a message (Spanish).
     * COST-EFFICIENCY: Uses GPT-4o-mini for logical classification.
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

      Reglas para "request_human":
      - El usuario quiere hablar con alguien real o pregunta si eres un bot.
      - Pide ayuda técnica o personal.
      - Expresa frustración clara.
    `;

        try {
            const result = await openai.chat.completions.create({
                model: config.CHEAP_AI_MODEL,
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' },
            });

            const content = result.choices[0].message.content;
            return content ? JSON.parse(content) : null;
        } catch (error) {
            logger.error({ err: error }, 'Intent classification failed');
            return null;
        }
    }
}
