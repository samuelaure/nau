import { NauApiError, NauUnauthorizedError, NauForbiddenError, NauNotFoundError } from './errors'
import { signServiceToken } from '@nau/auth'

export interface NauClientOptions {
  baseUrl: string
  token?: string
}

export interface NauServiceClientOptions {
  baseUrl: string
  serviceSecret: string
  serviceSlug: string
  targetSlug: string
}

async function throwOnError(res: Response): Promise<void> {
  if (res.ok) return
  let message = res.statusText
  try {
    const body = await res.json() as { message?: string }
    if (body.message) message = String(body.message)
  } catch {
    // ignore parse error
  }
  if (res.status === 401) throw new NauUnauthorizedError(message)
  if (res.status === 403) throw new NauForbiddenError(message)
  if (res.status === 404) throw new NauNotFoundError(message)
  throw new NauApiError(message, res.status, 'API_ERROR')
}

export class NauHttpClient {
  protected readonly baseUrl: string
  protected readonly resolveToken: () => Promise<string | null>

  constructor(options: NauClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '')
    const token = options.token ?? null
    this.resolveToken = async () => token
  }

  static forService(options: NauServiceClientOptions): NauHttpClient {
    const instance = Object.create(NauHttpClient.prototype) as NauHttpClient
    ;(instance as unknown as { baseUrl: string }).baseUrl = options.baseUrl.replace(/\/$/, '')
    ;(instance as unknown as { resolveToken: () => Promise<string | null> }).resolveToken = async () =>
      signServiceToken({
        secret: options.serviceSecret,
        iss: options.serviceSlug,
        aud: options.targetSlug,
        ttlSeconds: 60,
      })
    return instance
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(this.baseUrl + path)
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
    }
    const res = await fetch(url.toString(), { headers: await this.buildHeaders() })
    await throwOnError(res)
    return res.json() as Promise<T>
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(this.baseUrl + path, {
      method: 'POST',
      headers: { ...(await this.buildHeaders()), 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    await throwOnError(res)
    return res.json() as Promise<T>
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(this.baseUrl + path, {
      method: 'PATCH',
      headers: { ...(await this.buildHeaders()), 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    await throwOnError(res)
    return res.json() as Promise<T>
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(this.baseUrl + path, {
      method: 'PUT',
      headers: { ...(await this.buildHeaders()), 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    await throwOnError(res)
    return res.json() as Promise<T>
  }

  async delete<T>(path: string): Promise<T> {
    const res = await fetch(this.baseUrl + path, {
      method: 'DELETE',
      headers: await this.buildHeaders(),
    })
    await throwOnError(res)
    return res.json() as Promise<T>
  }

  private async buildHeaders(): Promise<Record<string, string>> {
    const token = await this.resolveToken()
    if (token) return { Authorization: `Bearer ${token}` }
    return {}
  }
}
