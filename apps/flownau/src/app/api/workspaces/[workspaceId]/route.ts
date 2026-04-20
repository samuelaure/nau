export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

// Workspace CRUD is now owned exclusively by 9naŭ (9nau-api).
// These endpoints are kept for backwards-compatibility but return 410 Gone.
export async function PUT() {
  return NextResponse.json(
    {
      error:
        'Workspace management has moved to the 9naŭ Platform. Use PUT /api/workspaces/:id on the 9naŭ API.',
    },
    { status: 410 },
  )
}

export async function DELETE() {
  return NextResponse.json(
    {
      error:
        'Workspace management has moved to the 9naŭ Platform. Use DELETE /api/workspaces/:id on the 9naŭ API.',
    },
    { status: 410 },
  )
}
