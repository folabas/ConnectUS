import express from 'express';
import {
    register,
    login,
    logout,
    getMe,
    updateMe,
    forgotPassword,
    resetPassword,
} from '../controllers/authController';
import { authMiddleware } from '../middleware/auth';
import { authLimiter, passwordResetLimiter } from '../middleware/rateLimit';

const router = express.Router();

// Public routes. Credential endpoints are rate limited per IP.
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', logout);
router.post('/forgot-password', passwordResetLimiter, forgotPassword);
router.post('/reset-password/:resetToken', passwordResetLimiter, resetPassword);

// Protected routes
router.get('/me', authMiddleware, getMe);
router.patch('/me', authMiddleware, updateMe);

export default router;
