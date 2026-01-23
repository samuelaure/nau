import { Router } from 'express';
import { AuthService } from '../services/auth.service.js';
import { asyncHandler } from '../core/errors/asyncHandler.js';
import { authMiddleware } from '../core/authMiddleware.js';

const router = Router();

/**
 * @route POST /api/auth/login
 * @desc Authenticate user and get token
 */
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const { token, user } = await AuthService.login(email, password);

    // Set cookie for browser sessions
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    });

    res.json({ success: true, user, token });
  })
);

/**
 * @route POST /api/auth/logout
 * @desc Clear token cookie
 */
router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    res.clearCookie('token');
    res.json({ success: true, message: 'Sesión cerrada correctamente.' });
  })
);

/**
 * @route GET /api/auth/me
 * @desc Get current user from token
 */
router.get(
  '/me',
  authMiddleware,
  asyncHandler(async (req: any, res) => {
    res.json({ success: true, user: req.user });
  })
);

export default router;
