export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { checkBrandAccess } from '@/modules/shared/actions'
import { generateContentIdeas } from '@/modules/ideation/ideation.service'
import { logError } from '@/modules/shared/logger'
import type { Prisma } from '@prisma/client'

export async function POST(req: Request) {
  try {
    const json = await req.json()
    const {
      brandId,
      personaId,
      frameworkId,
      concept,
      count: countOverride,
      source = 'manual',
    } = json

    if (!brandId) {
      return NextResponse.json({ error: 'Missing brandId' }, { status: 400 })
    }

    await checkBrandAccess(brandId)

    // 1. Fetch persona
    const persona = personaId
      ? await prisma.brandPersona.findUnique({ where: { id: personaId } })
      : ((await prisma.brandPersona.findFirst({
          where: { brandId, isDefault: true },
        })) ??
        (await prisma.brandPersona.findFirst({
          where: { brandId },
        })))

    if (!persona) {
      return NextResponse.json({ error: 'No Brand Persona setup yet.' }, { status: 400 })
    }

    // 2. Optionally fetch strategy framework (Strategy prompts are prioritized over Persona prompts for ideation)
    const framework = frameworkId
      ? await prisma.ideasFramework.findUnique({ where: { id: frameworkId } })
      : await prisma.ideasFramework.findFirst({ where: { brandId, isDefault: true } })

    // 3. Setup Context Based on Source
    let digest = undefined
    let sourceRef = null
    let count = 5
    let autoApprove = false
    let priority = 2

    if (source === 'automatic') {
      const { fetchBrandDigest } = await import('@/modules/ideation/sources/inspo-source')
      digest = await fetchBrandDigest(brandId)
      count =
        typeof countOverride === 'number' ? countOverride : ((persona as any).automaticCount ?? 5)
      autoApprove = (persona as any).automaticAutoApprove ?? false
      priority = 3
      sourceRef =
        digest && digest.attachedUrls.length > 0
          ? digest.attachedUrls.length === 1
            ? digest.attachedUrls[0]
            : JSON.stringify(digest.attachedUrls)
          : null
    } else {
      // Manual mode
      count =
        typeof countOverride === 'number' ? countOverride : ((persona as any).manualCount ?? 5)
      autoApprove = (persona as any).manualAutoApprove ?? false
      priority = 2
    }

    // 4. Generate ideas
    const output = await generateContentIdeas({
      brandName: persona.name,
      dna: persona.systemPrompt,
      strategy: framework?.systemPrompt,
      concept: concept ?? undefined,
      count,
      digest: digest ?? undefined,
    })

    const isAutoApproveIdeas = persona?.autoApproveIdeas ?? false

    // 5. Save ideas with correct source/priority/format
    const ops = output.ideas.map((idea) => {
      const ideaText = `[${idea.format.toUpperCase()}] Hook: ${idea.hook}\nAngle: ${idea.angle}\nScript: ${idea.script}\nCTA: ${idea.cta}`

      return prisma.contentIdea.create({
        data: {
          brandId,
          ideaText,
          format: idea.format,
          status: autoApprove ? 'APPROVED' : 'PENDING',
          source,
          priority,
          sourceRef,
        },
      })
    })

    const generatedIdeas = await Promise.all(ops)

    // 6. Auto-compose: if autoApproveIdeas is ON and ideas are approved, create Draft Compositions
    if (autoApprove && isAutoApproveIdeas) {
      const { compose } = await import('@/modules/composer/scene-composer')
      const { selectAssetsForCreative, commitAssetUsage } =
        await import('@/modules/composer/asset-curator')
      const { compileTimeline } = await import('@/modules/composer/timeline-compiler')

      const brandStyle = {
        primaryColor: '#6C63FF',
        accentColor: '#FF6584',
        fontFamily: 'sans-serif',
      }

      const isAutoApproveCompositions = persona?.autoApproveCompositions ?? false

      await Promise.allSettled(
        generatedIdeas.map(async (savedIdea, idx) => {
          const idea = output.ideas[idx]
          const format = idea.format as any
          try {
            const { creative } = await compose({
              ideaText: savedIdea.ideaText,
              brandId,
              format,
              personaId: persona.id,
            })
            const { sceneAssets, audioAsset } = await selectAssetsForCreative(
              creative,
              brandId,
              30,
            )
            const { schema } = compileTimeline(
              creative,
              sceneAssets,
              audioAsset,
              brandStyle,
              format,
            )
            const newComposition = await prisma.composition.create({
              data: {
                brandId,
                format,
                creative: creative as unknown as Prisma.InputJsonValue,
                payload: schema as unknown as Prisma.InputJsonValue,
                caption: creative.caption,
                hashtags: creative.hashtags,
                ideaId: savedIdea.id,
                status: isAutoApproveCompositions ? 'APPROVED' : 'DRAFT',
              },
            })
            await prisma.contentIdea.update({
              where: { id: savedIdea.id },
              data: { status: 'USED' },
            })
            const usedAssetIds = [...sceneAssets.values()].map((a) => a.id)
            if (audioAsset) usedAssetIds.push(audioAsset.id)
            await commitAssetUsage(usedAssetIds)
            return newComposition
          } catch (e) {
            logError('AUTO_COMPOSE_ERROR', e)
          }
        }),
      )
    }

    return NextResponse.json(
      {
        ideas: generatedIdeas,
        summary: output.briefSummary,
        autoComposed: autoApprove && isAutoApproveIdeas,
      },
      { status: 200 },
    )
  } catch (error: unknown) {
    logError('IDEA_GENERATION_ROUTE_ERROR', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to generate ideas', message }, { status: 500 })
  }
}
