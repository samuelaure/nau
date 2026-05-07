import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Replaced by presign + confirm flow to avoid buffering large files through the server.
// POST /api/protected/upload/presign  — get a presigned R2 URL
// POST /api/protected/upload/confirm  — register the asset after direct upload
export async function POST() {
  return NextResponse.json(
    { error: 'Use /api/protected/upload/presign and /api/protected/upload/confirm' },
    { status: 410 },
  )
}
