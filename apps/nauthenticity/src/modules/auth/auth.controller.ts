import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { config } from '../../config';

const ACCOUNTS_URL = process.env['ACCOUNTS_URL'] ?? 'https://accounts.9nau.com';
const DASHBOARD_URL = process.env['DASHBOARD_URL'] ?? 'https://nauthenticity.9nau.com';
const NAU_API_URL = process.env['NAU_API_URL'] ?? 'https://api.9nau.com';
const COOKIE_DOMAIN = process.env['COOKIE_DOMAIN'] ?? '.9nau.com';

function parseCookie(cookieHeader: string, name: string): string | undefined {
  return cookieHeader
    .split(';')
    .find((c) => c.trim().startsWith(`${name}=`))
    ?.split('=')
    .slice(1)
    .join('=')
    .trim();
}

function verifyToken(token: string): jwt.JwtPayload {
  const secret = config.authSecret ?? config.jwtSecret;
  const verified = jwt.verify(token, secret);
  if (typeof verified === 'string') throw new Error('string payload');
  return verified;
}

/** Attempts to refresh nau_at using nau_rt. Returns new token strings or null. */
async function tryRefresh(rt: string): Promise<{ at: string; newSetCookies: string[] } | null> {
  try {
    const res = await fetch(`${NAU_API_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `nau_rt=${rt}`,
      },
    });
    if (!res.ok) return null;

    const setCookies: string[] = res.headers.getSetCookie?.() ?? [];
    if (setCookies.length > 0) {
      const atHeader = setCookies.find((h) => h.startsWith('nau_at='));
      if (!atHeader) return null;
      const at = atHeader.split(';')[0].split('=').slice(1).join('=');
      return { at, newSetCookies: setCookies };
    }

    const data = (await res.json()) as { accessToken?: string; refreshToken?: string };
    if (!data.accessToken) return null;

    const isSecure = process.env['NODE_ENV'] === 'production';
    const newSetCookies = [
      `nau_at=${data.accessToken}; Path=/; Domain=${COOKIE_DOMAIN}; Max-Age=${24 * 60 * 60}; HttpOnly; SameSite=Lax${isSecure ? '; Secure' : ''}`,
    ];
    if (data.refreshToken) {
      newSetCookies.push(
        `nau_rt=${data.refreshToken}; Path=/; Domain=${COOKIE_DOMAIN}; Max-Age=${30 * 24 * 60 * 60}; HttpOnly; SameSite=Strict${isSecure ? '; Secure' : ''}`,
      );
    }
    return { at: data.accessToken, newSetCookies };
  } catch {
    return null;
  }
}

export const authController = async (fastify: FastifyInstance) => {
  // SSO callback: accounts redirects here after login.
  // Reads nau_at from the shared .9nau.com cookie (no token in URL needed).
  fastify.get('/auth/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    const cookieHeader = request.headers.cookie ?? '';
    const token = parseCookie(cookieHeader, 'nau_at');

    if (!token) {
      const callbackUrl = encodeURIComponent(`${DASHBOARD_URL}/auth/callback`);
      return reply.redirect(`${ACCOUNTS_URL}/login?continue=${callbackUrl}`);
    }

    try {
      verifyToken(token);
    } catch {
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }

    return reply.redirect('/');
  });

  // Clears the shared .9nau.com session cookies and returns to the landing page.
  fastify.get('/auth/logout', async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.header('Set-Cookie', [
      `nau_at=; Path=/; Domain=${COOKIE_DOMAIN}; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
      `nau_rt=; Path=/; Domain=${COOKIE_DOMAIN}; Max-Age=0; HttpOnly; Secure; SameSite=Strict`,
    ]);
    return reply.redirect('/');
  });

  /**
   * Session check for the SPA. Returns user info from nau_at. If nau_at is
   * expired but nau_rt is present, silently refreshes and sets new cookies on
   * the response so the browser stays authenticated.
   */
  fastify.get('/auth/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const cookieHeader = request.headers.cookie ?? '';
    const at = parseCookie(cookieHeader, 'nau_at');

    if (at) {
      try {
        const payload = verifyToken(at);
        return reply.send({ id: payload['sub'], workspaceId: payload['workspaceId'] });
      } catch (err) {
        const isExpired = err instanceof jwt.TokenExpiredError;
        if (!isExpired) return reply.status(401).send({ error: 'Invalid token' });
      }
    }

    // Access token absent or expired — try silent refresh.
    const rt = parseCookie(cookieHeader, 'nau_rt');
    if (!rt) return reply.status(401).send({ error: 'Not authenticated' });

    const refreshed = await tryRefresh(rt);
    if (!refreshed) return reply.status(401).send({ error: 'Session expired' });

    try {
      const payload = verifyToken(refreshed.at);
      reply.header('Set-Cookie', refreshed.newSetCookies);
      return reply.send({ id: payload['sub'], workspaceId: payload['workspaceId'] });
    } catch {
      return reply.status(401).send({ error: 'Invalid refreshed token' });
    }
  });
};
