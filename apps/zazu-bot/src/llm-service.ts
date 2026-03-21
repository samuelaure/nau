import OpenAI from 'openai';

interface LLMResponse {
  content: string;
}

export class LLMService {
  private openai: OpenAI;
  private model: string = 'gpt-4o-mini';

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async getConversationalResponse(
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
  ): Promise<LLMResponse> {
    const systemPrompt = `Eres Zazŭ, un asistente personal conciso y eficiente. Mantén las respuestas cortas, conversacionales y evita el consumo innecesario de tokens. Tu tono es directo, servicial y amable. Siempre responde en español. No uses formatos complejos, mantente natural.`;

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 150,
    });

    return {
      content: completion.choices[0].message?.content || 'Lo siento, no pude procesar tu solicitud.',
    };
  }
}

export const llmService = new LLMService();
