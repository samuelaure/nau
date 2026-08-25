import type { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

/**
 * Registry of external, non-Docker-network clients allowed to call the
 * public notification endpoint (`POST /api/public/notify`).
 *
 * Replaces the older one-endpoint-per-integration pattern (each with its own
 * `X_SECRET` env var and its own route) with a single shared endpoint and a
 * table of client credentials, so adding a new external caller is a config
 * change, not a code change.
 *
 * `CLIENT_KEYS` is a JSON object: { "<clientId>": "<secret>", ... }
 * Example:
 *   CLIENT_KEYS={"nispiras":"...","nau-web":"...","samuelaure-web":"..."}
 */
interface ClientRegistry {
  [clientId: string]: string;
}

let cachedRegistry: ClientRegistry | null = null;

function loadRegistry(): ClientRegistry {
  if (cachedRegistry) return cachedRegistry;

  const raw = process.env['CLIENT_KEYS'];
  if (!raw) {
    logger.error('[ClientAuth] CLIENT_KEYS is not configured');
    cachedRegistry = {};
    return cachedRegistry;
  }

  try {
    const parsed = JSON.parse(raw) as ClientRegistry;
    cachedRegistry = parsed;
    return parsed;
  } catch (err) {
    logger.error({ err }, '[ClientAuth] CLIENT_KEYS is not valid JSON');
    cachedRegistry = {};
    return cachedRegistry;
  }
}

/** Test-only hook to force a reload after mutating process.env. */
export function _resetClientRegistryCache(): void {
  cachedRegistry = null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      clientId?: string;
    }
  }
}

/**
 * Express middleware: validates `x-client-id` / `x-client-secret` against
 * the CLIENT_KEYS registry. On success, attaches `req.clientId`.
 */
export function requireClientAuth(req: Request, res: Response, next: NextFunction): void {
  const clientId = req.headers['x-client-id'];
  const clientSecret = req.headers['x-client-secret'];

  if (!clientId || typeof clientId !== 'string' || !clientSecret || typeof clientSecret !== 'string') {
    res.status(401).json({ error: 'Missing x-client-id or x-client-secret' });
    return;
  }

  const registry = loadRegistry();
  const expectedSecret = registry[clientId];

  if (!expectedSecret || expectedSecret !== clientSecret) {
    logger.warn({ clientId }, '[ClientAuth] Invalid client credentials');
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  req.clientId = clientId;
  next();
}
