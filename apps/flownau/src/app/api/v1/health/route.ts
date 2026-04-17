import { NextResponse } from 'next/server'
import pkg from '../../../../../package.json'

/**
 * Health check endpoint for the naŭ Platform.
 * No authentication required.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'flownau',
    version: pkg.version,
    timestamp: Date.now(),
  })
}

