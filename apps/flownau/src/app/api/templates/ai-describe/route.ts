import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { generateTemplateDescription } from '@/modules/video/builderAgent'

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { schemaJson } = body

    if (!schemaJson) {
      return NextResponse.json({ error: 'Missing schemaJson' }, { status: 400 })
    }

    const description = await generateTemplateDescription(schemaJson)
    return NextResponse.json({ description })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Description generation failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
