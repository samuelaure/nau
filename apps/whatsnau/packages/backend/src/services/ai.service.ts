import OpenAI from 'openai';
import { config } from '../core/config.js';
import { logger } from '../core/logger.js';
import { withRetry } from '../core/errors/withRetry.js';
import { ExternalServiceError } from '../core/errors/AppError.js';
import { db } from '../core/db.js';
import { CircuitBreaker } from '../core/resilience/CircuitBreaker.js';
import { PerformanceMonitor } from '../core/observability/PerformanceMonitor.js';
import { NotificationService } from './notification.service.js';
import { getCorrelationId } from '../core/observability/CorrelationId.js';

export class AIService {
  private static aiCircuitBreaker = new CircuitBreaker('OpenAI', {
    failureThreshold: 5,
    timeout: 60000,
  });

  /**
   * Get tenant-specific OpenAI configuration
   */
  private static async getOpenAIConfig(tenantId: string) {
    // 1. Try tenant config from DB
    const configData = await db.openAIConfig.findFirst({
      where: { tenantId, isDefault: true },
    });

    if (configData) {
      return {
        apiKey: configData.apiKey,
        primaryModel: configData.primaryModel,
        cheapModel: configData.cheapModel,
      };
    }

    // 2. Fallback to .env (Legacy/Migration path)
    return {
      apiKey: config.OPENAI_API_KEY,
      primaryModel: config.PRIMARY_AI_MODEL,
      cheapModel: config.CHEAP_AI_MODEL,
    };
  }

  /**
   * Get OpenAI client for a specific tenant
   */
  private static async getClient(tenantId: string): Promise<OpenAI> {
    const conf = await this.getOpenAIConfig(tenantId);
    if (!conf.apiKey) {
      throw new Error(`OpenAI API Key not configured for tenant ${tenantId}`);
    }
    return new OpenAI({
      apiKey: conf.apiKey,
    });
  }

  /**
   * General purpose completion for conversational agents.
   * Now requires tenantId context.
   */
  static async getChatResponse(
    tenantId: string,
    systemPrompt: string,
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
    usePremium = false
  ) {
    const conf = await this.getOpenAIConfig(tenantId);
    const model = usePremium ? conf.primaryModel : conf.cheapModel;

    // Global guidelines remain same
    const globalGuidelines = `
### DIRECTRICES DE RESPUESTA:
1. Mantén tus respuestas lo más cortas posible sin sacrificar la "integridad" (wholeness).
2. La calidad y la completitud del mensaje son prioritarias.
3. Solo envía respuestas largas si es estrictamente necesario para que la respuesta sea completa y de alta calidad basado en el contexto. Una respuesta "completa" es aquella que cumple su deber comunicativo eficientemente.
4. Tu tono debe ser extremadamente humano, evita sonar como un asistente robótico.
`;

    return withRetry(
      async () => {
        logger.info({ model, tenantId }, 'Requesting AI response');

        const client = await this.getClient(tenantId);

        const response = await client.chat.completions.create({
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
        onRetry: (err) => logger.warn({ err, tenantId }, 'Retrying OpenAI chat response'),
      }
    ).catch((error) => {
      throw new ExternalServiceError('OpenAI', error.message, error);
    });
  }

  /**
   * Detects lead intent and tags from a message (Spanish).
   * Requires tenantId.
   */
  static async classifyIntent(tenantId: string, message: string, contextSummaries: string = '') {
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
        const conf = await this.getOpenAIConfig(tenantId);
        const client = await this.getClient(tenantId);

        const result = await client.chat.completions.create({
          model: conf.cheapModel,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
        });

        const content = result.choices[0].message.content;
        return content ? JSON.parse(content) : null;
      },
      { retries: 2 }
    ).catch((error) => {
      logger.error({ err: error, tenantId }, 'Intent classification failed after retries');
      return null;
    });
  }

