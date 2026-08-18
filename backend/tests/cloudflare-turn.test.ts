/**
 * Cloudflare Realtime TURN.
 *
 * `fetch` is stubbed throughout: the point is to pin the request shape against
 * Cloudflare's documented contract and to prove the caching and failure
 * behaviour, none of which needs a real account. What this cannot prove is that
 * Cloudflare accepts a real key — that only shows up once one exists.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const KEY_ID = 'test-key-id';
const API_TOKEN = 'test-api-token';

/** The documented 201 response shape. */
const cloudflareResponse = {
    iceServers: [
        { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.cloudflare.com:53'] },
        {
            urls: ['turn:turn.cloudflare.com:3478?transport=udp'],
            username: 'generated-username',
            credential: 'generated-credential',
        },
    ],
};

/**
 * The other shape Cloudflare returns: one entry whose urls array mixes stun,
 * turn and turns, sharing a single credential pair. This is what the dashboard
 * and the credentials guide actually show, and counting array entries to detect
 * a relay reported "none" for it.
 */
const combinedResponse = {
    iceServers: [
        {
            urls: [
                'stun:stun.cloudflare.com:3478',
                'turn:turn.cloudflare.com:3478?transport=udp',
                'turn:turn.cloudflare.com:3478?transport=tcp',
                'turns:turn.cloudflare.com:5349?transport=tcp',
            ],
            username: 'xxxx',
            credential: 'yyyy',
        },
    ],
};

let fetchMock: ReturnType<typeof vi.fn>;

function respond(payload: unknown, status = 201) {
    return Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        json: async () => payload,
    } as Response);
}

beforeEach(() => {
    vi.resetModules();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    process.env.CLOUDFLARE_TURN_KEY_ID = KEY_ID;
    process.env.CLOUDFLARE_TURN_API_TOKEN = API_TOKEN;
});

afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.CLOUDFLARE_TURN_KEY_ID;
    delete process.env.CLOUDFLARE_TURN_API_TOKEN;
});

