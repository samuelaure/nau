module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/app.ts',
    '!src/main.ts',
    '!src/scheduler.ts',
    '!src/scripts/**',
    '!src/modules/content/**',
    '!src/modules/ingestion/**',
    '!src/modules/proactive/**',
    '!src/modules/workspaces/**',
    '!src/queues/download.worker.ts',
  ],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleNameMapper: {
    '^dotenv$': '<rootDir>/src/__mocks__/empty-module.js',
    '^node-cron$': '<rootDir>/src/__mocks__/empty-module.js',
    '^fastify$': '<rootDir>/src/__mocks__/empty-module.js',
    '^@fastify/(.*)$': '<rootDir>/src/__mocks__/empty-module.js',
  },
  globals: {
    'ts-jest': {
      diagnostics: false,
      tsconfig: {
        esModuleInterop: true,
      },
    },
  },
};
