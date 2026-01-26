import { S3Client } from '@aws-sdk/client-s3'

if (!process.env.R2_ENDPOINT) {
  throw new Error('R2_ENDPOINT is not defined')
}

export const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
})

export const R2_BUCKET = process.env.R2_BUCKET_NAME
export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL
