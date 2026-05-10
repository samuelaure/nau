import { COOKIE_ACCESS_TOKEN } from '@nau/auth'

const CENTRAL_API_URL = process.env['NAU_API_URL'] ?? 'https://api.9nau.com'

export async function proxyToApi(
  req: any,
  res: any,
  endpoint: string,
  method = 'GET',
  body?: unknown,
) {
  const cookieToken = req.cookies?.[COOKIE_ACCESS_TOKEN]
  const bearerToken = req.headers['authorization']?.replace('Bearer ', '')
  const token = cookieToken ?? bearerToken

  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const fetchRes = await fetch(`${CENTRAL_API_URL}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: method !== 'GET' && method !== 'DELETE' ? JSON.stringify(body) : undefined,
    })
    const data = await fetchRes.json().catch(() => ({}))
    res.status(fetchRes.status).json(data)
  } catch {
    res.status(500).json({ error: 'Proxy failed' })
  }
}
