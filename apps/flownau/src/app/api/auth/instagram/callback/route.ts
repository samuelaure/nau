export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/modules/shared/prisma'
import { encrypt } from '@/modules/shared/encryption'
import axios from 'axios'
import { getLongLivedToken } from '@/modules/publisher/instagram-token'

interface FacebookPage {
  id: string
  name: string
  instagram_business_account?: {
    id: string
    username: string
    profile_picture_url: string
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error || !code) {
      console.error('Instagram Auth Error Callback:', error)
      return NextResponse.redirect(new URL('/dashboard?error=auth_failed', req.url))
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

    const pages = (pagesResponse.data.data as FacebookPage[]) || []
    const connectedPage = pages.find((p) => p.instagram_business_account)

    if (!connectedPage) {
      return NextResponse.redirect(new URL('/dashboard?error=no_instagram_account', req.url))
    }

    const igAccount = connectedPage.instagram_business_account

    if (!igAccount) {
      return NextResponse.redirect(new URL('/dashboard?error=no_instagram_account', req.url))
    }

    // 4. Resolve workspaceId from the active session context.
    // Workspace ownership now lives in 9naŭ. The workspaceId is forwarded
    // via JWT claims once the cross-service SSO propagation is complete.
    // Until then, read from the env fallback set during account onboarding.
    const workspaceId =
      ((user as unknown) as Record<string, unknown>).activeWorkspaceId as string ||
      process.env.FLOWNAU_DEFAULT_WORKSPACE_ID

    if (!workspaceId) {
      console.error('No activeWorkspaceId on session for user:', user!.id)
      return NextResponse.redirect(new URL('/dashboard?error=no_workspace', req.url))
    }
    await prisma.socialAccount.upsert({
      where: {
        platform_platformId: {
          platform: 'instagram',
          platformId: igAccount.id,
        },
      },
      update: {
        workspaceId, // Transfer to current user's workspace
        accessToken: encrypt(longLivedToken),
        username: igAccount.username,
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        tokenRefreshedAt: new Date(),
      },
      create: {
        workspaceId,
        platform: 'instagram',
        platformId: igAccount.id,
        username: igAccount.username,
        accessToken: encrypt(longLivedToken),
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        tokenRefreshedAt: new Date(),
      },
    })

    return NextResponse.redirect(new URL('/dashboard?success=true', req.url))
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      console.error('Instagram Auth Error:', err.response?.data || err.message)
    } else {
      console.error('Instagram Auth Error:', (err as Error).message)
    }
    return NextResponse.redirect(new URL('/dashboard?error=server_error', req.url))
  }
}
