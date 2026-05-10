import { prisma } from '../../modules/shared/prisma';
import { logger } from '../../utils/logger';
import { scrapePostByUrl } from '../../services/apify.service';
import {
  generateCommentSuggestions,
  CommentSuggestionParams,
} from '../../services/intelligence.service';

export const generateReactiveComments = async (
  targetUrl: string,
  brandId: string,
): Promise<string[]> => {
  logger.info(
    `[ReactiveService] Starting reactive generation for ${targetUrl} (Brand: ${brandId})`,
  );

  // 1. Fetch Brand Intelligence
  const intelligence = await prisma.brand.findUnique({
    where: { id: brandId },
  });
  if (!intelligence) throw new Error('Brand intelligence not found');

  // 2. Resolve Post
  let post = await prisma.post.findUnique({
    where: { url: targetUrl },
    include: { transcripts: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });

  if (!post) {
    logger.info(`[ReactiveService] Post not in DB. Scraping...`);
    const scraped = await scrapePostByUrl(targetUrl);
    if (!scraped) throw new Error('Failed to scrape post');

    post = await prisma.post.upsert({
      where: { url: targetUrl },
      update: {},
      create: {
        platformId: scraped.id || scraped.shortcode,
        url: targetUrl,
        username: scraped.author.username,
        caption: scraped.caption,
        postedAt: new Date(scraped.takenAt),
        likes: Math.max(0, scraped.likesCount ?? 0),
        comments: Math.max(0, scraped.commentsCount ?? 0),
      },
      include: { transcripts: { take: 1 } },
    });
  }

  // 3. Fetch Last Selected Comments
  const lastFeedbacks = await prisma.commentFeedback.findMany({
    where: { brandId, isSelected: true },
    orderBy: { sentAt: 'desc' },
    take: 5,
  });

  // 4. Generate
  const params: CommentSuggestionParams = {
    post: {
      caption: post.caption || '',
      transcriptText: post.transcripts[0]?.text || '',
      url: post.url,
      targetUsername: post.username || 'unknown',
    },
    brand: {
      commentPrompt: intelligence.commentPrompt,
      suggestionsCount: intelligence.suggestionsCount,
    },
    lastSelectedComments: lastFeedbacks.map((f) => f.commentText),
  };

  const comments = await generateCommentSuggestions(params);

  // 6. Log optimistic suggestions for dedup context
  await prisma.commentFeedback.create({
    data: {
      brandId,
      postId: post.id,
      commentText: JSON.stringify(comments),
      isSelected: false,
    },
  });

  return comments;
};
