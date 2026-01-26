import { S3Client, ListObjectsV2Command, ListObjectsV2CommandOutput } from '@aws-sdk/client-s3'
import { prisma } from '@/lib/prisma'
import path from 'path'

// Environment variables
const BUCKET_NAME = process.env.R2_BUCKET_NAME
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL
const R2_ENDPOINT = process.env.R2_ENDPOINT
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY

if (!BUCKET_NAME || !R2_PUBLIC_URL || !R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    console.error('Missing R2 environment variables')
}

// Clients
const r2 = new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID || '',
        secretAccessKey: R2_SECRET_ACCESS_KEY || '',
    },
})

// Helpers
function getMimeType(key: string): string {
    const ext = path.extname(key).toLowerCase()
    switch (ext) {
        case '.mp4': return 'video/mp4'
        case '.mov': return 'video/quicktime'
        case '.mp3': return 'audio/mpeg'
        case '.wav': return 'audio/wav'
        case '.jpg':
        case '.jpeg': return 'image/jpeg'
        case '.png': return 'image/png'
        default: return 'application/octet-stream' // generic
    }
}

function getAssetType(key: string): string {
    const mime = getMimeType(key)
    if (mime.startsWith('video/')) return 'VIDEO' // DB enum might use 'VID' or 'VIDEO', checking script it assumes... script used 'VIDEO', 'AUDIO' but let's check DB schema or assumed values. 
    // Wait, the AssetsManager.tsx used 'VID', 'AUD', 'IMG'. The script used 'VIDEO', 'AUDIO', 'IMAGE'.
    // I must double check the Prisma Schema or what is currently in DB.
    // The script `sync-r2-to-db.ts` uses VIDEO, AUDIO, IMAGE.
    // `AssetsManager.tsx` uses: asset.type === 'VID', 'AUD', 'IMG'.
    // This is a DISCREPANCY.
    // Let me check `AssetsManager.tsx` again.
    // Yes: `asset.type === 'VID'`
    // Let me check `prisma/schema.prisma` if possible or infer.
    // The script `sync-r2-to-db.ts` seemed to think it was VIDEO/AUDIO.
    // If the script runs and puts VIDEO, but UI expects VID, UI won't show icons properly.
    // I should check `schema.prisma`.
    return getMimeType(key).startsWith('video/') ? 'VID' : getMimeType(key).startsWith('audio/') ? 'AUD' : 'IMG'
}

function getAssetTypeFixed(key: string): string {
    const mime = getMimeType(key)
    if (mime.startsWith('video/')) return 'VID'
    if (mime.startsWith('audio/')) return 'AUD'
    if (mime.startsWith('image/')) return 'IMG'
    return 'UNK'
}


function normalizeUsername(username: string | null): string {
    if (!username) return ''
    return username.replace(/^@/, '')
}

export async function syncR2Assets() {
    if (!BUCKET_NAME) {
        throw new Error('R2_BUCKET_NAME is not configured')
    }

    const logs: string[] = []
    const log = (msg: string) => logs.push(msg)

    try {
        log('Fetching accounts...')
        const accounts = await prisma.socialAccount.findMany()
        const accountMap = new Map<string, string>() // NormalizedName -> ID

        for (const acc of accounts) {
            if (acc.username) {
                const norm = normalizeUsername(acc.username)
                accountMap.set(norm, acc.id)
                // Also map lowercase for case-insensitive matching if needed? 
                // The script didn't, but folders in R2 might be funny. 
                // Let's stick to script logic.
            }
        }

        log('Listing R2 objects...')
        const allR2Keys = new Set<string>()
        let continuationToken: string | undefined = undefined

        do {
            const listCmd = new ListObjectsV2Command({
                Bucket: BUCKET_NAME,
                ContinuationToken: continuationToken,
            })
            const res: ListObjectsV2CommandOutput = await r2.send(listCmd)
            continuationToken = res.NextContinuationToken

            if (!res.Contents) continue

            for (const obj of res.Contents) {
                if (!obj.Key) continue
                allR2Keys.add(obj.Key)
                await syncObject(obj.Key, obj.Size || 0, accountMap, log)
            }
        } while (continuationToken)

        log(`R2 Listing complete. Found ${allR2Keys.size} objects.`)
        await cleanupOrphans(allR2Keys, log)

        return { success: true, logs }
    } catch (error: any) {
        console.error('Sync failed', error)
        return { success: false, error: error.message, logs }
    }
}

async function syncObject(key: string, size: number, accountMap: Map<string, string>, log: (m: string) => void) {
    // Structure expected: AccountName/Category/Filename ??? 
    // Script says: AccountName/Category/Filename OR AccountName/Filename 
    // Script logic: parts[0] is folderName.

    const parts = key.split('/')

    // We expect at least something... 
    // If it's at root, parts.length is 1. Script returned if < 2, so it ignores root files.
    if (parts.length < 2) {
        // log(`Skipping root file: ${key}`)
        return
    }

    const folderName = parts[0]
    const filename = parts[parts.length - 1]

    if (filename === '.DS_Store' || filename === '') return

    const accountId = accountMap.get(folderName)

    const mimeType = getMimeType(key)
    const type = getAssetTypeFixed(key) // Use the FIXED one matching UI
    const url = `${R2_PUBLIC_URL}/${key}`

    const existing = await prisma.asset.findFirst({
        where: { r2Key: key }
    })

    if (existing) {
        // Update basic stats if changed
        if (existing.size !== size || existing.url !== url || existing.type !== type) {
            // log(`Updating: ${key}`)
            await prisma.asset.update({
                where: { id: existing.id },
                data: { size, url, mimeType, type }
            })
        }
        // Link to account if missing
        if (!existing.accountId && accountId) {
            log(`Linking orphan asset ${key} to account ${folderName}`)
            await prisma.asset.update({
                where: { id: existing.id },
                data: { accountId }
            })
        }
    } else {
        log(`Creating new asset: ${key}`)
        await prisma.asset.create({
            data: {
                r2Key: key,
                url,
                size,
                mimeType,
                type,
                systemFilename: filename,
                originalFilename: filename,
                accountId: accountId,
            }
        })
    }
}

async function cleanupOrphans(validKeys: Set<string>, log: (m: string) => void) {
    // Check for orphans in DB
    const allAssets = await prisma.asset.findMany({
        select: { id: true, r2Key: true }
    })

    let removed = 0
    for (const asset of allAssets) {
        if (!validKeys.has(asset.r2Key)) {
            // log(`Removing orphan: ${asset.r2Key}`)
            await prisma.asset.delete({ where: { id: asset.id } })
            removed++
        }
    }
    if (removed > 0) log(`Removed ${removed} orphans from DB.`)
}
