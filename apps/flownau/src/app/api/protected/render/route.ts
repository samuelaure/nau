export const dynamic = 'force-dynamic'

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/modules/shared/prisma'
import { Prisma } from '@prisma/client'
import { renderAndUpload } from '@/modules/video/renderer'
import { publishReel } from '@/modules/publisher/instagram-reels'
import { decrypt } from '@/modules/shared/encryption'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Not authorized' }, { status: 401 })

  const { templateId, instagramAccountId, publish = false, inputData = {} } = await req.json()

  try {
    const template = await prisma.template.findUnique({
      where: { id: templateId },
      include: { account: true },
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    let projectFolder = 'templates/global'
    if (template.account) {
      projectFolder = template.account.username || template.account.id
    }

    const render = await prisma.render.create({
      data: {
        templateId: template.id,
        status: 'RENDERING',
        inputData: inputData as Prisma.InputJsonValue,
      },
    })

    const r2Path = await renderAndUpload({
      templateId: template.remotionId,
      inputProps: inputData,
      renderId: render.id,
      projectFolder,
    })

    const fullUrl = `${process.env.R2_PUBLIC_URL}/${r2Path}`

    await prisma.render.update({
      where: { id: render.id },
      data: { status: publish ? 'QUEUED_IG' : 'COMPLETED', r2Url: fullUrl },
    })

    if (publish && instagramAccountId) {
      const account = await prisma.socialAccount.findUnique({ where: { id: instagramAccountId } })

      if (account && account.accessToken && account.platformId) {
        const mediaResult = await publishReel({
          accessToken: decrypt(account.accessToken),
          igUserId: account.platformId,
          videoUrl: fullUrl,
          caption: (inputData as Record<string, string>).Caption || 'automated post from flownaŭ',
        })

        if (mediaResult.success) {
          await prisma.render.update({
            where: { id: render.id },
            data: { status: 'PUBLISHED', instagramMediaId: mediaResult.externalId ?? null },
          })
        }
      }
    }

    return NextResponse.json({ success: true, renderId: render.id })
  } catch (error: unknown) {
    console.error('Render failed:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
