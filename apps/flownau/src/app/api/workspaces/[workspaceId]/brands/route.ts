import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId } = params;

    // Verify workspace access
    const workspace = await db.workspace.findFirst({
      where: {
        id: workspaceId,
        members: { some: { userId: session.user.id } },
      },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Get all brands in this workspace
    const brands = await db.brand.findMany({
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
