import request from 'supertest';
import { vi } from 'vitest';

vi.mock('./core/config.js', () => ({
  config: {
    ALLOWED_ORIGINS: 'http://localhost:3000',
    NODE_ENV: 'test',
    PORT: 3000,
    LOG_LEVEL: 'info',
    OPENAI_API_KEY: 'sk-test',
    WHATSAPP_ACCESS_TOKEN: 'EAA-test',
    JWT_SECRET: 'test',
  },
}));

vi.mock('./core/db.js', () => ({
  checkDatabaseHealth: vi.fn().mockResolvedValue(true),
  db: {},
  connectWithRetry: vi.fn(),
}));

vi.mock('./infrastructure/queues/connection.js', () => ({
  checkRedisHealth: vi.fn().mockResolvedValue(true),
  connection: {},
}));

import { app } from './index.js';

describe('API Integration Tests', () => {
  describe('GET /health', () => {
    it('should return 200 and healthy status', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/api/unknown-route');
      expect(response.status).toBe(404);
    });
  });
});
