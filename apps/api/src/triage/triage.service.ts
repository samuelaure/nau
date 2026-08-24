import { Injectable, Logger } from '@nestjs/common';
import { getClientForFeature } from '@nau/llm-client';
import { z } from 'zod';
import { BlocksService } from '../blocks/blocks.service';
import { NauthenticityService } from '../integrations/nauthenticity.service';
import { FlownauIntegrationService } from '../integrations/flownau.service';
import { PrismaService } from '../prisma/prisma.service';
import dayjs from 'dayjs';

/** Types that are answerable on a day, and therefore need a schedule. */
const SCHEDULABLE_TYPES = new Set(['action', 'habit', 'appointment']);

const TriageResultSchema = z.object({
  segments: z.array(z.object({
    category: z.enum([
      'action', 'project', 'habit', 'appointment',
      'someday_maybe', 'reference', 'content_idea'
    ]),
    reasoning: z.string(),
    text: z.string(),
    metadata: z.object({
      priority: z.enum(['low', 'medium', 'high']).nullable().optional(),
      deadline: z.string().nullable().optional(),
      brandId: z.string().nullable().optional(),
      brandName: z.string().nullable().optional(),
      frequency: z.string().nullable().optional(),
      topic: z.string().nullable().optional(),
    }).nullable().optional()
  })),
});

export type TriageResult = z.infer<typeof TriageResultSchema>;

@Injectable()
export class TriageService {
  private readonly logger = new Logger(TriageService.name);

  constructor(
    private readonly blocksService: BlocksService,
    private readonly nauthenticityService: NauthenticityService,
    private readonly flownauService: FlownauIntegrationService,
    private readonly prisma: PrismaService,
  ) {}

  async processRawText(
    text: string,
    userId: string,
    sourceBlockId?: string,
    brandId?: string | null,
    workspaceId?: string,
    journalOnly?: boolean,
    capturedAt?: string,
    rawText?: string,
  ) {

    try {
      // ── Journal-only fast path ──────────────────────────────────────────────
      if (journalOnly) {
        let resolvedWorkspaceId = workspaceId;
        if (!resolvedWorkspaceId) {
          const user = await this.prisma.user.findFirst({
            where: {
              OR: [
                { id: userId },
                { telegramId: userId },
              ],
            },
            include: { workspaces: { take: 1 } },
          });
          resolvedWorkspaceId = user?.workspaces?.[0]?.workspaceId;
        }
        // userId arrives from Zazu but was never passed on, so every journal
        // entry was written with no record of who wrote it. The caller may send
        // a Telegram id, so resolve it to the naŭ user before stamping.
        const owner = await this.prisma.user.findFirst({
          where: { OR: [{ id: userId }, { telegramId: userId }] },
          select: { id: true },
        });

        return await this.processJournalOnly(
          text,
          sourceBlockId,
          resolvedWorkspaceId,
          owner?.id,
          capturedAt,
          rawText,
        );
      }

      // 1. Fetch context — projects + brand DNA
      const recentBlocks = await this.blocksService.findAllInternal({});

      const activeProjects = recentBlocks
        .filter(b => b.type === 'project' && (b.properties as any)?.status !== 'done')
        .slice(0, 10)
        .map(b => `- ${(b.properties as any)?.name || 'Untitled'} (ID: ${b.id})`)
        .join('\n');

      // 2. Resolve workspaceId from DB if not supplied
      let resolvedWorkspaceId = workspaceId;
      if (!resolvedWorkspaceId) {
        const user = await this.prisma.user.findFirst({
          where: {
            OR: [
              { id: userId },
              { telegramId: userId },
            ],
          },
          include: { workspaces: { take: 1 } },
        });
        resolvedWorkspaceId = user?.workspaces?.[0]?.workspaceId;
      }

      // 3. Determine brand context and whether AI routing is needed
      let brandsForPrompt: Array<{ id: string; brandName: string; voicePrompt: string }> = [];
      let aiRoutingEnabled = false;

      if (brandId) {
        // Explicit brand selected by user — fetch its dna-light for context, no AI routing needed
        const dna = await this.nauthenticityService.getBrandDnaLight(brandId);
        if (dna) brandsForPrompt = [dna];
      } else if (resolvedWorkspaceId) {
        // No brand selected → fetch all workspace brands for AI detection
        brandsForPrompt = await this.nauthenticityService.getBrandsForWorkspace(resolvedWorkspaceId);
        aiRoutingEnabled = brandsForPrompt.length > 0;
      }

      const brandsSection = brandsForPrompt.length > 0
        ? brandsForPrompt.map(b => `- ${b.brandName} (ID: ${b.id})\n  Voice/DNA: ${b.voicePrompt}`).join('\n')
        : 'No brands registered.';

      // 4. Build system prompt
      const aiRoutingNote = aiRoutingEnabled
        ? `\nIMPORTANT — AI BRAND ROUTING: The user did NOT specify a brand. You MUST analyze each content_idea segment and match it to the most fitting brand using the Brand DNA above. Populate brandId and brandName based on which brand the idea best aligns with. If no brand fits, leave brandId empty.`
        : brandId
          ? `\nBrand context provided: all content_ideas should be linked to the brand with ID "${brandId}" unless clearly unrelated.`
          : '';

      // 5. Call LLM via abstraction layer
      this.logger.log(`Calling LLM for triage... Brands: ${brandsForPrompt.length}, AI routing: ${aiRoutingEnabled}`);

      const { client: llm, model } = getClientForFeature('triage');
      const result = await llm.parseCompletion<TriageResult>({
        model,
        temperature: 0.1,
        schema: TriageResultSchema as any,
        schemaName: 'TriageResult',
        messages: [
          {
            role: 'system',
            content: `You are an expert AI productivity assistant. Your job is to listen to raw voice captures or scattered notes and triage them into structured segments.
You act as a Second Brain router.

CATEGORIES ALLOWED:
- action: A concrete, actionable task. Extract priority and deadline if mentioned.
- project: A larger goal with multiple steps.
- habit: A recurring behavior.
- appointment: A scheduled event or meeting. Extract datetime.
- someday_maybe: An idea to do someday but not actionable soon.
- reference: Useful knowledge, facts, or information to keep. Extract topic.
- content_idea: A creative idea for social media/creator content. Detect if it applies to one of the user's brands.

YOUR CONTEXT:
Active Projects:
${activeProjects || 'No active projects found.'}

User Brands:
${brandsSection}
${aiRoutingNote}

RULES:
1. Break down the user's input into logical segments. Each segment should have exactly ONE category.
2. If a segment is an idea for social media, map it to 'content_idea'. Populate brandId and brandName if a matching brand is found.
3. If an action could belong to a project, note the project topic.
4. Use the user's own wording for each segment's text. Do not paraphrase, summarise or translate it.
5. If nothing in the input fits a category, return an empty segments array. Do not invent a segment to have something to return.

OUTPUT: Return valid JSON matching the schema.`,
          },
          { role: 'user', content: text },
        ],
      });

      const parsed = result.data;

      // 6. Save blocks — pass through explicit brandId and aiRouting flag
      const createdBlocks = await this.saveTriagedBlocks(parsed, sourceBlockId, brandId, aiRoutingEnabled, resolvedWorkspaceId);

      return {
        success: true,
        summary: `Procesé tu texto: ${parsed.segments.length} bloques creados. Diario actualizado.`,
        blocks: createdBlocks,
        rawResult: parsed
      };
    } catch (error) {
      this.logger.error('Error during triage processing', error);
      throw error;
    }
  }

