
import { S3Client, ListObjectsV2Command, CopyObjectCommand, DeleteObjectCommand, HeadObjectCommand, type ListObjectsV2CommandOutput } from '@aws-sdk/client-s3';
import type { PrismaClient } from '@prisma/client';
// @ts-ignore
import * as dotenv from 'dotenv';
import path from 'path';

// 1. Load environment variables FIRST
const envPath = path.resolve(process.cwd(), '.env');
console.log('Loading .env from:', envPath);
const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error('Error loading .env:', result.error);
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
    console.error('DATABASE_URL is missing. Exiting.');
    process.exit(1);
}

// 2. Initialize R2 Client
const r2 = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

if (!BUCKET_NAME || !R2_PUBLIC_URL) {
    console.error('Missing R2_BUCKET_NAME or R2_PUBLIC_URL');
    process.exit(1);
}

let prisma: PrismaClient;

async function main() {
    // 3. Dynamic import of Prisma Client (reusing app instance)
    // This ensures that process.env is fully populated before the module reads it.
    console.log('Importing Prisma client...');
    const prismaModule = await import('../../src/lib/prisma');
    prisma = prismaModule.prisma;

    console.log('Starting R2 cleanup...');

    let continuationToken: string | undefined = undefined;
    let processedCount = 0;

    try {
        do {
            const listCommand = new ListObjectsV2Command({
                Bucket: BUCKET_NAME,
                ContinuationToken: continuationToken,
            });

            const response = await r2.send(listCommand) as ListObjectsV2CommandOutput;
            continuationToken = response.NextContinuationToken;

            if (!response.Contents) continue;

            for (const object of response.Contents) {
                if (!object.Key) continue;

                if (object.Key.includes('@')) {
                    await processFile(object.Key);
                    processedCount++;
                }
            }

        } while (continuationToken);
    } catch (err) {
        console.error('Error listing objects:', err);
    }

    console.log(`Finished R2 cleanup. Processed ${processedCount} files.`);
}

async function processFile(oldKey: string) {
    const newKey = oldKey.replace(/@/g, '');

    console.log(`Processing: ${oldKey} -> ${newKey}`);

    if (oldKey === newKey) return;

    // Check collision
    try {
        await r2.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: newKey }));
        console.warn(`WARNING: Target key ${newKey} already exists. Skipping to avoid overwrite.`);
        return;
    } catch (e: any) {
        if (e.name !== 'NotFound' && e.$metadata?.httpStatusCode !== 404) {
            console.error(`Error checking existence of ${newKey}:`, e);
            return;
        }
    }

    try {
        // 1. Copy
        const source = `${BUCKET_NAME}/${oldKey}`;
        // Standard CopySource for S3/R2 usually works with raw strings if no weird chars, 
        // but encoding key is safest.

        await r2.send(new CopyObjectCommand({
            Bucket: BUCKET_NAME,
            CopySource: encodeURI(source), // minimal encoding
            Key: newKey,
            ACL: 'public-read',
        }));

        // 2. Delete Old
        await r2.send(new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: oldKey,
        }));

        // 3. Update DB
        if (prisma) {
            await updateDatabase(oldKey, newKey);
        } else {
            console.error('Prisma client not initialized, skipping DB update for', oldKey);
        }

        console.log(`Successfully renamed ${oldKey} to ${newKey}`);
    } catch (error) {
        console.error(`Failed to process ${oldKey}:`, error);
    }
}

async function updateDatabase(oldKey: string, newKey: string) {
    try {
        const assets = await prisma.asset.findMany({
            where: { r2Key: oldKey }
        });

        for (const asset of assets) {
            const newSystemFilename = asset.systemFilename.replace(/@/g, '');
            const newOriginalFilename = asset.originalFilename.replace(/@/g, '');
            const newUrl = `${R2_PUBLIC_URL}/${newKey}`;

            await prisma.asset.update({
                where: { id: asset.id },
                data: {
                    r2Key: newKey,
                    systemFilename: newSystemFilename,
                    originalFilename: newOriginalFilename,
                    url: newUrl
                }
            });
            console.log(`Updated Asset ${asset.id}`);
        }

        const renders = await prisma.render.findMany({
            where: {
                r2Url: {
                    contains: oldKey
                }
            }
        });

        for (const render of renders) {
            if (render.r2Url) {
                const newRenderUrl = render.r2Url.replace(oldKey, newKey);
                await prisma.render.update({
                    where: { id: render.id },
                    data: { r2Url: newRenderUrl }
                });
                console.log(`Updated Render ${render.id}`);
            }
        }
    } catch (e) {
        console.error('DB Update Error:', e);
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        if (prisma) await prisma.$disconnect();
    });
