import { describe, it, expect } from 'vitest';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = util.promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Path to the helper script
const runnerScript = path.resolve(__dirname, 'load-config.ts');

describe('Config Hardening', () => {
  it('should fail to load in production with default secrets', async () => {
    // We explicitly set the FORBIDDEN default secret to trigger the validation error
    const cmd = `npx cross-env NODE_ENV=production REDIS_PASSWORD=secure JWT_SECRET=super-secret-change-me-in-production npx tsx "${runnerScript}"`;

    try {
      await execAsync(cmd);
      throw new Error('Process should have failed');
    } catch (error: any) {
      if (error.message === 'Process should have failed') {
        throw error;
      }
      expect(error.stderr).toContain('JWT_SECRET must be changed in production');
    }
  }, 20000);

  it('should pass in production with proper secrets', async () => {
    const cmd = `npx cross-env NODE_ENV=production REDIS_PASSWORD=secure JWT_SECRET=really-secure-key-12345 npx tsx "${runnerScript}"`;

    await execAsync(cmd);
  }, 20000);
});
