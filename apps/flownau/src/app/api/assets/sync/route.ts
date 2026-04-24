export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { pipeline } from 'stream'
import { promisify } from 'util'
import { logger } from '@/lib/logger'

const streamPipeline = promisify(pipeline)

export async function POST(req: NextRequest) {
  try {
    const { urls } = await req.json()
    if (!urls || !Array.isArray(urls)) {
      return NextResponse.json({ error: 'Invalid URLs' }, { status: 400 })
    }

    // 1. Ensure cache directory exists
    const CACHE_DIR = path.join(process.cwd(), 'public', 'cache_assets')
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true })
    }

    const mapping: Record<string, string> = {}

    // 2. Process each URL
    for (const url of urls) {
      // Skip invalid or empty URLs
      if (!url || url === 'placeholder' || url.startsWith('placeholder_')) {
        continue
      }

      try {
        // Generate a deterministic filename based on URL to allow re-use
        const hash = crypto.createHash('md5').update(url).digest('hex')
        const ext = path.extname(new URL(url).pathname) || '.mp4'
        const filename = `${hash}${ext}`
        const localPath = path.join(CACHE_DIR, filename)
        const publicUrl = `/cache_assets/${filename}`

        // 3. Download if not already cached
        if (!fs.existsSync(localPath)) {
          logger.info({ url, filename }, 'Downloading asset')
          const response = await fetch(url)
          if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`)
          if (!response.body) throw new Error(`No body for ${url}`)

          const fileStream = fs.createWriteStream(localPath)
          // Use standard Node.js streaming for large assets
          await streamPipeline(response.body as any, fileStream)
          logger.info({ filename }, 'Asset downloaded')
        } else {
          logger.debug({ filename }, 'Asset cache hit')
        }

        mapping[url] = publicUrl
      } catch (err) {
        logger.error({ err, url }, 'Error processing asset sync')
      }
    }

    return NextResponse.json({ mapping })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error({ err: msg }, 'Asset Sync API error')
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
