import { storage } from '@/modules/shared/r2'
import { flownau, extFromMime } from 'nau-storage'
import axios from 'axios'

export async function downloadAndUploadProfileImage(
  imageUrl: string,
  userId: string,
): Promise<string | null> {
  try {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' })
    const buffer = Buffer.from(response.data)
    const contentType: string = response.headers['content-type'] || 'image/jpeg'

    const ext = extFromMime(contentType) || 'jpg'
    const key = flownau.profileAvatar(userId, ext)

    return await storage.upload(key, buffer, { mimeType: contentType })
  } catch (error) {
    console.error('[ProfileImageService] Failed to process profile image:', error)
    return null
  }
}
