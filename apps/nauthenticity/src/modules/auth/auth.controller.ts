import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { config } from '../../config';

const ACCOUNTS_URL = process.env['ACCOUNTS_URL'] ?? 'https://accounts.9nau.com';
const DASHBOARD_URL = process.env['DASHBOARD_URL'] ?? 'https://nauthenticity.9nau.com';

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

  // Session check for the SPA: returns user info if nau_at cookie is valid.
  fastify.get('/auth/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const cookieHeader = request.headers.cookie ?? '';
    const token = parseCookie(cookieHeader, 'nau_at');

    if (!token) return reply.status(401).send({ error: 'Not authenticated' });

    try {
      const payload = verifyToken(token);
      return reply.send({ id: payload['sub'], workspaceId: payload['workspaceId'] });
    } catch {
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }
  });
};
