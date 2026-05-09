import { PrismaClient } from '../node_modules/.prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
  console.log('Seeding nauthenticity local DB...')

  // ── Brands ────────────────────────────────────────────────────────────────
  const brandAlpha = await prisma.brand.upsert({
    where: { id: 'seed-brand-alpha' },
    update: {},
    create: {
      id: 'seed-brand-alpha',
      workspaceId: 'seed-workspace-1',
      mainUsername: 'alpha_brand',
      voicePrompt: 'We are Alpha Brand — bold, modern, and direct. We talk to ambitious creators who want to grow fast.',
      commentStrategy: 'Engage with curiosity. Ask short questions. Always be warm but never sycophantic.',
      suggestionsCount: 3,
      windowStart: '08:00',
      windowEnd: '22:00',
      timezone: 'Europe/Madrid',
    },
  })

  const brandBeta = await prisma.brand.upsert({
    where: { id: 'seed-brand-beta' },
    update: {},
    create: {
      id: 'seed-brand-beta',
      workspaceId: 'seed-workspace-1',
      mainUsername: 'beta_brand',
      voicePrompt: 'We are Beta Brand — calm, thoughtful, and educational. We help people learn something useful every day.',
      commentStrategy: 'Add value. Share a related insight. Be curious and encouraging.',
      suggestionsCount: 3,
      windowStart: '09:00',
      windowEnd: '21:00',
      timezone: 'America/New_York',
    },
  })

  // ── Social Profiles ────────────────────────────────────────────────────────
  // Own profiles (ownerId set — brand publishes to these)
  const ownAlpha = await prisma.socialProfile.upsert({
    where: { platform_username: { platform: 'instagram', username: 'alpha_brand' } },
    update: {},
    create: {
      platform: 'instagram',
      username: 'alpha_brand',
      profileImageUrl: 'https://picsum.photos/seed/alpha/150',
      totalPostCount: 87,
      ownerId: brandAlpha.id,
    },
  })

  const ownBeta = await prisma.socialProfile.upsert({
    where: { platform_username: { platform: 'instagram', username: 'beta_brand' } },
    update: {},
    create: {
      platform: 'instagram',
      username: 'beta_brand',
      profileImageUrl: 'https://picsum.photos/seed/beta/150',
      totalPostCount: 142,
      ownerId: brandBeta.id,
    },
  })

  // Monitored profiles — comment generation targets
  const commentProfile1 = await prisma.socialProfile.upsert({
    where: { platform_username: { platform: 'instagram', username: 'competitor_x' } },
    update: {},
    create: {
      platform: 'instagram',
      username: 'competitor_x',
      profileImageUrl: 'https://picsum.photos/seed/compx/150',
      totalPostCount: 320,
    },
  })

  const commentProfile2 = await prisma.socialProfile.upsert({
    where: { platform_username: { platform: 'instagram', username: 'niche_leader' } },
    update: {},
    create: {
      platform: 'instagram',
      username: 'niche_leader',
      profileImageUrl: 'https://picsum.photos/seed/niche/150',
      totalPostCount: 510,
    },
  })

  // Inspiration profiles
  const inspoProfile1 = await prisma.socialProfile.upsert({
    where: { platform_username: { platform: 'instagram', username: 'inspo_creator_a' } },
    update: {},
    create: {
      platform: 'instagram',
      username: 'inspo_creator_a',
      profileImageUrl: 'https://picsum.photos/seed/inspoa/150',
      totalPostCount: 200,
    },
  })

  // Benchmark profiles
  const benchProfile1 = await prisma.socialProfile.upsert({
    where: { platform_username: { platform: 'instagram', username: 'industry_giant' } },
    update: {},
    create: {
      platform: 'instagram',
      username: 'industry_giant',
      profileImageUrl: 'https://picsum.photos/seed/giant/150',
      totalPostCount: 1200,
    },
  })

  // ── SocialProfileMonitors ──────────────────────────────────────────────────
  // Alpha brand: monitors competitor_x and niche_leader for comments
  await prisma.socialProfileMonitor.upsert({
    where: { brandId_socialProfileId: { brandId: brandAlpha.id, socialProfileId: commentProfile1.id } },
    update: {},
    create: { brandId: brandAlpha.id, socialProfileId: commentProfile1.id, monitoringType: 'content', isActive: true },
  })
  await prisma.socialProfileMonitor.upsert({
    where: { brandId_socialProfileId: { brandId: brandAlpha.id, socialProfileId: commentProfile2.id } },
    update: {},
    create: { brandId: brandAlpha.id, socialProfileId: commentProfile2.id, monitoringType: 'content', isActive: true },
  })

  // Alpha brand: inspo_creator_a for inspiration
  await prisma.socialProfileMonitor.upsert({
    where: { brandId_socialProfileId: { brandId: brandAlpha.id, socialProfileId: inspoProfile1.id } },
    update: {},
    create: { brandId: brandAlpha.id, socialProfileId: inspoProfile1.id, monitoringType: 'inspiration', isActive: true },
  })

  // Alpha brand: industry_giant for benchmark
  await prisma.socialProfileMonitor.upsert({
    where: { brandId_socialProfileId: { brandId: brandAlpha.id, socialProfileId: benchProfile1.id } },
    update: {},
    create: { brandId: brandAlpha.id, socialProfileId: benchProfile1.id, monitoringType: 'benchmark', isActive: true },
  })

  // Beta brand: also monitors niche_leader for comments (cross-brand shared profile)
  await prisma.socialProfileMonitor.upsert({
    where: { brandId_socialProfileId: { brandId: brandBeta.id, socialProfileId: commentProfile2.id } },
    update: {},
    create: { brandId: brandBeta.id, socialProfileId: commentProfile2.id, monitoringType: 'content', isActive: true },
  })

  // Beta brand: industry_giant for benchmark too (cross-brand shared profile)
  await prisma.socialProfileMonitor.upsert({
    where: { brandId_socialProfileId: { brandId: brandBeta.id, socialProfileId: benchProfile1.id } },
    update: {},
    create: { brandId: brandBeta.id, socialProfileId: benchProfile1.id, monitoringType: 'benchmark', isActive: true },
  })

  // ── Posts ──────────────────────────────────────────────────────────────────
  const post1 = await prisma.post.upsert({
    where: { url: 'https://www.instagram.com/p/seed_post_001/' },
    update: {},
    create: {
      url: 'https://www.instagram.com/p/seed_post_001/',
      platformId: 'seed_post_001',
      username: 'inspo_creator_a',
      socialProfileId: inspoProfile1.id,
      caption: 'How I went from 0 to 50k followers in 6 months using only organic content strategies.',
      postedAt: new Date('2025-12-01T10:00:00Z'),
      likes: 4200,
      comments: 310,
      views: 98000,
      engagementScore: 4.6,
    },
  })

  const post2 = await prisma.post.upsert({
    where: { url: 'https://www.instagram.com/p/seed_post_002/' },
    update: {},
    create: {
      url: 'https://www.instagram.com/p/seed_post_002/',
      platformId: 'seed_post_002',
      username: 'inspo_creator_a',
      socialProfileId: inspoProfile1.id,
      caption: 'The 3-post framework that doubled my engagement rate. Save this for later.',
      postedAt: new Date('2025-12-15T14:00:00Z'),
      likes: 6100,
      comments: 480,
      views: 120000,
      engagementScore: 5.5,
    },
  })

  const post3 = await prisma.post.upsert({
    where: { url: 'https://www.instagram.com/p/seed_post_003/' },
    update: {},
    create: {
      url: 'https://www.instagram.com/p/seed_post_003/',
      platformId: 'seed_post_003',
      username: 'competitor_x',
      socialProfileId: commentProfile1.id,
      caption: 'New product drop — first to comment gets 20% off.',
      postedAt: new Date('2026-01-10T09:00:00Z'),
      likes: 1800,
      comments: 920,
      views: 45000,
      engagementScore: 6.0,
    },
  })

  // ── InspoItems (InspoBase) ─────────────────────────────────────────────────
  // Alpha brand has saved post1 and post2 as inspiration
  await prisma.inspoItem.upsert({
    where: { id: 'seed-inspo-alpha-001' },
    update: {},
    create: {
      id: 'seed-inspo-alpha-001',
      brandId: brandAlpha.id,
      postId: post1.id,
      sourceUrl: post1.url,
      type: 'post',
      note: 'Great hook format — the "0 to X in Y months" angle works well for us too.',
      status: 'processed',
      extractedHook: 'From 0 to 50k in 6 months using only organic content',
      extractedTheme: 'organic growth strategy',
    },
  })

  await prisma.inspoItem.upsert({
    where: { id: 'seed-inspo-alpha-002' },
    update: {},
    create: {
      id: 'seed-inspo-alpha-002',
      brandId: brandAlpha.id,
      postId: post2.id,
      sourceUrl: post2.url,
      type: 'post',
      note: 'Save-bait format with a numbered framework. High retention on this style.',
      status: 'processed',
      extractedHook: 'The 3-post framework that doubled engagement',
      extractedTheme: 'content frameworks and engagement tactics',
    },
  })

  // Beta brand has saved post2 as inspo too (same post linked to two brands — no duplication)
  await prisma.inspoItem.upsert({
    where: { id: 'seed-inspo-beta-001' },
    update: {},
    create: {
      id: 'seed-inspo-beta-001',
      brandId: brandBeta.id,
      postId: post2.id,
      sourceUrl: post2.url,
      type: 'post',
      note: 'The numbered framework approach fits our educational voice perfectly.',
      status: 'processed',
      extractedHook: 'The 3-post framework that doubled engagement',
      extractedTheme: 'educational content frameworks',
    },
  })

  console.log('Seed complete.')
  console.log(`  Brands:   ${brandAlpha.id}, ${brandBeta.id}`)
  console.log(`  Own profiles:     alpha_brand (Alpha), beta_brand (Beta)`)
  console.log(`  Comment monitors: competitor_x, niche_leader (Alpha); niche_leader (Beta)`)
  console.log(`  Inspo monitors:   inspo_creator_a (Alpha)`)
  console.log(`  Benchmark monitors: industry_giant (Alpha + Beta — shared)`)
  console.log(`  Posts:     3 seeded`)
  console.log(`  InspoItems: 3 seeded (post2 shared across Alpha + Beta)`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
