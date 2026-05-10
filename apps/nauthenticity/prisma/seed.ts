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
      commentPrompt: 'We are Alpha Brand — bold, modern, and direct. Engage with curiosity. Ask short questions. Always be warm but never sycophantic.',
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
      commentPrompt: 'We are Beta Brand — calm, thoughtful, and educational. Add value. Share a related insight. Be curious and encouraging.',
      suggestionsCount: 3,
      windowStart: '09:00',
      windowEnd: '21:00',
      timezone: 'America/New_York',
    },
  })

  // ── Social Profiles ───────────────────────────────────────────────────────
  // Own profiles (ownerId set — OWN category lives here, 1:1)
  const ownAlpha = await prisma.socialProfile.upsert({
    where: { platform_username: { platform: 'instagram', username: 'alpha_brand' } },
    update: { ownerId: brandAlpha.id },
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
    update: { ownerId: brandBeta.id },
    create: {
      platform: 'instagram',
      username: 'beta_brand',
      profileImageUrl: 'https://picsum.photos/seed/beta/150',
      totalPostCount: 142,
      ownerId: brandBeta.id,
    },
  })
  void ownAlpha
  void ownBeta

  // Profiles used in COMMENT / INSPO / BENCHMARK memberships
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

  // ── CategoryMemberships ───────────────────────────────────────────────────
  // Profile-level memberships
  const profileMemberships: Array<{
    brandId: string
    socialProfileId: string
    category: 'COMMENT' | 'INSPO' | 'BENCHMARK'
  }> = [
    { brandId: brandAlpha.id, socialProfileId: commentProfile1.id, category: 'COMMENT' },
    { brandId: brandAlpha.id, socialProfileId: commentProfile2.id, category: 'COMMENT' },
    { brandId: brandAlpha.id, socialProfileId: inspoProfile1.id, category: 'INSPO' },
    { brandId: brandAlpha.id, socialProfileId: benchProfile1.id, category: 'BENCHMARK' },
    // Beta also monitors niche_leader (cross-brand shared profile)
    { brandId: brandBeta.id, socialProfileId: commentProfile2.id, category: 'COMMENT' },
    // Beta also tracks industry_giant (cross-brand shared)
    { brandId: brandBeta.id, socialProfileId: benchProfile1.id, category: 'BENCHMARK' },
  ]

  for (const m of profileMemberships) {
    const existing = await prisma.categoryMembership.findFirst({
      where: { brandId: m.brandId, category: m.category, socialProfileId: m.socialProfileId, postId: null },
      select: { id: true },
    })
    if (existing) {
      await prisma.categoryMembership.update({ where: { id: existing.id }, data: { isActive: true } })
    } else {
      await prisma.categoryMembership.create({ data: { ...m, isActive: true } })
    }
  }

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
  void post3

  // Post-level memberships (InspoBase post-level)
  const postMemberships: Array<{ brandId: string; postId: string; category: 'INSPO' }> = [
    { brandId: brandAlpha.id, postId: post1.id, category: 'INSPO' },
    { brandId: brandAlpha.id, postId: post2.id, category: 'INSPO' },
    // post2 is shared between Alpha and Beta — no duplication, two CategoryMembership rows.
    { brandId: brandBeta.id, postId: post2.id, category: 'INSPO' },
  ]

  for (const m of postMemberships) {
    const existing = await prisma.categoryMembership.findFirst({
      where: { brandId: m.brandId, category: m.category, postId: m.postId, socialProfileId: null },
      select: { id: true },
    })
    if (existing) {
      await prisma.categoryMembership.update({ where: { id: existing.id }, data: { isActive: true } })
    } else {
      await prisma.categoryMembership.create({ data: { ...m, isActive: true } })
    }
  }

  console.log('Seed complete.')
  console.log(`  Brands: ${brandAlpha.id}, ${brandBeta.id}`)
  console.log(`  OWN profiles:        alpha_brand → Alpha; beta_brand → Beta`)
  console.log(`  COMMENT memberships: competitor_x, niche_leader (Alpha); niche_leader (Beta)`)
  console.log(`  INSPO memberships:   inspo_creator_a profile (Alpha); post1, post2 (Alpha); post2 (Beta — shared)`)
  console.log(`  BENCHMARK memberships: industry_giant (Alpha + Beta — shared)`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
