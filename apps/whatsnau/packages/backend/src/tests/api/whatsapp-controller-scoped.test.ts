import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import whatsappRouter from '../../api/whatsapp.controller.js';
import { db } from '../../core/db.js';

// Mock DB
vi.mock('../../core/db.js', () => ({
  db: {
    whatsAppConfig: {
      upsert: vi.fn().mockResolvedValue({ id: 'config-123' }),
    },
  },
}));

// Mock Auth Middleware
vi.mock('../../core/authMiddleware.js', () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    req.user = { id: 'user-1', tenantId: 'tenant-A' };
    req.tenantId = 'tenant-A';
    next();
  },
}));

// Mock Config to avoid side effects
vi.mock('../../core/config.js', () => ({
  config: {
    WHATSAPP_VERSION: 'v18.0',
    META_APP_ID: 'app-id',
    META_APP_SECRET: 'app-secret',
    // ...other config
  },
}));

// Mock Logger
vi.mock('../../core/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock Fetch Global
global.fetch = vi.fn();

describe('WhatsApp Controller - Tenant Scoping', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/whatsapp', whatsappRouter);

    // Mock successful Meta API responses
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'meta-access-token',
        data: [], // mock for other calls
      }),
    } as Response);
  });

  it('should scope upsert operation to the authenticated tenantId', async () => {
    const payload = {
      code: 'auth-code-123',
      phone_number_id: 'phone-1',
      waba_id: 'waba-1',
    };

    await request(app).post('/api/whatsapp/onboard').send(payload).expect(200);

    expect(db.whatsAppConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_phoneNumberId: {
            tenantId: 'tenant-A',
            phoneNumberId: 'phone-1',
          },
        },
        create: expect.objectContaining({
          tenantId: 'tenant-A',
        }),
      })
    );
  });
});