  /**
   * Gives a block a one-day schedule on the day it was captured.
   *
   * Best-effort: a capture that lands without a schedule is recoverable — it
   * shows up and can be dragged onto a day — while a capture lost because the
   * schedule write failed is not.
   */
  private async scheduleFor(blockId: string, dateIso?: string) {
    try {
      const day = dayjs(dateIso ?? new Date().toISOString());
      await this.prisma.schedule.create({
        data: {
          blockId,
          startDate: day.startOf('day').toDate(),
          endDate: day.endOf('day').toDate(),
          recurrenceMode: 'FIXED',
        },
      });
    } catch (err) {
      this.logger.warn(`Could not schedule block ${blockId}: ${String(err)}`);
    }
  }

  private async saveTriagedBlocks(
    result: TriageResult,
    sourceBlockId?: string,
    explicitBrandId?: string | null,
    aiRoutingEnabled = false,
    workspaceId?: string,
  ) {
    const createdBlocks = [];

    for (const segment of result.segments) {
      const type = segment.category;

      const properties: any = {
        text: segment.text,
        reasoning: segment.reasoning,
        source: 'triage_engine',
        status: 'todo',
        date: new Date().toISOString(),
      };

      if (segment.category === 'action' && segment.metadata) {
        properties.priority = segment.metadata.priority;
        properties.deadline = segment.metadata.deadline;
      }

      if (segment.category === 'project') {
        properties.name = segment.text;
      }

      if (segment.category === 'content_idea') {
        // Prefer explicit brandId from user selection; fall back to AI-detected one
        const resolvedBrandId = explicitBrandId ?? segment.metadata?.brandId ?? null;
        const resolvedBrandName = segment.metadata?.brandName ?? null;

        // aiLinked = true when brand was detected by AI (no explicit selection)
        const aiLinked = resolvedBrandId !== null && !explicitBrandId && aiRoutingEnabled;

        properties.brandId = resolvedBrandId;
        properties.brandName = resolvedBrandName;
        properties.aiLinked = aiLinked;
        properties.flownauSyncStatus = 'pending';
      }

      const block = await this.blocksService.createInternal({ type, properties, workspaceId });

      // Anything that can be done gets a schedule at the moment it is created.
      // Without one it exists but is due nowhere, which is exactly how six
      // actions came to be invisible on the agenda while sitting in plain view
      // at home. The capture day is the honest default: it is when the person
      // said it, and moving it is one drag.
      if (SCHEDULABLE_TYPES.has(type)) {
        await this.scheduleFor(block.id, properties.date as string);
      }

      // Forward content_idea blocks with a resolved brand to flownaŭ
      if (segment.category === 'content_idea' && properties.brandId) {
        try {
          // Resolve brandId → flownaŭ accountId
          const accountId = await this.flownauService.resolveAccountByBrandId(properties.brandId);

          if (accountId) {
            await this.flownauService.ingestIdeas(accountId, [
              { text: segment.text, sourceRef: block.id, aiLinked: properties.aiLinked },
            ]);
            await this.blocksService.updateInternal(block.id, {
              properties: { flownauSyncStatus: 'success' },
            });
          } else {
            this.logger.warn(`[Flownau-Integration] No flownaŭ account found for brandId ${properties.brandId}. Idea not forwarded.`);
            await this.blocksService.updateInternal(block.id, {
              properties: { flownauSyncStatus: 'no_account' },
            });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error(
            `[Flownau-Integration-Error] Failed to ingest idea block ${block.id}: ${msg}`,
          );
          await this.blocksService.updateInternal(block.id, {
            properties: { flownauSyncStatus: 'error' },
          });
        }
      }

      createdBlocks.push(block);
    }

    // No journal entry is written here.
    //
    // This path runs when the capture was routed to tasks or ideas, so no diary
    // entry was asked for — and what it used to write was a `journalSummary`
    // the model produced under "keep it brief and reflective": a summary of the
    // capture, often in third person and in whatever language the model chose.
    // The one such entry in production reads "Today's focus includes scheduling
    // and communication tasks", which is nobody's diary.
    //
    // The journal is fed by the journal path, where the person's own words are
    // what gets stored.

    return createdBlocks;
  }

  /**
   * Journal-only fast path: stores the capture as a journal_entry.
   *
   * The text is stored as it arrives. Callers send text that has already been
   * cleaned once — Zazŭ transcribes, cleans the disfluencies out, and where the
   * note mixed intents splits the journal part out of it. Running a further
   * distillation here made three model rewrites stand between what the person
   * said and what their diary records, and every one of them moves the wording
   * a little further from theirs.
   *
   * `rawText` carries the untouched transcription so the original is never lost.
   */
  private async processJournalOnly(
    text: string,
    sourceBlockId?: string,
    workspaceId?: string,
    userId?: string,
    capturedAt?: string,
    rawText?: string,
  ) {
    const journalBlock = await this.blocksService.createInternal({
      type: 'journal_entry',
      properties: {
        summary: text,
        raw: rawText ?? text,
        // When the note was recorded, not when it happened to be processed. A
        // journal entry that lands on the wrong day because ingestion was slow
        // is wrong in the one dimension a journal is organised by.
        date: capturedAt ?? new Date().toISOString(),
        sourceBlockId,
        source: 'zazu_voicenote',
        status: 'published',
      },
      workspaceId,
      userId,
    });

    return {
      success: true,
      summary: 'Entrada de diario guardada.',
      blocks: [journalBlock],
      rawResult: { segments: [], journalEntry: text },
    };
  }

  /**
   * Returns ultra-light brand list for a user. Used by Zazŭ to populate the brand selection keyboard.
   */
  async getUserBrands(userId: string): Promise<Array<{ id: string; brandName: string }>> {
    try {
      const user = await this.prisma.user.findFirst({
        where: { OR: [{ id: userId }, { telegramId: userId }] },
        include: { workspaces: { take: 1 } },
      });
      const workspaceId = user?.workspaces?.[0]?.workspaceId;
      if (!workspaceId) return [];

      const brands = await this.nauthenticityService.getBrandsForWorkspace(workspaceId);
      return brands.map(b => ({ id: b.id, brandName: b.brandName }));
    } catch {
      return [];
    }
  }

  async retroprocess(userId: string) {
    const captures = await this.blocksService.findAllInternal({ type: 'voice_capture' });
    
    const pendingCaptures = captures.filter(b => {
      const props = b.properties as any;
      return !props?.triageStatus || props?.triageStatus === 'pending';
    });

    this.logger.log(`Found ${pendingCaptures.length} pending voice captures for retroprocessing.`);

    const results = [];
    for (const capture of pendingCaptures) {
      try {
        const text = (capture.properties as any)?.text;
        if (!text) {
           await this.blocksService.updateInternal(capture.id, {
             properties: { triageStatus: 'error', error: 'No text found' }
           });
           continue;
        }

        const result = await this.processRawText(text, userId, capture.id);
        
        await this.blocksService.updateInternal(capture.id, {
           properties: { triageStatus: 'processed' }
        });

        results.push({ id: capture.id, success: true, blocksCreated: result.blocks.length });
      } catch (error) {
        this.logger.error(`Failed to retroprocess capture ${capture.id}`, error);
        await this.blocksService.updateInternal(capture.id, {
           properties: { triageStatus: 'error', error: String(error) }
        });
        results.push({ id: capture.id, success: false, error: String(error) });
      }
    }

    return {
      processedCount: results.length,
      results
    };
  }
}
