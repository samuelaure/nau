import { NextResponse } from 'next/server'

export async function GET() {
  const appId = process.env.FB_APP_ID
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const redirectUri = `${baseUrl}/api/auth/instagram/callback`

  // Scopes required for:
  // - Reading Instagram account info (instagram_basic)
  // - Publishing content (instagram_content_publish)
  // - Finding the connected Page (pages_show_list, pages_read_engagement)
  // - Business discovery (business_management)
  const scope = [
    'instagram_basic',
    'instagram_content_publish',
    'pages_show_list',
    'pages_read_engagement',
    'business_management',
  ].join(',')

  const state = Math.random().toString(36).substring(7)

  const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}&response_type=code`

  return NextResponse.redirect(url)
}
