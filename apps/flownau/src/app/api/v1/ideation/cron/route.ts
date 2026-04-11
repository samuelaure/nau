import { NextRequest, NextResponse } from 'next/server';
import { generateContentIdeas } from '@/modules/ideation/ideation.service';

export async function POST(request: NextRequest) {
  // Auth guard
  const authHeader = request.headers.get('authorization');
  const expectedKey = process.env.NAU_SERVICE_KEY;
  if (!expectedKey || !authHeader || authHeader !== `Bearer ${expectedKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { brandId } = body;

    if (!brandId) {
      return NextResponse.json({ error: 'Missing required field: brandId' }, { status: 400 });
    }

    // 1. Fetch Brand Persona and InspoItems from nauthenticity
    const nauthUrl = process.env.NAUTHENTICITY_URL || 'http://nauthenticity:3000';
    const [brandRes, inspoRes] = await Promise.all([
      fetch(`${nauthUrl}/api/v1/brands/${brandId}/persona`, {
        headers: { Authorization: `Bearer ${expectedKey}` }
      }),
      fetch(`${nauthUrl}/api/v1/inspo?brandId=${brandId}&status=pending`, {
        headers: { Authorization: `Bearer ${expectedKey}` }
      })
    ]);

    if (!brandRes.ok) {
      throw new Error('Failed to fetch brand persona from nauthenticity.');
    }

    const brandData = await brandRes.json();
    const inspoData = (inspoRes.ok ? await inspoRes.json() : []) as any[];

    if (inspoData.length === 0) {
      return NextResponse.json({ success: true, message: 'No pending InspoItems to process.' });
    }

    // 2. Fetch external injected strategy docs (mocked DB fetch)
    // Normally we'd fetch from Prisma ideation_context table
    const injectedDocuments: string[] = []; 

    // 3. Generate Ideation Brief
    const result = await generateContentIdeas({
      brandName: brandData.brandName,
      brandDNA: brandData.voicePrompt,
      inspoItems: inspoData.map(item => ({
        id: item.id,
        type: item.type,
        note: item.note,
        extractedHook: item.extractedHook,
        extractedTheme: item.extractedTheme,
        adaptedScript: item.adaptedScript,
        postCaption: item.post?.caption,
        postTranscript: item.post?.transcripts?.[0]?.text
      })),
      injectedDocuments,
      recentPosts: [] // TBD: fetch from nauthenticity Post table where status = published
    });

    // 4. Mark items as processed in nauthenticity
    for (const item of inspoData) {
      await fetch(`${nauthUrl}/api/v1/inspo/${item.id}/process`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${expectedKey}` }
      });
    }

    // 5. Format the Brief as Markdown
    const dateStr = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date());
    let briefMd = `📋 *Brief de Contenido — ${dateStr}*\n_Marca: ${brandData.brandName}_\n\n`;
    briefMd += `*💡 RESUMEN ESTRATÉGICO*\n${result.briefSummary}\n\n`;
    
    result.ideas.forEach((idea, idx) => {
      briefMd += `*IDEA ${idx + 1}: ${idea.hook}*\n`;
      briefMd += `📌 *Ángulo:* ${idea.angle}\n`;
      briefMd += `🎬 *Formato:* ${idea.format}\n`;
      briefMd += `📝 *Script:* ${idea.script}\n`;
      briefMd += `🎯 *Call to Action:* ${idea.cta}\n\n`;
    });
    
    briefMd += `_Basado en: ${inspoData.length} posts de Inspo Base._`;

    // 6. Deliver via Zazŭ
    const zazuUrl = process.env.ZAZU_INTERNAL_URL || 'http://zazu-bot:3000';
    try {
      await fetch(`${zazuUrl}/api/internal/notify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${expectedKey}`
        },
        body: JSON.stringify({
          type: 'content_brief',
          payload: {
            brandName: brandData.brandName,
            markdown: briefMd
          }
        })
      });
    } catch (e) {
      console.warn('[Ideation] Warning: Could not deliver brief via Zazu', e);
    }

    // 7. Save archive in 9nau (journal_summary block structure)
    const nauApiUrl = process.env.NAU_INTERNAL_URL || 'http://9nau-api:3000';
    try {
      await fetch(`${nauApiUrl}/api/journal/summary/direct`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${expectedKey}`
        },
        body: JSON.stringify({
          periodType: 'daily',
          type: 'content_brief',
          synthesis: result.briefSummary,
          summary: briefMd,
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString()
        })
      });
    } catch (e) {
      console.warn('[Ideation] Warning: Could not archive brief in 9naŭ', e);
    }

    return NextResponse.json({ success: true, ideasGenerated: result.ideas.length });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Ideation Cron] Error in brief pipeline:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
