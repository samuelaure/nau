import { NextRequest, NextResponse } from 'next/server'
import { storage } from '@/modules/shared/r2'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const prefix = searchParams.get('prefix') || ''

  try {
    const { objects, prefixes } = await storage.list(prefix, { delimiter: '/' })

    const folders = prefixes
    const files = objects
      .filter((obj) => obj.key !== prefix)
      .map((obj) => ({
        key: obj.key,
        size: obj.size,
        lastModified: obj.lastModified,
      }))

    return NextResponse.json({ folders, files })
  } catch (error: unknown) {
    console.error('Failed to list R2 objects', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
