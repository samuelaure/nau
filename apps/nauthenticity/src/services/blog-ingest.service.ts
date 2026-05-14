import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'
import { logger } from '../utils/logger'

export interface BlogArticle {
  title: string | null
  author: string | null
  publishedAt: Date | null
  rawText: string
}

export async function scrapeAndParse(url: string): Promise<BlogArticle> {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`)
  }

  const html = await response.text()
  const dom = new JSDOM(html, { url })
  const article = new Readability(dom.window.document).parse()

  if (!article) {
    throw new Error(`Readability could not parse article at ${url} — likely a paywall or JS-only page`)
  }

  // Attempt to extract a published date from common meta tags
  let publishedAt: Date | null = null
  const metaDate =
    dom.window.document.querySelector('meta[property="article:published_time"]')?.getAttribute('content') ??
    dom.window.document.querySelector('meta[name="date"]')?.getAttribute('content') ??
    dom.window.document.querySelector('time[datetime]')?.getAttribute('datetime')

  if (metaDate) {
    const parsed = new Date(metaDate)
    if (!isNaN(parsed.getTime())) publishedAt = parsed
  }

  logger.debug({ url, title: article.title }, 'blog article parsed')

  return {
    title: article.title ?? null,
    author: article.byline ?? null,
    publishedAt,
    rawText: article.textContent ?? '',
  }
}
