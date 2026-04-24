import type { LLMUsage } from './types'

export interface UsageReportOptions {
  /** URL of the api service: e.g. http://api:3000 */
  apiUrl: string
  /** Service-to-service JWT token (pre-signed by caller) */
  serviceToken: string
  workspaceId: string
  brandId?: string
  userId?: string
  service: string
  operation: string
  usage: LLMUsage
  costUsd?: number
  metadata?: Record<string, unknown>
}

/**
 * Fire-and-forget usage event submission.
 * Errors are silently swallowed so they never break the main request flow.
 */
export function reportUsage(opts: UsageReportOptions): void {
  const body = JSON.stringify({
    workspaceId: opts.workspaceId,
    brandId: opts.brandId,
    userId: opts.userId,
    service: opts.service,
    operation: opts.operation,
    model: opts.usage.model,
    provider: opts.usage.provider,
    promptTokens: opts.usage.promptTokens,
    completionTokens: opts.usage.completionTokens,
    totalTokens: opts.usage.totalTokens,
    unit: 'tokens',
    costUsd: opts.costUsd,
    metadata: opts.metadata ?? {},
  })

  fetch(`${opts.apiUrl}/_service/usage/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.serviceToken}`,
    },
    body,
  }).catch(() => {
    // silent — usage tracking must never break the main flow
  })
}
