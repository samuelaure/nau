import { bundle } from '@remotion/bundler'
import { renderMedia, getCompositions } from '@remotion/renderer'
import path from 'path'
import { r2, R2_BUCKET } from '@/modules/shared/r2'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import fs from 'fs'
import { logger } from '@/lib/logger'

export async function renderAndUpload({
  templateId,
  inputProps,
  renderId,
  projectFolder,
}: {
  templateId: string
  inputProps: Record<string, unknown>
  renderId: string
  projectFolder: string
}) {
  const entry = path.join(process.cwd(), 'src/modules/video/remotion/index.tsx')
  const outputDir = path.join(process.cwd(), 'out')

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir)
  }

  const outputLocation = path.join(outputDir, `render-${renderId}.mp4`)

  logger.info({ renderId, templateId }, 'Bundling Remotion composition...')
  const bundleLocation = await bundle(entry)

  const comps = await getCompositions(bundleLocation, { inputProps })
  const composition = comps.find((c) => c.id === templateId)

  if (!composition) {
    throw new Error(`Composition ${templateId} not found`)
  }

  logger.info({ renderId, templateId }, 'Rendering media...')
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    outputLocation,
    inputProps,
    codec: 'h264',
  })

  logger.info({ renderId, r2Key: `${projectFolder}/outputs/${renderId}.mp4` }, 'Uploading render to R2...')
  const fileStream = fs.createReadStream(outputLocation)
  const r2Key = `${projectFolder}/outputs/${renderId}.mp4`
  const uploadParams = {
    Bucket: R2_BUCKET,
    Key: r2Key,
    Body: fileStream,
    ContentType: 'video/mp4',
  }

  await r2.send(new PutObjectCommand(uploadParams))

  // Cleanup
  fs.unlinkSync(outputLocation)

  return r2Key
}
