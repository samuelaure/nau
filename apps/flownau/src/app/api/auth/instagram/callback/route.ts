import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/encryption'
import axios from 'axios'
import { getLongLivedToken } from '@/lib/instagram'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error || !code) {
      console.error('Instagram Auth Error Callback:', error)
      return NextResponse.redirect(new URL('/dashboard/accounts?error=auth_failed', req.url))
    }

    const appId = process.env.FB_APP_ID
    const appSecret = process.env.FB_APP_SECRET
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const redirectUri = `${baseUrl}/api/auth/instagram/callback`

    // 1. Exchange code for short-lived token
    const tokenResponse = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
      params: {
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
      },
    })

    const shortLivedToken = tokenResponse.data.access_token

    // 2. Exchange for long-lived token
    const longLivedToken = await getLongLivedToken(shortLivedToken)

    // 3. Get Pages and connected Instagram accounts
    // We need to find the page that has an instagram_business_account connected
    const pagesResponse = await axios.get('https://graph.facebook.com/v19.0/me/accounts', {
      params: {
        access_token: longLivedToken,
        fields: 'id,name,instagram_business_account{id,username,profile_picture_url}',
      },
    })

    const pages = pagesResponse.data.data || []
    const connectedPage = pages.find((p: any) => p.instagram_business_account)

    if (!connectedPage) {
      return NextResponse.redirect(
        new URL('/dashboard/accounts?error=no_instagram_account', req.url),
      )
    }

    const igAccount = connectedPage.instagram_business_account

    // 4. Save to Database
    // We use upsert to update if it exists or create if new
    await prisma.socialAccount.upsert({
      where: {
        platform_platformId: {
          platform: 'instagram',
          platformId: igAccount.id,
        },
      },
      update: {
        userId: session.user.id, // Transfer ownership if someone else had it, or update current
        accessToken: encrypt(longLivedToken),
        username: igAccount.username,
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // ~60 days
      },
      create: {
        userId: session.user.id,
        platform: 'instagram',
        platformId: igAccount.id,
        username: igAccount.username,
        accessToken: encrypt(longLivedToken),
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      },
    })

    return NextResponse.redirect(new URL('/dashboard/accounts?success=true', req.url))
  } catch (err: any) {
    console.error('Instagram Auth Error:', err?.response?.data || err.message)
    return NextResponse.redirect(new URL('/dashboard/accounts?error=server_error', req.url))
  }
}
