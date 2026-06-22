import { PrismaClient } from '../src/generated/prisma/index.js';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { storage } from '../src/modules/shared/r2';
import { flownau } from 'nau-storage';
import { createId } from '@paralleldrive/cuid2';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function migrateAssets() {
  const mami = await prisma.brand.findFirst({ where: { name: 'Mami Abundancia' } });
  const andi = await prisma.brand.findFirst({ where: { name: 'Andi Universo' } });

  if (!mami || !andi) {
    console.error("Could not find both brands. Mami:", !!mami, "Andi:", !!andi);
    return;
  }

  console.log(`Source: ${mami.name} (${mami.id})`);
  console.log(`Target: ${andi.name} (${andi.id})`);

  // Find all assets in Mami Abundancia (including VID, IMG, AUD, but the user asked for videos. Let's do VID)
  const assets = await prisma.asset.findMany({
    where: { brandId: mami.id, type: 'VID' }
  });

  console.log(`Found ${assets.length} video assets in Mami Abundancia`);

  let count = 0;
  for (const asset of assets) {
    if (!asset.hash) {
      console.log(`Skipping asset ${asset.systemFilename} (no hash)`);
      continue;
    }

    const existing = await prisma.asset.findFirst({
      where: { brandId: andi.id, hash: asset.hash }
    });

    if (existing) {
      console.log(`Asset ${asset.systemFilename} already exists in Andi Universo, skipping.`);
      continue;
    }

    console.log(`Copying asset ${asset.systemFilename} (${(asset.size / 1024 / 1024).toFixed(2)} MB)...`);

    // 1. Download buffer
    const res = await fetch(asset.url);
    if (!res.ok) {
      console.error(`Failed to download ${asset.url}`);
      continue;
    }
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 2. Generate new keys
    const assetId = createId();
    const ext = asset.systemFilename.split('.').pop() || 'mp4';
    const r2Key = flownau.accountAsset(andi.id, 'videos', assetId, ext);
    const systemFilename = `${assetId}.${ext}`;

    // 3. Upload to R2
    const url = await storage.upload(r2Key, buffer, { mimeType: asset.mimeType, size: buffer.length });

    // 4. Save to DB
    const newAsset = await prisma.asset.create({
      data: {
        id: assetId,
        brandId: andi.id,
        templateId: null,
        originalFilename: asset.originalFilename,
        systemFilename,
        r2Key,
        size: buffer.length,
        mimeType: asset.mimeType,
        hash: asset.hash,
        type: 'VID',
        url,
        thumbnailUrl: asset.thumbnailUrl, // Point to the original thumbnail URL, works for now
        duration: asset.duration,
        optimizationStatus: asset.optimizationStatus, // Preserve 'done' or 'pending'
      }
    });

    console.log(`-> Copied as ${systemFilename}`);
    count++;
  }

  console.log(`Migration complete! Successfully copied ${count} assets.`);
}

migrateAssets()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
