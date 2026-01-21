import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service.js';
import { asyncHandler } from './errors/asyncHandler.js';
import { AppError } from './errors/AppError.js';
import { db } from './db.js';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const authMiddleware = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    let token: string | undefined;

    // 1. Get token from header or cookie
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if ((req as any).cookies?.token) {
      token = (req as any).cookies.token;
    }

    if (!token) {
      throw new AppError('Acceso denegado. No se encontró token de autenticación.', 401);
    }

    // 2. Verify token
    const decoded = AuthService.verifyToken(token);

    // 3. Check if user still exists
    const user = await db.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      throw new AppError('El usuario ya no existe.', 401);
    }

    // 4. Attach user to request
    req.user = user;
    next();
  }
);
