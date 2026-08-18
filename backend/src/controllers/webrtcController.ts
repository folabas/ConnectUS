import crypto from 'crypto';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { env } from '../config/env';

/**
 * ICE configuration for peer connections.
 *
 * The client used to hardcode two public STUN servers and nothing else. STUN
 * alone fails for peers behind symmetric NAT — commonly cited at roughly 10-20%
 * of users, and higher on corporate and some mobile networks. Those users see
 * everyone else's video and none of their own reaches anyone.
 *
 * TURN credentials are served from here rather than shipped in the bundle, for
 * two reasons: they can be rotated without a redeploy, and the time-limited
 * form below cannot be scraped from static JavaScript and reused indefinitely.
 */

/** How long an issued TURN credential remains valid. */
const CREDENTIAL_TTL_SECONDS = 12 * 60 * 60;

interface IceServer {
    urls: string | string[];
    username?: string;
    credential?: string;
}

/**
 * The coturn / Twilio "REST API" credential scheme: the username is an expiry
 * timestamp, and the password is an HMAC-SHA1 of it under a shared secret. The
 * TURN server validates without any per-user state.
 */
function timeLimitedCredential(secret: string, userId: string) {
    const expiry = Math.floor(Date.now() / 1000) + CREDENTIAL_TTL_SECONDS;
    const username = `${expiry}:${userId}`;
    const credential = crypto
        .createHmac('sha1', secret)
        .update(username)
        .digest('base64');
    return { username, credential, expiry };
}

export function buildIceServers(userId: string): { iceServers: IceServer[]; ttl: number } {
    const iceServers: IceServer[] = [
        { urls: env.stunUrls },
    ];

    if (env.turnUrls.length > 0) {
        if (env.TURN_SECRET) {
            const { username, credential } = timeLimitedCredential(env.TURN_SECRET, userId);
            iceServers.push({ urls: env.turnUrls, username, credential });
        } else if (env.TURN_USERNAME && env.TURN_PASSWORD) {
            // Static credentials: simpler to set up, but they live as long as you
            // leave them in the environment.
            iceServers.push({
                urls: env.turnUrls,
                username: env.TURN_USERNAME,
                credential: env.TURN_PASSWORD,
            });
        }
    }

    return { iceServers, ttl: CREDENTIAL_TTL_SECONDS };
}

// GET /api/webrtc/ice
export const getIceServers = async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user?.userId;
    if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
    }

    const { iceServers, ttl } = buildIceServers(userId);

    res.status(200).json({
        success: true,
        data: {
            iceServers,
            ttl,
            // Lets the client warn that relay-only peers will fail.
            turnConfigured: iceServers.length > 1,
        },
    });
};