describe('cloudflare turn credentials', () => {
    it('calls the documented endpoint with the key in the Authorization header', async () => {
        fetchMock.mockImplementation(() => respond(cloudflareResponse));
        const { getCloudflareIceServers } = await import('../src/services/cloudflareTurn');

        const servers = await getCloudflareIceServers();

        expect(servers).toHaveLength(2);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe(
            `https://rtc.live.cloudflare.com/v1/turn/keys/${KEY_ID}/credentials/generate-ice-servers`,
        );
        expect(init.method).toBe('POST');
        expect(init.headers.Authorization).toBe(`Bearer ${API_TOKEN}`);
        expect(JSON.parse(init.body)).toEqual({ ttl: 24 * 60 * 60 });
    });

    it('reuses a credential instead of minting one per request', async () => {
        // Credentials are not bound to a user, so a fetch per room join would add
        // a Cloudflare round trip to every participant entering a room.
        fetchMock.mockImplementation(() => respond(cloudflareResponse));
        const { getCloudflareIceServers } = await import('../src/services/cloudflareTurn');

        await getCloudflareIceServers();
        await getCloudflareIceServers();
        await getCloudflareIceServers();

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('collapses concurrent misses into one upstream request', async () => {
        let resolveFetch: (value: unknown) => void = () => {};
        fetchMock.mockImplementation(
            () => new Promise((resolve) => {
                resolveFetch = resolve;
            }),
        );
        const { getCloudflareIceServers } = await import('../src/services/cloudflareTurn');

        const all = Promise.all([
            getCloudflareIceServers(),
            getCloudflareIceServers(),
            getCloudflareIceServers(),
        ]);

        resolveFetch({ ok: true, status: 201, json: async () => cloudflareResponse });
        const results = await all;

        expect(fetchMock).toHaveBeenCalledTimes(1);
        results.forEach((r) => expect(r).toHaveLength(2));
    });

    it('returns null on a rejected key rather than throwing', async () => {
        fetchMock.mockImplementation(() => respond({ error: 'unauthorized' }, 401));
        const { getCloudflareIceServers } = await import('../src/services/cloudflareTurn');

        expect(await getCloudflareIceServers()).toBeNull();
    });

    it('returns null when the request fails outright', async () => {
        fetchMock.mockImplementation(() => Promise.reject(new Error('network down')));
        const { getCloudflareIceServers } = await import('../src/services/cloudflareTurn');

        expect(await getCloudflareIceServers()).toBeNull();
    });

    it('serves the previous credential when a refresh fails', async () => {
        // The cached credential is valid for another twelve hours by
        // construction, so serving it beats serving nothing.
        fetchMock.mockImplementationOnce(() => respond(cloudflareResponse));
        const { getCloudflareIceServers, resetCloudflareTurnCache } = await import(
            '../src/services/cloudflareTurn'
        );
        resetCloudflareTurnCache();

        const first = await getCloudflareIceServers();
        expect(first).toHaveLength(2);

        // Force the next call past the cache window.
        vi.setSystemTime(new Date(Date.now() + 13 * 60 * 60 * 1000));
        fetchMock.mockImplementation(() => respond({ error: 'boom' }, 500));

        const second = await getCloudflareIceServers();
        expect(second).toEqual(first);

        vi.useRealTimers();
    });

    it('does nothing when only one of the two variables is set', async () => {
        delete process.env.CLOUDFLARE_TURN_API_TOKEN;
        vi.resetModules();
        const { getCloudflareIceServers, isCloudflareTurnConfigured } = await import(
            '../src/services/cloudflareTurn'
        );

        expect(isCloudflareTurnConfigured()).toBe(false);
        expect(await getCloudflareIceServers()).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe('buildIceServers with Cloudflare', () => {
    it('uses Cloudflare wholesale, including its STUN servers', async () => {
        fetchMock.mockImplementation(() => respond(cloudflareResponse));
        const { buildIceServers } = await import('../src/controllers/webrtcController');

        const { iceServers } = await buildIceServers('user-1');

        expect(iceServers).toEqual(cloudflareResponse.iceServers);
        // No public STUN mixed in: Cloudflare supplies its own.
        expect(JSON.stringify(iceServers)).not.toContain('google.com');
    });

    it('reports a relay for the single combined entry Cloudflare returns', async () => {
        // Regression: turnConfigured was `iceServers.length > 1`, so this shape
        // reported no relay while the relay was working, and the watch screen
        // told everyone connections were direct-only.
        fetchMock.mockImplementation(() => respond(combinedResponse));
        const { buildIceServers, hasUsableRelay } = await import(
            '../src/controllers/webrtcController'
        );

        const { iceServers } = await buildIceServers('user-1');

        expect(iceServers).toHaveLength(1);
        expect(hasUsableRelay(iceServers)).toBe(true);
    });

    it('reports a relay for the split two-entry shape as well', async () => {
        fetchMock.mockImplementation(() => respond(cloudflareResponse));
        const { buildIceServers, hasUsableRelay } = await import(
            '../src/controllers/webrtcController'
        );

        const { iceServers } = await buildIceServers('user-1');
        expect(hasUsableRelay(iceServers)).toBe(true);
    });

    it('falls back to STUN when Cloudflare is unreachable', async () => {
        // A Cloudflare outage should cost relay-dependent users their video, not
        // break the room for everyone in it.
        fetchMock.mockImplementation(() => Promise.reject(new Error('down')));
        const { buildIceServers } = await import('../src/controllers/webrtcController');

        const { iceServers } = await buildIceServers('user-1');

        expect(iceServers).toHaveLength(1);
        expect(JSON.stringify(iceServers)).toContain('stun:');
    });
});

describe('hasUsableRelay', () => {
    it('is false for STUN alone', async () => {
        const { hasUsableRelay } = await import('../src/controllers/webrtcController');
        expect(hasUsableRelay([{ urls: ['stun:stun.example:3478'] }])).toBe(false);
    });

    it('is false for a turn url with no credentials', async () => {
        // Worse than no entry: the browser retries it and stalls candidate
        // gathering for everyone.
        const { hasUsableRelay } = await import('../src/controllers/webrtcController');
        expect(hasUsableRelay([{ urls: ['turn:turn.example:3478'] }])).toBe(false);
    });

    it('accepts a single urls string rather than an array', async () => {
        const { hasUsableRelay } = await import('../src/controllers/webrtcController');
        expect(
            hasUsableRelay([
                { urls: 'turns:turn.example:5349', username: 'u', credential: 'c' },
            ]),
        ).toBe(true);
    });

    it('is false for an empty list', async () => {
        const { hasUsableRelay } = await import('../src/controllers/webrtcController');
        expect(hasUsableRelay([])).toBe(false);
    });
});
