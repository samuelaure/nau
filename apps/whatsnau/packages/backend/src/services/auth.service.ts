import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../core/db.js';
import { config } from '../core/config.js';
import { logger } from '../core/logger.js';
import { AppError } from '../core/errors/AppError.js';

export class AuthService {
  /**
   * Generates a JWT for a user.
   */
  static generateToken(userId: string, tenantId: string) {
    return jwt.sign({ id: userId, tenantId }, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRES_IN as any,
    });
  }

  /**
   * Verified a JWT and returns the user payload.
   */
  static verifyToken(token: string) {
    try {
      return jwt.verify(token, config.JWT_SECRET) as { id: string; tenantId: string };
    } catch (error) {
      throw new AppError('Invalid or expired token', 401);
    }
  }

  /**
   * Seeds the initial admin user if no users exist.
   */
  static async seedAdmin() {
    const userCount = await db.user.count();
    if (userCount > 0) return;

    logger.info('Seeding initial admin user and default tenant...');

    // Create default tenant for production data
    const defaultTenant = await (db as any).tenant.create({
      data: {
        name: 'Production',
        slug: 'production',
        isDemo: false,
      },
    });

    const hashedPassword = await bcrypt.hash(config.INITIAL_ADMIN_PASSWORD, 12);

    await db.user.create({
      data: {
        email: 'samuelaure@gmail.com',
        password: hashedPassword,
        name: 'Samuel Aure',
        role: 'ADMIN',
        tenantId: defaultTenant.id,
      },
    });

    logger.info('Initial admin user and default tenant created');
  }

  /**
   * Creates Meta reviewer account with demo tenant for app review.
   */
  static async createMetaReviewerAccount() {
    // Check if Meta reviewer already exists
    const existing = await db.user.findUnique({
      where: { email: 'meta-reviewer@whatsnau.demo' },
    });
    if (existing) {
      logger.info('Meta reviewer account already exists');
      return;
    }

    logger.info('Creating Meta reviewer tenant and account...');

    // Create demo tenant
    const demoTenant = await (db as any).tenant.create({
      data: {
        name: 'Meta Demo',
        slug: 'meta-demo',
        isDemo: true,
      },
    });

    // Hash the Meta reviewer password
    const hashedPassword = await bcrypt.hash('40f0327daa1ea401ea92c251270dc9a7', 12);

    await db.user.create({
      data: {
        email: 'meta-reviewer@whatsnau.demo',
        password: hashedPassword,
        name: 'Meta Reviewer',
        role: 'ADMIN',
        tenantId: demoTenant.id,
      },
    });

    logger.info('Meta reviewer account created: MetaReviewer / 40f0327daa1ea401ea92c251270dc9a7');
    return demoTenant.id;
  }

  /**
   * Authenticates a user and returns a token.
   */
  static async login(email: string, pass: string) {
    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    const isValid = await bcrypt.compare(pass, user.password);
    if (!isValid) {
      throw new AppError('Invalid credentials', 401);
    }

    const token = this.generateToken(user.id, user.tenantId);
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
      },
    };
  }
}
