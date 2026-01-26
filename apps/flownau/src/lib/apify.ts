import { getSetting } from './settings'

export interface ReferenceProfile {
  status: 'success' | 'error'
  username?: string
  profileImage?: string
  id?: string
}

const APIFY_PROFILE_ACTOR = 'coderx~instagram-profile-scraper-bio-posts'

export class ApifyService {
  static async fetchProfile(username: string): Promise<ReferenceProfile> {
    try {
      const token = await getSetting('apify_api_token')
      if (!token) {
        console.warn('[Apify] No token configured')
        return { status: 'error' }
      }

      // Clean username (remove @)
      const cleanUsername = username.replace('@', '').trim()

      const url = `https://api.apify.com/v2/acts/${APIFY_PROFILE_ACTOR}/run-sync-get-dataset-items?token=${token}`

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames: [cleanUsername] }),
      })

      if (!response.ok) {
        throw new Error(`Apify returned ${response.status}`)
      }

      const items = await response.json()
      if (!Array.isArray(items) || items.length === 0) {
        return { status: 'error' }
      }

      const info = items[0]
      // Prioritize HD profile pic
      const profileImage = info.hdProfilePicUrl || info.profilePicUrl

      return {
        status: 'success',
        id: info.id,
        username: info.username,
        profileImage,
      }
    } catch (error) {
      console.error('[Apify] Error fetching profile:', error)
      return { status: 'error' }
    }
  }
}