  /**
   * For testing purposes to inject a mock client
   */
  static setClient(mockClient: any) {
    // We override the getClient method for testing
    this.getClient = async () => mockClient;
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

    // Lead metadata
    if (lead.metadata) {
      try {
        const metadata = JSON.parse(lead.metadata);
        if (Object.keys(metadata).length > 0) {
          contextParts.push(`Información del negocio del lead:`);
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

    // Build dynamic context using RetrievalService (Context Weaver)
    const lead = await db.lead.findUnique({ where: { id: leadId }, select: { tenantId: true } });
    if (!lead) throw new Error(`Lead not found: ${leadId}`);

    const tenantId = lead.tenantId;
    const lastMessage = messages[messages.length - 1]?.content || '';
    const dynamicContext = await (
      await import('./retrieval.service.js')
    ).RetrievalService.getRelevantContext(leadId, tenantId, lastMessage);

    // Build static lead context (Base info only)
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

${leadContext ? `### CONTEXTO DEL LEAD:\n${leadContext}` : ''}

${dynamicContext ? `### INFORMACIÓN RELEVANTE:\n${dynamicContext}` : ''}

${globalGuidelines}
    `.trim();

    // Determine model
    const conf = await this.getOpenAIConfig(tenantId);
    const model = promptConfig.usePremiumModel ? conf.primaryModel : conf.cheapModel;

    // Define tools
    const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
      {
        type: 'function',
        function: {
          name: 'create_order',
          description: 'Crea un borrador de pedido para el cliente.',
          parameters: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    productId: { type: 'string', description: 'El ID del producto.' },
                    quantity: { type: 'number', description: 'La cantidad a pedir.' },
                  },
                  required: ['productId', 'quantity'],
                },
              },
            },
            required: ['items'],
          },
        },
      },
    ];

    return withRetry(
      async () => {
        logger.info({ model, role, leadId, tenantId }, 'Requesting AI response with context and tools');

        const client = await this.getClient(tenantId);

        const response = await client.chat.completions.create({
          model,
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
          temperature: promptConfig.temperature,
          tools,
          tool_choice: 'auto',
        });

        const message = response.choices[0].message;

        // Handle Tool Calls
        if (message.tool_calls && message.tool_calls.length > 0) {
          const toolMessages: OpenAI.Chat.Completions.ChatCompletionToolMessageParam[] = [];

          for (const toolCall of message.tool_calls) {
            const tc = toolCall as any;
            if (tc.function.name === 'create_order') {
              const args = JSON.parse(tc.function.arguments);
              const { OrderService } = await import('./order.service.js');
              try {
                const order = await OrderService.createDraftOrder(leadId, args.items);
                logger.info({ orderId: order.id }, 'AI successfully called create_order');
                toolMessages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: 'Pedido creado exitosamente en estado borrador.',
                });
              } catch (err: any) {
                logger.error({ err }, 'AI failed to create order via tool');
                toolMessages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: `Error al crear el pedido: ${err.message}`,
                });
              }
            } else {
              toolMessages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: 'Error: Herramienta desconocida.',
              });
            }
          }

          // After tool execution, we usually want a second pass to get the final text response
          const secondResponse = await client.chat.completions.create({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages,
              message,
              ...toolMessages,
            ],
          });
          return secondResponse.choices[0].message.content;
        }

        return message.content;
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
   * Enhanced AI call with circuit breaker and fallback
   */
  static async getChatResponseWithFallback(
    leadId: string,
    campaignId: string,
    role: 'CLOSER' | 'RECEPTIONIST' | 'NURTURING',
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[]
  ): Promise<string | null> {
    const correlationId = getCorrelationId();
    const lead = await db.lead.findUnique({ where: { id: leadId }, select: { tenantId: true } });

    try {
      return await this.aiCircuitBreaker.execute(() =>
        PerformanceMonitor.track(
          'AI_CALL',
          () => this.getChatResponseWithContext(leadId, campaignId, role, messages),
          lead?.tenantId
        )
      );
    } catch (error: any) {
      logger.error(
        {
          err: error,
          correlationId,
          leadId,
          role,
          circuitState: this.aiCircuitBreaker.getState(),
        },
        'AI service call failed in AIService'
      );

      // Notify on fallback trigger (only if it's a real failure, not just a full circuit)
      if (this.aiCircuitBreaker.getState() === 'OPEN') {
        await NotificationService.notifyAIDegradation(leadId);
      }

      return null;
    }
  }
}
