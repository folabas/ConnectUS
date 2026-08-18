/**
 * Cloudflare Realtime TURN.
 *
 * Cloudflare does not use the coturn shared-secret scheme. Credentials are
 * minted by their API, which means the TURN key must stay server-side — it is a
 * long-lived secret, unlike the short-lived credentials it produces.
 *
 * Chosen for ConnectUs because the free allowance (1,000 GB/month across TURN
 * and SFU combined) covers the projected launch load outright, and $0.05/GB
 * beyond it is an order of magnitude below the alternatives. See
 * docs/LAUNCH_CHECKLIST.md for the bandwidth arithmetic.
 */

import { env } from '../config/env';

const CREDENTIALS_URL = (keyId: string) =>
    `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`;

/** Lifetime requested from Cloudflare for each issued credential. */
const CREDENTIAL_TTL_SECONDS = 24 * 60 * 60;

/**
 * Re-use a credential for half its life before asking for another.
 *
 * Cloudflare's credentials are not bound to a user, so there is nothing to gain
 * from minting one per room join — it would just add a round trip to Cloudflare
 * on the critical path of every participant entering a room, and burn API quota.
 * Refreshing at the halfway point means a credential handed out at the last
 * moment before rotation is still valid for hours.
 */
const REFRESH_AFTER_MS = (CREDENTIAL_TTL_SECONDS / 2) * 1000;

/** Give up rather than hold a room join open behind a slow third party. */
const REQUEST_TIMEOUT_MS = 5_000;

export interface CloudflareIceServer {
    urls: string | string[];
    username?: string;
    credential?: string;
}

interface CachedCredentials {
    iceServers: CloudflareIceServer[];
    fetchedAt: number;
}

let cache: CachedCredentials | null = null;
/** Collapses concurrent misses into one upstream request. */
let inFlight: Promise<CloudflareIceServer[] | null> | null = null;

export function isCloudflareTurnConfigured(): boolean {
    return Boolean(env.CLOUDFLARE_TURN_KEY_ID && env.CLOUDFLARE_TURN_API_TOKEN);
}

/** Drops the cached credential. Exposed for tests. */
export function resetCloudflareTurnCache(): void {
    cache = null;
    inFlight = null;
}

async function requestCredentials(): Promise<CloudflareIceServer[] | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(CREDENTIALS_URL(env.CLOUDFLARE_TURN_KEY_ID as string), {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${env.CLOUDFLARE_TURN_API_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ttl: CREDENTIAL_TTL_SECONDS }),
            signal: controller.signal,
        });

        if (!response.ok) {
            // 401 here almost always means the token was pasted with the key id,
            // or the key was deleted in the dashboard. Say so rather than
            // leaving a bare status code in the log.
            console.error(
                `Cloudflare TURN credentials rejected (${response.status}). ` +
                    'Check CLOUDFLARE_TURN_KEY_ID and CLOUDFLARE_TURN_API_TOKEN.',
            );
            return null;
        }

        const payload = (await response.json()) as { iceServers?: CloudflareIceServer[] };

        // Cloudflare returns a single object in some responses and an array in
        // others; normalise so callers do not have to care.
        const servers = payload?.iceServers;
        if (!servers) return null;
        return Array.isArray(servers) ? servers : [servers];
    } catch (error) {
        console.error('Cloudflare TURN request failed:', (error as Error).message);
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Current Cloudflare ICE servers, or null when unconfigured or unreachable.
 * A null result is not fatal: the caller falls back to STUN.
 */
export async function getCloudflareIceServers(): Promise<CloudflareIceServer[] | null> {
    if (!isCloudflareTurnConfigured()) return null;

    if (cache && Date.now() - cache.fetchedAt < REFRESH_AFTER_MS) {
        return cache.iceServers;
    }

    if (inFlight) return inFlight;

    inFlight = requestCredentials()
        .then((servers) => {
            if (servers?.length) cache = { iceServers: servers, fetchedAt: Date.now() };
            // Serve a stale credential rather than nothing if the refresh failed:
            // it is valid for another 12 hours by construction.
            return servers?.length ? servers : (cache?.iceServers ?? null);
        })
        .finally(() => {
            inFlight = null;
        });

    return inFlight;
}
