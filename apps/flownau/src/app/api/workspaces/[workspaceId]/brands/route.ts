import { getAuthUser } from '@/lib/auth';
import { prisma } from '@/modules/shared/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId } = await params;

    if (user.workspaceId !== workspaceId) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const brands = await prisma.brand.findMany({
      where: { workspaceId },
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(brands);
  } catch (error) {
    console.error('[GET /workspaces/:id/brands]', error);
    return NextResponse.json({ error: 'Failed to fetch brands' }, { status: 500 });
  }
}
