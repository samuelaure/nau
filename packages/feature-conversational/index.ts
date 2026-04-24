import OpenAI from 'openai';
import { ZazuSkill, ZazuContext } from '@zazu/skills-core';
import prisma, { Role } from '@zazu/db';

/**
 * ConversationalSkill is the baseline interaction layer for Zazŭ.
 * It provides a natural language fallback if no other specialized feature takes root.
 */
export class ConversationalSkill implements ZazuSkill {
  id = 'core-conversational';
  name = 'Asistente Conversacional';
  priority = 9999; // Lowest priority, absolute fallback

  private openai: OpenAI;
  private model: string = 'gpt-4o-mini';

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async canHandle(ctx: ZazuContext): Promise<boolean> {
    const user = ctx.dbUser;
    // Always can handle if the user has completed onboarding and we have textContent.
    return (
      user?.onboardingState === 'COMPLETED' &&
      !!ctx.textContent
    );
  }

  async handle(ctx: ZazuContext): Promise<void> {
    const user = ctx.dbUser;
    
    // Safety check
    if (!ctx.textContent) return;
    
    // Get last few messages for context
    const recentMessages = await prisma.message.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 6, // Last 3 exchanges
    });

    const llmMessages = recentMessages
      .reverse()
      .map((msg: any) => ({
        role: (msg.role === Role.USER ? 'user' : 'assistant') as 'user' | 'assistant' | 'system',
        content: msg.content,
      }));

    const systemPrompt = `Eres Zazŭ, un asistente personal conciso y eficiente. Mantén las respuestas cortas, conversacionales y evita el consumo innecesario de tokens. Tu tono es directo, servicial y amable. Siempre responde en español. No uses formatos complejos, mantente natural.`;

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...llmMessages,
      ],
      temperature: 0.7,
      max_tokens: 150,
    });

    const response = completion.choices[0].message?.content || 'Lo siento, no pude procesar tu solicitud.';
    await ctx.reply(response);
  }
}

// Global instance of the Conversational Skill
export const conversationalSkill = new ConversationalSkill();
