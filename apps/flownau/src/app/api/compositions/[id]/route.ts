export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/modules/shared/prisma'
import { getAuthUser } from '@/lib/auth'
import { storage } from '@/modules/shared/r2'
import { flownau } from 'nau-storage'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()

    const updateData: {
      status?: string
      scheduledAt?: Date | null
      caption?: string
      hashtags?: string[]
      payload?: any
      creative?: any
    } = {}
    if (body.status !== undefined) updateData.status = body.status
    if (body.scheduledAt !== undefined)
      updateData.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null
    if (body.caption !== undefined) updateData.caption = body.caption
    if (body.hashtags !== undefined) updateData.hashtags = body.hashtags
    if (body.payload !== undefined) updateData.payload = body.payload
    if (body.creative !== undefined) updateData.creative = body.creative

    const composition = await prisma.post.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ composition }, { status: 200 })
  } catch (error) {
    console.error('[UPDATE_COMPOSITION_ERROR]', error)
    return NextResponse.json({ error: 'Failed to update composition' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const post = await prisma.post.findUnique({ where: { id } })
    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.postSlot.updateMany({ where: { postId: id }, data: { status: 'empty', postId: null } })
    await prisma.post.delete({ where: { id } })

    const r2Keys = new Set([
      flownau.renderOutput(post.brandId, id),
      flownau.renderCover(post.brandId, id),
      flownau.renderStill(post.brandId, id),
    ])
    for (const url of [post.userUploadedMediaUrl, post.videoUrl, post.coverUrl]) {
      if (!url) continue
      const key = storage.keyFromCdnUrl(url)
      if (key) r2Keys.add(key)
    }
    storage.deleteMany([...r2Keys]).catch((err) => console.error('[DELETE_COMPOSITION_R2]', err))

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('[DELETE_COMPOSITION_ERROR]', error)
    return NextResponse.json({ error: 'Failed to delete composition' }, { status: 500 })
  }
}
