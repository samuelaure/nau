export const COOKIE_ACCESS_TOKEN = 'nau_at'
export const COOKIE_REFRESH_TOKEN = 'nau_rt'
export const COOKIE_CSRF = 'nau_csrf'
export const HEADER_CSRF = 'x-nau-csrf'

export interface SetCookieOptions {
  domain?: string
  secure?: boolean
}

export function buildAccessTokenCookie(token: string, opts: SetCookieOptions = {}): string {
  const parts = [
    `${COOKIE_ACCESS_TOKEN}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=900',
  ]
  if (opts.domain) parts.push(`Domain=${opts.domain}`)
  if (opts.secure ?? true) parts.push('Secure')
  return parts.join('; ')
}

export function buildRefreshTokenCookie(token: string, opts: SetCookieOptions = {}): string {
  const parts = [
    `${COOKIE_REFRESH_TOKEN}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${30 * 24 * 60 * 60}`,
  ]
  if (opts.domain) parts.push(`Domain=${opts.domain}`)
  if (opts.secure ?? true) parts.push('Secure')
  return parts.join('; ')
}

export function buildClearCookies(opts: SetCookieOptions = {}): string[] {
  const domain = opts.domain ? `Domain=${opts.domain}; ` : ''
  const secure = opts.secure ?? true ? '; Secure' : ''
  return [
    `${COOKIE_ACCESS_TOKEN}=; Path=/; ${domain}HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
    `${COOKIE_REFRESH_TOKEN}=; Path=/; ${domain}HttpOnly; SameSite=Strict; Max-Age=0${secure}`,
    `${COOKIE_CSRF}=; Path=/; SameSite=Lax; Max-Age=0`,
  ]
}
