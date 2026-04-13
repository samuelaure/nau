import { NextResponse } from 'next/server'

/**
 * Health check endpoint for the naŭ Platform.
 * No authentication required.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'flownau',
    version: '1.0.0',
    timestamp: Date.now(),
  })
}
