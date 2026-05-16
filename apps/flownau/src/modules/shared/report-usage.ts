import { signServiceToken } from '@nau/auth'
import { reportUsage } from '@nau/llm-client'
import type { LLMUsage } from '@nau/llm-client'

const NAU_API_URL = process.env.NAU_API_URL ?? 'https://api.9nau.com'
const AUTH_SECRET = process.env.AUTH_SECRET ?? ''

export interface FlownauUsageOpts {
  operation: string
  brandId?: string
  workspaceId?: string
  userId?: string
  usage: LLMUsage
}

export function reportFlownauUsage(opts: FlownauUsageOpts): void {
  signServiceToken({ iss: 'flownau', aud: '9nau-api', secret: AUTH_SECRET })
    .then((serviceToken) => {
      reportUsage({
        apiUrl: NAU_API_URL,
        serviceToken,
        workspaceId: opts.workspaceId ?? '',
        brandId: opts.brandId,
        userId: opts.userId,
        service: 'flownau',
        operation: opts.operation,
        usage: opts.usage,
      })
    })
    .catch(() => {
      // silent — usage tracking must never break the main flow
    })
}
