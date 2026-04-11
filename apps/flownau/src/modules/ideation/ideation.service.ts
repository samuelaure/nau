import OpenAI from 'openai';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';

const IdeationOutputSchema = z.object({
  ideas: z.array(z.object({
    hook: z.string().describe('A compelling opening hook for the content piece.'),
    angle: z.string().describe('The unique angle or perspective for this idea.'),
    script: z.string().describe('A full content script or narrative, ready for recording.'),
    cta: z.string().describe('A call-to-action suggestion.'),
    format: z.enum(['reel', 'carousel', 'static_post', 'story']).describe('Recommended content format.'),
    inspoItemId: z.string().optional().describe('ID of the InspoItem that inspired this idea.'),
  })),
  briefSummary: z.string().describe('A brief meta-summary of the ideation session.'),
});

export type IdeationOutput = z.infer<typeof IdeationOutputSchema>;

interface InspoItemInput {
  id: string;
  type: string;
  note: string | null;
  extractedHook: string | null;
  extractedTheme: string | null;
  adaptedScript: string | null;
  postCaption?: string | null;
  postTranscript?: string | null;
}

interface IdeationContext {
  brandName: string;
  brandDNA: string;
  inspoItems: InspoItemInput[];
  injectedDocuments?: string[];
  recentPosts?: string[];
}

export async function generateContentIdeas(ctx: IdeationContext): Promise<IdeationOutput> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured. Cannot generate content ideas.');
  }

  const openai = new OpenAI({ apiKey });

  // Build context prompt
  let contextBlock = '';

  contextBlock += `## BRAND DNA\n${ctx.brandDNA}\n\n`;

  if (ctx.inspoItems.length > 0) {
    contextBlock += `## INSPO BASE (${ctx.inspoItems.length} items)\n`;
    ctx.inspoItems.forEach((item, i) => {
      contextBlock += `### Item ${i + 1} (${item.type}) [ID: ${item.id}]\n`;
      if (item.note) contextBlock += `User Note: ${item.note}\n`;
      if (item.extractedHook) contextBlock += `Hook: ${item.extractedHook}\n`;
      if (item.extractedTheme) contextBlock += `Theme: ${item.extractedTheme}\n`;
      if (item.postCaption) contextBlock += `Caption: ${item.postCaption}\n`;
      if (item.postTranscript) contextBlock += `Transcript: ${item.postTranscript}\n`;
      if (item.adaptedScript) contextBlock += `Adapted Script: ${item.adaptedScript}\n`;
      contextBlock += '\n';
    });
  }

  if (ctx.injectedDocuments && ctx.injectedDocuments.length > 0) {
    contextBlock += `## STRATEGY DOCUMENTS\n`;
    ctx.injectedDocuments.forEach((doc, i) => {
      contextBlock += `### Document ${i + 1}\n${doc}\n\n`;
    });
  }

  if (ctx.recentPosts && ctx.recentPosts.length > 0) {
    contextBlock += `## RECENT PUBLISHED CONTENT (avoid repetition)\n`;
    ctx.recentPosts.forEach(p => {
      contextBlock += `- ${p}\n`;
    });
    contextBlock += '\n';
  }

  const completion = await (openai.beta as any).chat.completions.parse({
    model: 'gpt-4o',
    temperature: 0.7,
    messages: [
      {
        role: 'system',
        content: `You are the Content Ideation Engine for "${ctx.brandName}".
Your job is to generate fresh, high-quality content ideas based on the user's Inspo Base items and Brand DNA.

RULES:
1. Generate 3-5 content ideas.
2. Each idea must have a compelling hook, a unique angle, a full script, and a CTA.
3. Reference inspoItemIds when an idea is directly inspired by a specific InspoItem.
4. Recommend the best format (reel, carousel, static_post, story) for each idea.
5. Avoid repeating topics from "Recent Published Content".
6. Honor the Brand DNA for tone, voice, and values.
7. Write scripts in the brand's natural language (typically Spanish).

Return valid JSON matching the schema.`
      },
      {
        role: 'user',
        content: contextBlock
      }
    ],
    response_format: zodResponseFormat(IdeationOutputSchema, 'IdeationOutput'),
  });

  const parsed = completion.choices[0].message.parsed;
  if (!parsed) {
    throw new Error('Failed to parse ideation AI response.');
  }

  return parsed as IdeationOutput;
}
