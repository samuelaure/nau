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
  static generateToken(userId: string) {
    return jwt.sign({ id: userId }, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRES_IN as any,
    });
  }

  /**
   * Verified a JWT and returns the user payload.
   */
  static verifyToken(token: string) {
    try {
      return jwt.verify(token, config.JWT_SECRET) as { id: string };
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

    logger.info('Seeding initial admin user...');
    const hashedPassword = await bcrypt.hash('admin123', 10);

    await db.user.create({
      data: {
        email: 'samuel@whatsnau.com',
        password: hashedPassword,
        name: 'Samuel Aure',
        role: 'ADMIN',
      },
    });

    logger.info('Initial admin user created: samuel@whatsnau.com / admin123');
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

    const token = this.generateToken(user.id);
    return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
  }
}
