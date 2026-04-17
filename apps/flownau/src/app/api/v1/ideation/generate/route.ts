import { NextRequest, NextResponse } from 'next/server'
import { generateContentIdeas } from '@/modules/ideation/ideation.service'

export async function POST(request: NextRequest) {
  // Auth guard
  const authHeader = request.headers.get('authorization')
  const expectedKey = process.env.NAU_SERVICE_KEY
  if (!expectedKey || !authHeader || authHeader !== `Bearer ${expectedKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { brandName, dna, brandDNA, inspoItems, recentContent, recentPosts } = body

    const resolvedDna = dna || brandDNA
    if (!brandName || !resolvedDna) {
      return NextResponse.json(
        { error: 'Missing required fields: brandName, dna' },
        { status: 400 },
      )
    }

    const result = await generateContentIdeas({
      brandName,
      dna: resolvedDna,
      count: body.count ?? 5,
      inspoItems: inspoItems || [],
      recentContent: recentContent || recentPosts || [],
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[Ideation] Error generating ideas:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
