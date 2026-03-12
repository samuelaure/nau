import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { PipelinePromise, pipeline } from 'stream'
import { promisify } from 'util'

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
          console.log(`[Asset Sync] Downloading: ${url} -> ${filename}`)
          const response = await fetch(url)
          if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`)
          if (!response.body) throw new Error(`No body for ${url}`)

          const fileStream = fs.createWriteStream(localPath)
          // Use standard Node.js streaming for large assets
          await streamPipeline(response.body as any, fileStream)
          console.log(`[Asset Sync] Downloaded: ${filename}`)
        } else {
          console.log(`[Asset Sync] Cache hit: ${filename}`)
        }

        mapping[url] = publicUrl
      } catch (err) {
        console.error(`[Asset Sync] Error processing ${url}:`, err)
      }
    }

    return NextResponse.json({ mapping })
  } catch (error: any) {
    console.error('[Asset Sync API Error]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
