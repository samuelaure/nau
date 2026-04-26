export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const principles = await prisma.contentCreationPrinciples.findUnique({ where: { id } })
    if (!principles) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ principles }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    if (body.isDefault && body.brandId) {
      await prisma.contentCreationPrinciples.updateMany({
        where: { brandId: body.brandId, id: { not: id } },
        data: { isDefault: false },
      })
    }

    const principles = await prisma.contentCreationPrinciples.update({
      where: { id },
      data: {
        name: body.name,
        systemPrompt: body.systemPrompt,
        isDefault: body.isDefault,
      },
    })

    return NextResponse.json({ principles }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.contentCreationPrinciples.delete({ where: { id } })
    return NextResponse.json({ success: true }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
