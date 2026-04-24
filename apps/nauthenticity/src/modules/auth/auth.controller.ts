import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { config } from '../../config';

export const authController = async (fastify: FastifyInstance) => {
  fastify.get('/auth/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    const { token } = request.query as { token?: string };

    if (!token) {
      return reply.status(400).send({ error: 'Missing token parameter' });
    }

    const secret = config.authSecret ?? config.jwtSecret;
    let payload: jwt.JwtPayload;
    try {
      const verified = jwt.verify(token, secret);
      if (typeof verified === 'string') throw new Error('string payload');
      payload = verified;
    } catch {
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }

    // Set token as httpOnly cookie via Set-Cookie header
    const cookieValue = `nau_token=${token}; Path=/; Max-Age=${7 * 24 * 60 * 60}; HttpOnly; Secure; SameSite=Lax`;
    reply.header('Set-Cookie', cookieValue);

    // Redirect to /auth/complete (SPA-only route) so React Router can extract and store token in localStorage
    return reply.redirect(`/auth/complete?token=${encodeURIComponent(token)}`);
  });
};
