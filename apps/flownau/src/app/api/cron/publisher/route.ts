import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { renderAndUpload } from '@/modules/video/renderer'
import { publishVideoToInstagram } from '@/modules/accounts/instagram'

// Allow trigger without auth for cron jobs or basic manual hit
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max for rendering timeout

export async function GET() {
  try {
    const results = []
    const now = new Date()

    // --- PART A: Explicitly Scheduled Compositions ---
    const explicitCompositions = await prisma.composition.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { lte: now },
        publishAttempts: { lt: 3 },
      },
      include: {
        account: true,
      },
    })

    for (const composition of explicitCompositions) {
      if (
        !composition.account ||
        !composition.account.accessToken ||
        !composition.account.platformId
      ) {
        continue
      }
      try {
        await processCompositionPublishing(composition)
        results.push({ type: 'explicit', compositionId: composition.id, status: 'success' })
      } catch (err: any) {
        console.error(`[CRON_PUBLISHER_EXPLICIT_ERROR] Comp ${composition.id}:`, err)
        const attempts = composition.publishAttempts + 1
        await prisma.composition.update({
          where: { id: composition.id },
          data: {
            publishAttempts: attempts,
            lastPublishError: err.message,
            status: attempts >= 3 ? 'FAILED' : 'SCHEDULED',
          },
        })
        results.push({
          type: 'explicit',
          compositionId: composition.id,
          status: 'failed',
          error: err.message,
        })
      }
    }

    // --- PART B: Auto-Posted Compositions (PostingSchedule) ---
    const schedules = await prisma.postingSchedule.findMany({
      include: { account: true },
    })

    for (const schedule of schedules) {
      if (!schedule.account || !schedule.account.accessToken || !schedule.account.platformId) {
        continue
      }
      const msInDay = 24 * 60 * 60 * 1000
      const isDue =
        !schedule.lastPostedAt ||
        now.getTime() - new Date(schedule.lastPostedAt).getTime() >=
          schedule.frequencyDays * msInDay

      if (!isDue) {
        results.push({ type: 'auto', accountId: schedule.accountId, status: 'skipped_not_due' })
        continue
      }

      const composition = await prisma.composition.findFirst({
        where: { accountId: schedule.accountId, status: 'APPROVED' },
        orderBy: { createdAt: 'asc' },
        include: { account: true },
      })

      if (!composition) {
        results.push({ type: 'auto', accountId: schedule.accountId, status: 'skipped_no_approved' })
        continue
      }

      try {
        await processCompositionPublishing(composition)
        await prisma.postingSchedule.update({
          where: { id: schedule.id },
          data: { lastPostedAt: now },
        })
        results.push({ type: 'auto', compositionId: composition.id, status: 'success' })
      } catch (err: any) {
        console.error(`[CRON_PUBLISHER_AUTO_ERROR] Comp ${composition.id}:`, err)
        const attempts = composition.publishAttempts + 1
        await prisma.composition.update({
          where: { id: composition.id },
          data: {
            publishAttempts: attempts,
            lastPublishError: err.message,
            status: attempts >= 3 ? 'FAILED' : 'APPROVED',
          },
        })
        results.push({
          type: 'auto',
          compositionId: composition.id,
          status: 'failed',
          error: err.message,
        })
      }
    }

    return NextResponse.json({ message: 'Worker Execution Finished', results })
  } catch (error: any) {
    console.error('[CRON_PUBLISHER_FATAL]', error)
    return NextResponse.json(
      { error: 'Fatal worker failure', details: error.message },
      { status: 500 },
    )
  }
}

// Reusable publishing logic extracted from GET()
async function processCompositionPublishing(composition: any) {
  const account = composition.account

  // 3. Render and Upload to R2 (Headless Remotion)
  const renderResultKey = await renderAndUpload({
    templateId: 'DynamicTemplateMaster',
    inputProps: { schema: composition.payload },
    renderId: composition.id,
    projectFolder: account.username || account.id,
  })

  const bucketRaw =
    process.env.R2_PUBLIC_URL ||
    `https://${process.env.R2_BUCKET_NAME || 'flownau'}.r2.cloudflarestorage.com`
  const publicVideoUrl = `${bucketRaw}/${renderResultKey}`

  // 4. Extract Caption (Priority: Composition.caption -> Metadata)
  let caption = composition.caption || 'New Reel'
  if (!composition.caption) {
    const payload: any = composition.payload
    if (payload?.tracks?.text && payload.tracks.text.length > 0) {
      caption = payload.tracks.text[0].content || 'New Reel'
    }
  }

  // 5. Post to Instagram
  const igResult = await publishVideoToInstagram({
    accessToken: account.accessToken,
    instagramUserId: account.platformId,
    videoUrl: publicVideoUrl,
    caption: caption,
  })

  // 6. Finalize States
  await prisma.composition.update({
    where: { id: composition.id },
    data: {
      status: 'PUBLISHED',
      videoUrl: publicVideoUrl,
      externalPostId: igResult.id,
      externalPostUrl: igResult.permalink,
    },
  })
}
