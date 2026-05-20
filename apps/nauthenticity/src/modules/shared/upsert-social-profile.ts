import { prisma } from './prisma';

/**
 * Upsert a SocialProfile using Instagram's stable numeric ID as the primary key.
 *
 * Lookup order:
 * 1. If externalId is provided → find by (platform, externalId). If found, update username
 *    (handles account renames). If not found, create with both fields.
 * 2. If externalId is not available → fall back to (platform, username) upsert, and store
 *    externalId once it becomes known.
 */
export async function upsertSocialProfile(opts: {
  platform: string;
  username: string;
  externalId?: string | null;
  extraUpdate?: Record<string, unknown>;
}) {
  const { platform, externalId, extraUpdate = {} } = opts;
  const username = opts.username.toLowerCase();

  if (externalId) {
    const byExternalId = await prisma.socialProfile.findFirst({
      where: { platform, externalId },
    });
    if (byExternalId) {
      return prisma.socialProfile.update({
        where: { id: byExternalId.id },
        data: { username, externalId, ...extraUpdate },
      });
    }
  }

  return prisma.socialProfile.upsert({
    where: { platform_username: { platform, username } },
    create: { platform, username, externalId: externalId ?? null, ...extraUpdate },
    update: { externalId: externalId ?? undefined, ...extraUpdate },
  });
}
