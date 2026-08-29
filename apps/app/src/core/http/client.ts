/**
 * How the app talks to any backend. Not what it says.
 *
 * This is the mechanism only — a URL, a method, cookies, and the shape of a
 * failure. It knows no endpoint, no module, and no domain type. Each
 * `relations/app-{module}/` builds its own hooks on top of this and owns the
 * paths and payloads it sends, because those belong to that module's contract
 * with its counterpart in `api`, not to the app as a whole.
 */

const getApiBaseUrl = () => {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
  return base.replace(/\/$/, '')
}

/**
 * A failed request, with the status preserved.
 *
 * The previous client threw a bare `Error` carrying only a message, so a
 * caller could not tell a 401 from a 500 from a validation error without
 * parsing prose. Anything that wants to branch on the kind of failure — a
 * session that expired versus a field that was rejected — needs the status,
 * so it is kept here rather than flattened away.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** The parsed body, when there was one. Shape is the endpoint's business. */
    readonly body?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const body = await response.json().catch(() => undefined)
    const message =
      (body as { message?: string } | undefined)?.message ??
      `API request failed with status ${response.status}`
    throw new ApiError(message, response.status, body)
  }
  if (response.status === 204) return
  return response.json()
}

const request = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method,
    credentials: 'include',
    ...(body === undefined
      ? {}
      : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  })
  return handleResponse(response)
}

export const apiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}
