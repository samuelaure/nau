import { PutObjectCommand } from '@aws-sdk/client-s3'
import { r2, R2_BUCKET, R2_PUBLIC_URL } from '@/modules/shared/r2'
import axios from 'axios'

export async function downloadAndUploadProfileImage(
  imageUrl: string,
  username: string,
): Promise<string | null> {
  try {
    if (!R2_BUCKET) {
      console.error('[ProfileImageService] R2_BUCKET is not configured')
      return null
    }

    // Fetch image as buffer
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' })
    const buffer = Buffer.from(response.data)
    const contentType = response.headers['content-type'] || 'image/jpeg'

    // Determine extension
    let ext = '.jpg'
    if (contentType.includes('png')) ext = '.png'
    if (contentType.includes('webp')) ext = '.webp'

    // Construct R2 key: profiles/{username}_avatar{ext}
    // We use a timestamp or a hash to avoid caching issues if the profile pic changes
    const timestamp = Date.now()
    const key = `profiles/${username.toLowerCase()}_avatar_${timestamp}${ext}`

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ACL: 'public-read', // Ensure it's public if needed, or rely on bucket policy
    })

    await r2.send(command)

    // Return the public URL
    const publicUrl = R2_PUBLIC_URL?.endsWith('/') ? R2_PUBLIC_URL.slice(0, -1) : R2_PUBLIC_URL
    return `${publicUrl}/${key}`
  } catch (error) {
    console.error('[ProfileImageService] Failed to process profile image:', error)
    return null
  }
}
