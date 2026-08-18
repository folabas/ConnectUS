/**
 * ICE configuration.
 *
 * The interesting case is the time-limited TURN credential: it is an HMAC the
 * TURN server recomputes, so a formatting mistake here is invisible until real
 * users behind symmetric NAT silently fail to connect.
 */

import crypto from 'crypto';
import type { AddressInfo } from 'net';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    apiClient,
    connectDatabase,
    disconnectDatabase,
    registerUser,
    resetDatabase,
} from './helpers';

let api: ReturnType<typeof apiClient>;

beforeAll(async () => {
    await connectDatabase();
});

afterAll(async () => {
    await disconnectDatabase();
});

beforeEach(async () => {
    await resetDatabase();
});

/**
 * Boot with specific TURN settings.
 *
 * `config/env.ts` reads the environment once at import, so the registry is
 * reset and the app imported *afterwards* — importing it at the top of the file
 * would pin the first environment for the whole run.
 */
async function bootWith(vars: Record<string, string | undefined>) {
    const previous: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(vars)) {
        previous[key] = process.env[key];
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }

    vi.resetModules();
    const { createApp } = await import('../src/app');
    const { httpServer, io } = createApp();

    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const { port } = httpServer.address() as AddressInfo;

    return {
        started: { baseUrl: `http://127.0.0.1:${port}` },
        restore: async () => {
            io.close();
            await new Promise<void>((resolve) => httpServer.close(() => resolve()));
            for (const [key, value] of Object.entries(previous)) {
                if (value === undefined) delete process.env[key];
                else process.env[key] = value;
            }
        },
    };
}

describe('GET /api/webrtc/ice', () => {
    it('requires authentication, so TURN credentials are not public', async () => {
        const { started, restore } = await bootWith({ TURN_URLS: undefined });
        api = apiClient(started.baseUrl);

        const result = await api('/api/webrtc/ice');
        expect(result.status).toBe(401);

        await restore();
    });

    it('returns STUN only, and says so, when TURN is not configured', async () => {
        const { started, restore } = await bootWith({
            TURN_URLS: undefined,
            TURN_SECRET: undefined,
        });
        api = apiClient(started.baseUrl);
        const user = await registerUser(api);

        const result = await api('/api/webrtc/ice', { token: user.token });

        expect(result.status).toBe(200);
        expect(result.body.data.turnConfigured).toBe(false);
        expect(result.body.data.iceServers).toHaveLength(1);
        expect(String(result.body.data.iceServers[0].urls)).toContain('stun:');

        await restore();
    });

    it('issues a credential a coturn server would accept', async () => {
        const secret = 'test-turn-shared-secret';
        const { started, restore } = await bootWith({
            TURN_URLS: 'turn:turn.test:3478',
            TURN_SECRET: secret,
            TURN_USERNAME: undefined,
            TURN_PASSWORD: undefined,
        });
        api = apiClient(started.baseUrl);
        const user = await registerUser(api);

        const result = await api('/api/webrtc/ice', { token: user.token });
        const turn = result.body.data.iceServers.find((s: any) => s.username);

        expect(result.body.data.turnConfigured).toBe(true);
        expect(turn).toBeTruthy();

        // Username is "<expiry>:<userId>" and expiry must be in the future.
        const [expiry, userId] = String(turn.username).split(':');
        expect(userId).toBe(user.userId);
        expect(Number(expiry)).toBeGreaterThan(Math.floor(Date.now() / 1000));

        // The password is HMAC-SHA1 of the username under the shared secret.
        const expected = crypto
            .createHmac('sha1', secret)
            .update(turn.username)
            .digest('base64');
        expect(turn.credential).toBe(expected);

        await restore();
    });

    it('falls back to static credentials when no secret is set', async () => {
        const { started, restore } = await bootWith({
            TURN_URLS: 'turn:turn.test:3478',
            TURN_SECRET: undefined,
            TURN_USERNAME: 'static-user',
            TURN_PASSWORD: 'static-pass',
        });
        api = apiClient(started.baseUrl);
        const user = await registerUser(api);

        const result = await api('/api/webrtc/ice', { token: user.token });
        const turn = result.body.data.iceServers.find((s: any) => s.username);

        expect(turn).toMatchObject({
            username: 'static-user',
            credential: 'static-pass',
        });

        await restore();
    });

    it('ignores TURN urls with no usable credentials', async () => {
        const { started, restore } = await bootWith({
            TURN_URLS: 'turn:turn.test:3478',
            TURN_SECRET: undefined,
            TURN_USERNAME: undefined,
            TURN_PASSWORD: undefined,
        });
        api = apiClient(started.baseUrl);
        const user = await registerUser(api);

        const result = await api('/api/webrtc/ice', { token: user.token });

        // A TURN entry without credentials is worse than none: the browser
        // retries it and stalls candidate gathering.
        expect(result.body.data.turnConfigured).toBe(false);
        expect(result.body.data.iceServers).toHaveLength(1);

        await restore();
    });
});
