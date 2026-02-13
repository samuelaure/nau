import { vi } from 'vitest';

// Global mocks for infrastructure
vi.mock('./infrastructure/queues/connection.js', () => ({
  connection: {
    on: vi.fn(),
    quit: vi.fn().mockResolvedValue('OK'),
    ping: vi.fn().mockResolvedValue('PONG'),
  },
  checkRedisHealth: vi.fn().mockResolvedValue(true),
}));

vi.mock('./infrastructure/queues/maintenance.queue.js', () => ({
  maintenanceQueue: {
    add: vi.fn().mockResolvedValue({ id: 'mock-job' }),
  },
  initRepeatableJobs: vi.fn(),
}));

// Mock DB health check to avoid real DB connection in unit tests
vi.mock('./core/db.js', async (importOriginal) => {
  const original = await importOriginal<any>();
  return {
    ...original,
    checkDatabaseHealth: vi.fn().mockResolvedValue(true),
  };
});

// Mock config to provide valid default values for tests (prevents ZodError in CI)
vi.mock('./core/config.js', () => ({
  config: {
    NODE_ENV: 'test',
    LOG_LEVEL: 'info',
    DASHBOARD_URL: 'http://localhost:5173',
    ALLOWED_ORIGINS: 'http://localhost:5173',
    INITIAL_ADMIN_PASSWORD: 'test-admin-password',

    // WhatsApp (Optional but mocked for backward compatibility in tests)
    WHATSAPP_VERSION: 'v18.0',
    WHATSAPP_PHONE_NUMBER_ID: 'test-phone-id',
    WHATSAPP_PHONE_NUMBER: 'test-phone-number',
    WHATSAPP_BUSINESS_ACCOUNT_ID: 'test-business-account-id',
    WHATSAPP_ACCESS_TOKEN: 'test-access-token',
    WHATSAPP_VERIFY_TOKEN: 'test-verify-token',

    // Meta App (Optional)
    META_APP_ID: 'test-app-id',
    META_APP_SECRET: 'test-app-secret',

    // OpenAI (Optional but mocked)
    OPENAI_API_KEY: 'test-openai-key',
    PRIMARY_AI_MODEL: 'gpt-4o',
    CHEAP_AI_MODEL: 'gpt-4o-mini',

    // Telegram (System required)
    TELEGRAM_BOT_TOKEN: 'test-bot-token',
    TELEGRAM_SYSTEM_CHAT_ID: 'test-system-chat-id',

    // Security
    JWT_SECRET: 'test-jwt-secret',
    JWT_EXPIRES_IN: '7d',

    // Redis
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,

    // Provider
    WHATSAPP_PROVIDER: 'meta' as const,
  },
}));
