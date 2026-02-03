import { NextRequest, NextResponse } from 'next/server'
import { r2, R2_BUCKET } from '@/modules/shared/r2'
import { ListObjectsV2Command } from '@aws-sdk/client-s3'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const prefix = searchParams.get('prefix') || ''

  try {
    const command = new ListObjectsV2Command({
      Bucket: R2_BUCKET,
      Prefix: prefix,
      Delimiter: '/',
    })

    const response = await r2.send(command)

    const folders = response.CommonPrefixes?.map((cp) => cp.Prefix) || []
    const files =
      response.Contents?.filter((obj) => obj.Key !== prefix).map((obj) => ({
        key: obj.Key,
        size: obj.Size,
        lastModified: obj.LastModified,
      })) || []

    return NextResponse.json({ folders, files })
  } catch (error: any) {
    console.error('Failed to list R2 objects', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
