/**
 * Environment validation, run once at boot.
 *
 * `utils/jwt.ts` previously fell back to the literal string
 * 'default-secret-change-this' when JWT_SECRET was unset. A deploy that forgot
 * the variable would boot happily and sign every token with a value published in
 * the repository. Missing required config is now a startup failure rather than a
 * silent downgrade.
 */

import { z } from 'zod';

const schema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(5000),

    MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

    JWT_SECRET: z
        .string()
        .min(32, 'JWT_SECRET must be at least 32 characters')
        .refine(
            (value) => !/^(default|change|secret|your)/i.test(value),
            'JWT_SECRET looks like a placeholder — generate a real one',
        ),
    JWT_EXPIRE: z.string().default('7d'),

    /** Comma-separated list of origins allowed to call the API and open sockets. */
    ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
    FRONTEND_URL: z.string().url().default('http://localhost:3000'),

    // Email is optional: without it, invites and password resets are skipped
    // rather than crashing the request.
    EMAIL_HOST: z.string().optional(),
    EMAIL_PORT: z.coerce.number().int().positive().optional(),
    EMAIL_USER: z.string().optional(),
    EMAIL_PASS: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),

    // Mux is optional: uploads are disabled without it.
    MUX_TOKEN_ID: z.string().optional(),
    MUX_TOKEN_SECRET: z.string().optional(),

    // WebRTC. STUN has a sane public default; TURN is optional but strongly
    // recommended, since STUN alone cannot connect peers behind symmetric NAT.
    STUN_URLS: z
        .string()
        .default('stun:stun.l.google.com:19302,stun:global.stun.twilio.com:3478'),
    TURN_URLS: z.string().optional(),
    /** Shared secret for time-limited credentials (coturn / Twilio scheme). */
    TURN_SECRET: z.string().optional(),
    /** Static credentials, used only when TURN_SECRET is absent. */
    TURN_USERNAME: z.string().optional(),
    TURN_PASSWORD: z.string().optional(),

    /**
     * Cloudflare Realtime TURN. Takes precedence over TURN_URLS when set: its
     * credentials come from Cloudflare's API rather than a shared secret, and
     * the key is long-lived so it must never reach the browser.
     */
    CLOUDFLARE_TURN_KEY_ID: z.string().optional(),
    CLOUDFLARE_TURN_API_TOKEN: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
    const issues = parsed.error.issues
        .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
        .join('\n');
    console.error(`\nInvalid environment configuration:\n${issues}\n`);
    console.error('See backend/env.example for the full list.\n');
    process.exit(1);
}

const raw = parsed.data;

export const env = {
    ...raw,
    allowedOrigins: raw.ALLOWED_ORIGINS.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    isProduction: raw.NODE_ENV === 'production',
    /** Email sending is configured (either SMTP or Resend). */
    emailEnabled: Boolean(raw.RESEND_API_KEY || (raw.EMAIL_HOST && raw.EMAIL_USER)),
    /** Direct uploads are configured. */
    muxEnabled: Boolean(raw.MUX_TOKEN_ID && raw.MUX_TOKEN_SECRET),

    stunUrls: raw.STUN_URLS.split(',').map((u) => u.trim()).filter(Boolean),
    turnUrls: (raw.TURN_URLS ?? '').split(',').map((u) => u.trim()).filter(Boolean),
    /** TURN is usable: Cloudflare, or URLs plus a secret or credential pair. */
    turnEnabled: Boolean(
        (raw.CLOUDFLARE_TURN_KEY_ID && raw.CLOUDFLARE_TURN_API_TOKEN) ||
            (raw.TURN_URLS &&
                (raw.TURN_SECRET || (raw.TURN_USERNAME && raw.TURN_PASSWORD))),
    ),
};

export type Env = typeof env;
