import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { iterateTemplateWithAgent } from '@/modules/video/builderAgent'

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { schemaJson, prompt } = body

    if (!schemaJson || !prompt) {
      return NextResponse.json({ error: 'Missing schemaJson or prompt' }, { status: 400 })
    }

    const modifiedJson = await iterateTemplateWithAgent(schemaJson, prompt)
    return NextResponse.json({ schemaJson: modifiedJson })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Iteration failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
