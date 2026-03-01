import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { renderAndUpload } from '@/modules/video/renderer'
import { publishVideoToInstagram } from '@/modules/accounts/instagram'

// Allow trigger without auth for cron jobs or basic manual hit
export const maxDuration = 300 // 5 minutes max for rendering timeout

export async function GET() {
  try {
    const schedules = await prisma.postingSchedule.findMany({
      include: {
        account: true,
      },
    })

    const results = []

    for (const schedule of schedules) {
      if (!schedule.account || !schedule.account.accessToken || !schedule.account.platformId) {
        continue
      }

      // 1. Determine if Due
      const msInDay = 24 * 60 * 60 * 1000
      const isDue =
        !schedule.lastPostedAt ||
        Date.now() - new Date(schedule.lastPostedAt).getTime() >= schedule.frequencyDays * msInDay

      if (!isDue) {
        results.push({ accountId: schedule.accountId, status: 'skipped_not_due' })
        continue
      }

      // 2. Fetch Oldest APPROVED Composition
      const composition = await prisma.composition.findFirst({
        where: { accountId: schedule.accountId, status: 'APPROVED' },
        orderBy: { createdAt: 'asc' }, // Oldest first
      })

      if (!composition) {
        results.push({ accountId: schedule.accountId, status: 'skipped_no_approved_compositions' })
        continue
      }

      try {
        // 3. Render and Upload to R2 (Headless Remotion)
        const renderResultKey = await renderAndUpload({
          templateId: 'DynamicTemplateMaster',
          inputProps: { schema: composition.payload },
          renderId: composition.id,
        })

        const bucketRaw = process.env.R2_PUBLIC_URL
          ? process.env.R2_PUBLIC_URL
          : `https://${process.env.R2_BUCKET_NAME || 'flownau'}.r2.cloudflarestorage.com`

        const publicVideoUrl = `${bucketRaw}/${renderResultKey}`

        // 4. Extract Caption (Fallback safely)
        let caption = 'New Reel'
        const payload: any = composition.payload
        if (payload?.tracks?.text && payload.tracks.text.length > 0) {
          caption = payload.tracks.text[0].content || 'New Reel'
        }

        // 5. Post to Instagram
        const igMediaId = await publishVideoToInstagram({
          accessToken: schedule.account.accessToken,
          instagramUserId: schedule.account.platformId,
          videoUrl: publicVideoUrl,
          caption: caption,
        })

        // 6. Finalize States
        await prisma.composition.update({
          where: { id: composition.id },
          data: { status: 'PUBLISHED', videoUrl: publicVideoUrl },
        })

        await prisma.postingSchedule.update({
          where: { id: schedule.id },
          data: { lastPostedAt: new Date() },
        })

        results.push({
          accountId: schedule.accountId,
          status: 'success',
          compositionId: composition.id,
          igMediaId,
        })
      } catch (err: any) {
        console.error(`[WORKER_ERROR_ACCOUNT_${schedule.accountId}]`, err)
        results.push({ accountId: schedule.accountId, status: 'failed', error: err.message })
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
