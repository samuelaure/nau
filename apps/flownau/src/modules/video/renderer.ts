import { bundle } from '@remotion/bundler'
import { renderMedia, getCompositions } from '@remotion/renderer'
import path from 'path'
import { storage } from '@/modules/shared/r2'
import { flownau } from 'nau-storage'
import fs from 'fs'
import { logger } from '@/lib/logger'

export async function renderAndUpload({
  templateId,
  inputProps,
  renderId,
  accountId,
}: {
  templateId: string
  inputProps: Record<string, unknown>
  renderId: string
  accountId: string
}) {
  const entry = path.join(process.cwd(), 'src/modules/video/remotion/index.tsx')
  const outputDir = path.join(process.cwd(), 'out')

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir)
  }

  const outputLocation = path.join(outputDir, `render-${renderId}.mp4`)

  logger.info({ renderId, templateId }, 'Bundling Remotion composition...')
  const bundleLocation = await bundle(entry, undefined, {
    webpackOverride: (config) => ({
      ...config,
      resolve: {
        ...config.resolve,
        alias: {
          ...(config.resolve?.alias as Record<string, string> | undefined),
          '@': path.join(process.cwd(), 'src'),
        },
      },
    }),
  })

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

  const r2Key = flownau.renderOutput(accountId, renderId)
  logger.info({ renderId, r2Key }, 'Uploading render to R2...')
  const fileStream = fs.createReadStream(outputLocation)

  const publicUrl = await storage.upload(r2Key, fileStream, { mimeType: 'video/mp4' })

  // Cleanup
  fs.unlinkSync(outputLocation)

  return publicUrl
}
