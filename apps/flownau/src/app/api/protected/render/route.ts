import { auth } from '@/auth'
import { prisma } from '@/modules/shared/prisma'
import { getTableData } from '@/modules/video/airtable'
import { renderAndUpload } from '@/modules/video/renderer'
import { publishVideoToInstagram } from '@/modules/accounts/instagram'
import { decrypt } from '@/modules/shared/encryption'
import { NextResponse } from 'next/server'

export const POST = auth(async function POST(req) {
  if (!req.auth) return NextResponse.json({ error: 'Not authorized' }, { status: 401 })

  const { templateId, instagramAccountId, publish = false } = await req.json()

  try {
    const template = await prisma.template.findUnique({
      where: { id: templateId },
    })

    if (!template || !template.airtableTableId) {
      return NextResponse.json({ error: 'Template or Table ID not found' }, { status: 404 })
    }

    // 1. Fetch data from Airtable
    const airtableData = await getTableData(template.airtableTableId)

    // For this example, we take the first pending/ready row
    const row = airtableData[0] // Logic could be more complex here

    // 2. Create Render record
    const render = await prisma.render.create({
      data: {
        templateId: template.id,
        status: 'RENDERING',
        inputData: row as any,
      },
    })

    // 3. Render and Upload
    // We pass the row data as inputProps to Remotion
    const r2Path = await renderAndUpload({
      templateId: template.remotionId,
      inputProps: row,
      renderId: render.id,
    })

    const fullUrl = `${process.env.R2_PUBLIC_URL}/${r2Path}`

    // 4. Update Render
    await prisma.render.update({
      where: { id: render.id },
      data: {
        status: publish ? 'QUEUED_IG' : 'COMPLETED',
        r2Url: fullUrl,
      },
    })

    // 5. Publish to Instagram if requested
    if (publish && instagramAccountId) {
      const account = await prisma.socialAccount.findUnique({
        where: { id: instagramAccountId },
      })

      if (account && account.accessToken && account.platformId) {
        const mediaId = await publishVideoToInstagram({
          accessToken: decrypt(account.accessToken),
          instagramUserId: account.platformId,
          videoUrl: fullUrl,
          caption: (row as any).Caption || 'Automated post from Flownau',
        })

        await prisma.render.update({
          where: { id: render.id },
          data: {
            status: 'PUBLISHED',
            instagramMediaId: mediaId,
          },
        })
      }
    }

    return NextResponse.json({ success: true, renderId: render.id })
  } catch (error: any) {
    console.error('Render failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
})
