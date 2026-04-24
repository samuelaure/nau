export const dynamic = 'force-dynamic'

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/modules/shared/prisma'
import { NextResponse } from 'next/server'
import { OpenAI } from 'openai'
import { getSetting } from '@/modules/shared/settings'
import { decrypt } from '@/modules/shared/encryption'

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Not authorized' }, { status: 401 })

  const { id } = await props.params
  const { schemaJson } = await req.json()

  try {
    const template = await prisma.template.findUnique({ where: { id } })
    if (!template) throw new Error('Template not found')

    const keyStr = await getSetting('openai_api_key')
    const apiKey = keyStr ? decrypt(keyStr) : process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('Missing OpenAI Key for Compilation')

    const openai = new OpenAI({ apiKey })
    const compilationRes = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are an automated schema compiler for a video generation system. Your job is to analyze the following JSON structure representing a video template, identify all text layers (e.g. tracks.text) and media layers (e.g. tracks.media). You must output a concise set of markdown rules that dictate EXACTLY what data properties the ideation agent must provide to fill this video. Be explicit about character counts assuming 20 chars per second based on durationInFrames (usually 30fps). DO NOT include greetings or extraneous text, just the strict rules.',
        },
        { role: 'user', content: `JSON: ${JSON.stringify(schemaJson)}` },
      ],
    })

    const generatedSystemPrompt = compilationRes.choices[0].message.content || 'No prompt generated'

    const updated = await (prisma.template as any).update({
      where: { id },
      data: { schemaJson, systemPrompt: generatedSystemPrompt },
    })

    return NextResponse.json({ success: true, template: updated })
  } catch (error: any) {
    console.error('Builder save error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
