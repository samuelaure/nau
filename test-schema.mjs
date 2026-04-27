import { z } from 'zod';
import { zodToJsonSchema } from '/c/Users/Sam/code/nau/packages/llm-client/node_modules/.ignored/openai/_vendor/zod-to-json-schema/index.js';

const IdeationOutputSchema = z.object({
  ideas: z.array(
    z.object({
      hook: z.string().describe('A compelling opening hook for the content piece.'),
      angle: z.string().describe('The unique angle or perspective for this idea.'),
      script: z.string().describe('A full content script or narrative, ready for recording.'),
      cta: z.string().describe('A call-to-action suggestion.'),
      format: z
        .enum(['reel', 'trial_reel', 'head_talk', 'carousel', 'static_post', 'story'])
        .describe('Recommended content format.'),
      inspoItemId: z.string().describe('ID of the InspoItem that inspired this, or empty string if none.'),
    }),
  ),
  briefSummary: z.string().describe('A brief meta-summary of the ideation session.'),
});

const schema = zodToJsonSchema(IdeationOutputSchema, {
  openaiStrictMode: true,
  name: 'IdeationOutput',
  nameStrategy: 'duplicate-ref',
  $refStrategy: 'extract-to-root',
  nullableStrategy: 'property',
});

console.log(JSON.stringify(schema, null, 2));
