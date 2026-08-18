/**
 * Rate limits.
 *
 * `express-rate-limit` was already a dependency but was never mounted, leaving
 * login, registration, password reset and the email-invite endpoint open to
 * unlimited automated attempts.
 */

import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

const shared = {
    standardHeaders: true as const,
    legacyHeaders: false as const,
    // Rate limiting a local dev loop just gets in the way.
    skip: () => !env.isProduction && process.env.FORCE_RATE_LIMIT !== 'true',
};

/** Everything under /api. Generous — this is an abuse ceiling, not a quota. */
export const apiLimiter = rateLimit({
    ...shared,
    windowMs: 15 * 60 * 1000,
    limit: 1000,
    message: { success: false, message: 'Too many requests. Please slow down.' },
});

/** Credential endpoints: tight, and counted per IP regardless of outcome. */
export const authLimiter = rateLimit({
    ...shared,
    windowMs: 15 * 60 * 1000,
    limit: 10,
    message: {
        success: false,
        message: 'Too many attempts. Please try again in a few minutes.',
    },
});

/** Password reset: stricter still, since each one sends an email. */
export const passwordResetLimiter = rateLimit({
    ...shared,
    windowMs: 60 * 60 * 1000,
    limit: 5,
    message: {
        success: false,
        message: 'Too many password reset requests. Please try again later.',
    },
});

/** State-changing endpoints that create records or send mail. */
export const writeLimiter = rateLimit({
    ...shared,
    windowMs: 60 * 1000,
    limit: 30,
    message: { success: false, message: 'Too many requests. Please slow down.' },
});
