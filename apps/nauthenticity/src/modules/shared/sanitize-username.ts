/**
 * Normalize a raw Instagram handle to a bare username:
 *   - strips URL prefix (instagram.com/)
 *   - strips query/hash/path tail
 *   - strips leading @
 *   - keeps only [a-zA-Z0-9._]
 */
export function sanitiseUsername(raw: string): string {
  let u = raw.trim()
  if (u.includes('instagram.com/')) u = u.split('instagram.com/')[1] ?? u
  u = u.split('?')[0].split('#')[0].split('/')[0]
  if (u.startsWith('@')) u = u.slice(1)
  return u.replace(/[^a-zA-Z0-9._]/g, '').toLowerCase()
}
