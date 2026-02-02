import OpenAI from 'openai';
import { config } from '../core/config.js';
import { logger } from '../core/logger.js';
import { withRetry } from '../core/errors/withRetry.js';
import { ExternalServiceError } from '../core/errors/AppError.js';
import { db } from '../core/db.js';

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
          messages: [
            { role: 'system', content: `${systemPrompt}\n${globalGuidelines}` },
            ...messages,
          ],
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

  /**
   * Build lead-specific context for AI prompts
   */
  static async buildLeadContext(leadId: string): Promise<string> {
    const lead = await db.lead.findUnique({
      where: { id: leadId },
      include: { tags: true },
    });

    if (!lead) return '';

    const contextParts: string[] = [];

    // Lead name
    if (lead.name) {
      contextParts.push(`Nombre del lead: ${lead.name}`);
    }

    // Lead metadata (business info, research, etc.)
    if (lead.metadata) {
      try {
        const metadata = JSON.parse(lead.metadata);
        if (Object.keys(metadata).length > 0) {
          contextParts.push(`Información del negocio:`);
          Object.entries(metadata).forEach(([key, value]) => {
            contextParts.push(`  - ${key}: ${value}`);
          });
        }
      } catch (e) {
        logger.warn({ leadId, error: e }, 'Failed to parse lead metadata');
      }
    }

    // Lead tags
    if (lead.tags && lead.tags.length > 0) {
      const tagNames = lead.tags.map((t) => t.name).join(', ');
      contextParts.push(`Tags: ${tagNames}`);
    }

    // Demo context (if in demo)
    if (lead.state === 'DEMO' && lead.demoExpiresAt) {
      const now = new Date();
      const expiresAt = new Date(lead.demoExpiresAt);
      const minutesLeft = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 60000));

      contextParts.push(
        `\n🎯 DEMO ACTIVA: Este lead está probando una demo personalizada.`,
        `Tiempo restante: ${minutesLeft} minutos.`,
        `Adapta tus respuestas al contexto de su negocio y demuestra competencia.`
      );
    }

    // Nurturing context
    if (lead.state === 'NURTURING') {
      const onboardingStatus = lead.nurturingOnboardingComplete ? 'completado' : 'en progreso';
      contextParts.push(`Estado de onboarding: ${onboardingStatus}`);
    }

    return contextParts.join('\n');
  }

  /**
   * Enhanced chat response with lead context injection
   */
  static async getChatResponseWithContext(
    leadId: string,
    campaignId: string,
    role: 'CLOSER' | 'RECEPTIONIST' | 'NURTURING',
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[]
  ) {
    // Get prompt config for role and campaign
    const promptConfig = await (db as any).promptConfig.findUnique({
      where: { role_campaignId: { role, campaignId } },
    });
    if (!promptConfig) {
      throw new Error(`Prompt config not found for role: ${role} in campaign: ${campaignId}`);
    }

    // Get business knowledge base
    const business = await db.businessProfile.findUnique({ where: { id: 'singleton' } });
    const knowledgeBase = business?.knowledgeBase || 'No hay información adicional del negocio.';

    // Build lead context
    const leadContext = await this.buildLeadContext(leadId);

    // Global guidelines
    const globalGuidelines = `
### DIRECTRICES DE RESPUESTA:
1. Mantén tus respuestas lo más cortas posible sin sacrificar la "integridad" (wholeness).
2. La calidad y la completitud del mensaje son prioritarias.
3. Solo envía respuestas largas si es estrictamente necesario para que la respuesta sea completa y de alta calidad basado en el contexto. Una respuesta "completa" es aquella que cumple su deber comunicativo eficientemente.
4. Tu tono debe ser extremadamente humano, evita sonar como un asistente robótico.
    `;

    // Construct full system prompt
    const systemPrompt = `
${promptConfig.basePrompt}

### CONTEXTO DEL NEGOCIO:
${knowledgeBase}

${leadContext ? `### CONTEXTO DEL LEAD:\n${leadContext}` : ''}

${globalGuidelines}
    `.trim();

    // Determine model
    const model = promptConfig.usePremiumModel ? config.PRIMARY_AI_MODEL : config.CHEAP_AI_MODEL;

    return withRetry(
      async () => {
        logger.info({ model, role, leadId }, 'Requesting AI response with context');

        const response = await this.client.chat.completions.create({
          model,
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
          temperature: promptConfig.temperature,
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
}
