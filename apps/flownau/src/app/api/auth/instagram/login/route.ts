export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const appId = process.env.FB_APP_ID
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const redirectUri = `${baseUrl}/api/auth/instagram/callback`

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brandId')

  const scope = [
    'instagram_basic',
    'instagram_content_publish',
    'pages_show_list',
    'pages_read_engagement',
    'business_management',
  ].join(',')

  const state = JSON.stringify({ nonce: Math.random().toString(36).substring(7), brandId })
  const encodedState = Buffer.from(state).toString('base64url')

  const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&state=${encodedState}&response_type=code`

  return NextResponse.redirect(url)
}
