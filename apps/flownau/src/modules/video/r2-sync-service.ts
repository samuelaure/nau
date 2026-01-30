import { ListObjectsV2Command, ListObjectsV2CommandOutput } from '@aws-sdk/client-s3'
import { prisma } from '@/modules/shared/prisma'
import { r2, R2_BUCKET, R2_PUBLIC_URL } from '@/modules/shared/r2'
import path from 'path'

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
    if (!R2_BUCKET) {
        throw new Error('R2_BUCKET is not configured')
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
            }
        }

        log('Listing R2 objects...')
        const allR2Keys = new Set<string>()
        let continuationToken: string | undefined = undefined

        do {
            const listCmd = new ListObjectsV2Command({
                Bucket: R2_BUCKET,
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
    const parts = key.split('/')

    if (parts.length < 2) {
        return
    }

    const folderName = parts[0]
    const filename = parts[parts.length - 1]

    if (filename === '.DS_Store' || filename === '') return

    const accountId = accountMap.get(folderName)

    const mimeType = getMimeType(key)
    const type = getAssetTypeFixed(key)
    const url = `${R2_PUBLIC_URL}/${key}`

    const existing = await prisma.asset.findFirst({
        where: { r2Key: key }
    })

    if (existing) {
        if (existing.size !== size || existing.url !== url || existing.type !== type) {
            await prisma.asset.update({
                where: { id: existing.id },
                data: { size, url, mimeType, type }
            })
        }
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
    const allAssets = await prisma.asset.findMany({
        select: { id: true, r2Key: true }
    })

    let removed = 0
    for (const asset of allAssets) {
        if (!validKeys.has(asset.r2Key)) {
            await prisma.asset.delete({ where: { id: asset.id } })
            removed++
        }
    }
    if (removed > 0) log(`Removed ${removed} orphans from DB.`)
}
