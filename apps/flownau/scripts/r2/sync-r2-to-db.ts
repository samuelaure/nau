import {
  S3Client,
  ListObjectsV2Command,
  HeadObjectCommand,
  type ListObjectsV2CommandOutput,
} from '@aws-sdk/client-s3'
import type { PrismaClient } from '@prisma/client'
// @ts-ignore
import * as dotenv from 'dotenv'
import path from 'path'

// 1. Env Setup
const envPath = path.resolve(process.cwd(), '.env')
console.log('Loading .env from:', envPath)
dotenv.config({ path: envPath })

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) {
  console.error('DATABASE_URL is missing.')
  process.exit(1)
}

const BUCKET_NAME = process.env.R2_BUCKET_NAME
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL

if (!BUCKET_NAME || !R2_PUBLIC_URL) {
  console.error('Missing R2_BUCKET_NAME or R2_PUBLIC_URL')
  process.exit(1)
}

// 2. Clients
const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
})

let prisma: PrismaClient

// 3. Helpers
function getMimeType(key: string): string {
  const ext = path.extname(key).toLowerCase()
  switch (ext) {
    case '.mp4':
      return 'video/mp4'
    case '.mov':
      return 'video/quicktime'
    case '.mp3':
      return 'audio/mpeg'
    case '.wav':
      return 'audio/wav'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    default:
      return 'application/octet-stream'
  }
}

function getAssetType(key: string): string {
  const mime = getMimeType(key)
  if (mime.startsWith('video/')) return 'VIDEO'
  if (mime.startsWith('audio/')) return 'AUDIO'
  if (mime.startsWith('image/')) return 'IMAGE'
  return 'UNKNOWN'
}

function normalizeUsername(username: string | null): string {
  if (!username) return ''
  return username.replace(/^@/, '')
}

async function main() {
  console.log('Importing Prisma...')
  const prismaModule = await import('../../src/modules/shared/prisma')
  prisma = prismaModule.prisma

  console.log('Fetching accounts...')
  const accounts = await prisma.socialAccount.findMany()
  const accountMap = new Map<string, string>() // NormalizedName -> ID

  for (const acc of accounts) {
    if (acc.username) {
      const norm = normalizeUsername(acc.username)
      accountMap.set(norm, acc.id)
      console.log(`Mapped account: ${norm} -> ${acc.id}`)
    }
  }

  console.log('Listing R2 objects...')
  const allR2Keys = new Set<string>()
  let continuationToken: string | undefined = undefined

  try {
    do {
      const listCmd = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        ContinuationToken: continuationToken,
      })
      const res = (await r2.send(listCmd)) as ListObjectsV2CommandOutput
      continuationToken = res.NextContinuationToken

      if (!res.Contents) continue

      for (const obj of res.Contents) {
        if (!obj.Key) continue
        allR2Keys.add(obj.Key)

        await syncObject(obj.Key, obj.Size || 0, accountMap)
      }
    } while (continuationToken)
  } catch (e) {
    console.error('Error listing R2:', e)
    process.exit(1)
  }

  console.log(`R2 Listing complete. Found ${allR2Keys.size} objects.`)
  await cleanupOrphans(allR2Keys)
}

async function syncObject(key: string, size: number, accountMap: Map<string, string>) {
  // Structure expected: AccountName/Category/Filename
  // e.g. AstrologiaFamiliar/videos/vid.mp4

  const parts = key.split('/')
  if (parts.length < 2) {
    console.warn(`Skipping key with unknown structure: ${key}`)
    return
  }

  const folderName = parts[0]
  const filename = parts[parts.length - 1]

  if (filename === '.DS_Store' || filename === '') return

  const accountId = accountMap.get(folderName)

  const mimeType = getMimeType(key)
  const type = getAssetType(key)
  const url = `${R2_PUBLIC_URL}/${key}`

  // Assumption: systemFilename and originalFilename are initially same if we don't have metadata
  // Or we parse systemFilename if it follows pattern?
  // Existing DB seems to have systemFilename. We'll use filename for both if new.

  // Check if exists
  const existing = await prisma.asset.findFirst({
    where: { r2Key: key },
  })

  if (existing) {
    // Update basic stats if changed
    if (existing.size !== size || existing.url !== url) {
      console.log(`Updating existing asset: ${key}`)
      await prisma.asset.update({
        where: { id: existing.id },
        data: { size, url, mimeType, type },
      })
    }
    // If accountId matches what we found, great. If currently null, maybe link it?
    if (!existing.accountId && accountId) {
      console.log(`Linking orphan asset ${key} to account ${folderName}`)
      await prisma.asset.update({
        where: { id: existing.id },
        data: { accountId },
      })
    }
  } else {
    console.log(`Creating new asset: ${key}`)
    await prisma.asset.create({
      data: {
        r2Key: key,
        url,
        size,
        mimeType,
        type,
        systemFilename: filename,
        originalFilename: filename,
        accountId: accountId, // Might be undefined, that's allowed by schema? (accountId String?) yes
      },
    })
  }
}

async function cleanupOrphans(validKeys: Set<string>) {
  console.log('Checking for orphans in DB...')
  // We fetch all assets (or iterate in batches if huge, but 100s is fine)
  const allAssets = await prisma.asset.findMany({
    select: { id: true, r2Key: true },
  })

  let removed = 0
  for (const asset of allAssets) {
    if (!validKeys.has(asset.r2Key)) {
      console.log(`Removing orphan asset from DB: ${asset.r2Key}`)
      await prisma.asset.delete({ where: { id: asset.id } })
      removed++
    }
  }
  console.log(`Cleanup complete. Removed ${removed} orphans.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => {
    if (prisma) prisma.$disconnect()
  })
