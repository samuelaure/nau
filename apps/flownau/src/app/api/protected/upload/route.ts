import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { r2, R2_BUCKET } from '@/modules/shared/r2'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import {
  compressVideo,
  compressAudio,
  getTempPath,
  generateThumbnail,
} from '@/modules/video/ffmpeg'
import fs from 'fs/promises'
import { createReadStream } from 'fs'

export async function POST(req: NextRequest) {
  console.log('Starting upload processing...')
  // 1. Parse FormData
  const formData = await req.formData()
  const file = formData.get('file') as File
  const accountId = formData.get('accountId') as string | null
  const templateId = formData.get('templateId') as string | null
  const clientHash = formData.get('hash') as string

  if (!file || (!accountId && !templateId)) {
    return NextResponse.json(
      { error: 'Missing file or context (accountId/templateId)' },
      { status: 400 },
    )
  }

  // 2. Determine Context & ShortCode
  let contextAccountId = accountId
  let shortCode = 'XX'
  let projectFolder = 'uploads'

  if (templateId) {
    // If uploading to a template, check if it's linked to an account
    const template = await prisma.template.findUnique({
      where: { id: templateId },
      include: { account: true },
    })

    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

    if (template.account) {
      contextAccountId = template.accountId
      shortCode = template.account.shortCode || 'AC'
      projectFolder = template.account.username || template.account.id
    } else {
      // Global template
      shortCode = 'TMP'
      projectFolder = 'templates/global'
    }
  } else if (accountId) {
    // Direct account upload
    const account = await prisma.socialAccount.findUnique({ where: { id: accountId } })
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

    shortCode = account.shortCode || 'AC'
    if (!account.shortCode && account.username) {
      shortCode = account.username.substring(0, 2).toUpperCase()
      await prisma.socialAccount.update({ where: { id: accountId }, data: { shortCode } })
    }
    projectFolder = account.username || account.id
  }

  // 3. Determine Type
  let type: 'VID' | 'AUD' | 'IMG' = 'IMG'
  if (file.type.startsWith('video/')) type = 'VID'
  else if (file.type.startsWith('audio/')) type = 'AUD'
  else if (file.type.startsWith('image/')) type = 'IMG'
  else return NextResponse.json({ error: 'Unsupported type' }, { status: 400 })

  // 4. Save to Temp
  const inputPath = getTempPath(file.name)
  const buffer = Buffer.from(await file.arrayBuffer())
  await fs.writeFile(inputPath, buffer)
  console.log(`Saved temp file to ${inputPath}`)

  try {
    // 5. Optimize
    let outputPath = inputPath
    let finalExt = file.name.split('.').pop() || ''
    let finalMime = file.type
    let thumbPath: string | null = null

    if (type === 'VID') {
      finalExt = 'mp4'
      finalMime = 'video/mp4'
      outputPath = getTempPath(`optimized_${Date.now()}.mp4`)
      await compressVideo(inputPath, outputPath)

      // Generate thumbnail
      thumbPath = getTempPath(`thumb_${Date.now()}.jpg`)
      try {
        await generateThumbnail(outputPath, thumbPath)
      } catch (e) {
        console.error('Thumbnail generation failed, continuing without it', e)
        thumbPath = null
      }
    } else if (type === 'AUD') {
      finalExt = 'm4a'
      finalMime = 'audio/mp4'
      outputPath = getTempPath(`optimized_${Date.now()}.m4a`)
      await compressAudio(inputPath, outputPath)
    }

    // 6. Naming
    const prefix = `${shortCode}_${type}_`

    const whereClause: { templateId?: string; accountId?: string } = {}
    if (templateId) whereClause.templateId = templateId
    else if (contextAccountId) whereClause.accountId = contextAccountId

    const lastAsset = await prisma.asset.findFirst({
      where: {
        ...whereClause,
        systemFilename: { startsWith: prefix },
      },
      orderBy: { systemFilename: 'desc' },
    })

    let counter = 1
    if (lastAsset) {
      const parts = lastAsset.systemFilename.split('_')
      const numPart = parts.length > 2 ? parts[2].split('.')[0] : null
      if (numPart && !isNaN(parseInt(numPart))) {
        counter = parseInt(numPart) + 1
      }
    }
    const systemFilename = `${prefix}${counter.toString().padStart(4, '0')}.${finalExt}`
    const folder = type === 'VID' ? 'videos' : type === 'AUD' ? 'audios' : 'images'
    const r2Key = `${projectFolder}/${folder}/${systemFilename}`

    // 7. Upload to R2 from Optimized Path
    const fileStream = createReadStream(outputPath)
    const stats = await fs.stat(outputPath)

    console.log(`Uploading ${r2Key} (${stats.size} bytes)`)

    await r2.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: r2Key,
        Body: fileStream,
        ContentType: finalMime,
        ContentLength: stats.size,
      }),
    )

    // Upload thumbnail if exists
    let thumbnailUrl: string | null = null
    if (thumbPath) {
      const thumbKey = `${projectFolder}/thumbnails/${systemFilename.split('.')[0]}_thumb.jpg`
      const thumbStream = createReadStream(thumbPath)
      const thumbStats = await fs.stat(thumbPath)

      await r2.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: thumbKey,
          Body: thumbStream,
          ContentType: 'image/jpeg',
          ContentLength: thumbStats.size,
        }),
      )

      thumbnailUrl = process.env.R2_PUBLIC_URL
        ? `${process.env.R2_PUBLIC_URL}/${thumbKey}`
        : `https://${R2_BUCKET}.r2.cloudflarestorage.com/${thumbKey}`
    }

    // 8. DB Record
    const publicUrl = process.env.R2_PUBLIC_URL
      ? `${process.env.R2_PUBLIC_URL}/${r2Key}`
      : `https://${R2_BUCKET}.r2.cloudflarestorage.com/${r2Key}`

    const asset = await prisma.asset.create({
      data: {
        accountId: contextAccountId,
        templateId: templateId || null,
        originalFilename: file.name,
        systemFilename,
        r2Key,
        size: stats.size,
        mimeType: finalMime,
        hash: clientHash,
        type,
        url: publicUrl,
        thumbnailUrl: thumbnailUrl,
      },
    })

    // 9. Cleanup
    await fs.unlink(inputPath).catch(console.error)
    if (outputPath !== inputPath) {
      await fs.unlink(outputPath).catch(console.error)
    }
    if (thumbPath) {
      await fs.unlink(thumbPath).catch(console.error)
    }

    return NextResponse.json({ success: true, asset })
  } catch (error: unknown) {
    console.error('Processing failed', error)
    await fs.unlink(inputPath).catch(() => {})
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
