import axios from 'axios'
import { decrypt } from './encryption'

const IG_API_VERSION = 'v19.0'
const IG_BASE_URL = `https://graph.facebook.com/${IG_API_VERSION}`

export async function publishVideoToInstagram({
  accessToken,
  instagramUserId,
  videoUrl,
  caption,
}: {
  accessToken: string
  instagramUserId: string
  videoUrl: string
  caption: string
}) {
  // Step 1: Initialize container
  const containerResponse = await axios.post(`${IG_BASE_URL}/${instagramUserId}/media`, {
    video_url: videoUrl,
    media_type: 'REELS',
    caption: caption,
    access_token: accessToken,
  })

  const containerId = containerResponse.data.id

  // Step 2: Poll for status
  let status = 'IN_PROGRESS'
  while (status === 'IN_PROGRESS') {
    await new Promise((resolve) => setTimeout(resolve, 5000))
    const statusResponse = await axios.get(`${IG_BASE_URL}/${containerId}`, {
      params: {
        fields: 'status_code',
        access_token: accessToken,
      },
    })
    status = statusResponse.data.status_code
    if (status === 'ERROR') {
      throw new Error('Instagram media container processing failed')
    }
  }

  // Step 3: Publish container
  const publishResponse = await axios.post(`${IG_BASE_URL}/${instagramUserId}/media_publish`, {
    creation_id: containerId,
    access_token: accessToken,
  })

  return publishResponse.data.id
}

export async function getLongLivedToken(shortLivedToken: string) {
  const response = await axios.get(`${IG_BASE_URL}/oauth/access_token`, {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: process.env.FB_APP_ID,
      client_secret: process.env.FB_APP_SECRET,
      fb_exchange_token: shortLivedToken,
    },
  })
  return response.data.access_token
}
