/**
 * Watch history, and the attendance record it depends on.
 *
 * The interesting case is that `participants` is emptied as people leave, so
 * anything built on it reports an empty room the moment a session ends. History
 * reads the append-only `attendees` list instead, and these tests pin that
 * distinction by actually removing people before asking.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
    apiClient,
    connectDatabase,
    createRoom,
    disconnectDatabase,
    registerUser,
    resetDatabase,
    seedMovie,
    startTestServer,
    type TestServer,
    type TestUser,
} from './helpers';

let server: TestServer;
let api: ReturnType<typeof apiClient>;

beforeAll(async () => {
    await connectDatabase();
    server = await startTestServer();
    api = apiClient(server.baseUrl);
});

afterAll(async () => {
    await server.close();
    await disconnectDatabase();
});

beforeEach(async () => {
    await resetDatabase();
});

describe('GET /api/rooms/history', () => {
    let host: TestUser;
    let guest: TestUser;

    beforeEach(async () => {
        host = await registerUser(api, 'Host Person');
        guest = await registerUser(api, 'Guest Person');
    });

    it('requires authentication', async () => {
        expect((await api('/api/rooms/history')).status).toBe(401);
    });

    it('is empty for someone who has never been in a room', async () => {
        const result = await api('/api/rooms/history', { token: guest.token });
        expect(result.status).toBe(200);
        expect(result.body.data).toEqual([]);
    });

    it('records the host as having attended their own room', async () => {
        const movie = await seedMovie();
        await createRoom(api, host.token, movie._id.toString(), { name: 'Hosted Night' });

        const result = await api('/api/rooms/history', { token: host.token });

        expect(result.body.data).toHaveLength(1);
        expect(result.body.data[0]).toMatchObject({
            name: 'Hosted Night',
            youHosted: true,
        });
        expect(result.body.data[0].movie.title).toBe('Test Feature');
    });

    it('still remembers who was there after everyone has left', async () => {
        // The whole point of the attendees field: participants is empty by now.
        const movie = await seedMovie();
        const room = await createRoom(api, host.token, movie._id.toString());

        await api('/api/rooms/join', {
            method: 'POST',
            token: guest.token,
            body: { roomId: room._id },
        });
        await api(`/api/rooms/${room._id}/leave`, { method: 'POST', token: guest.token });

        const { Room } = await import('../src/models/Room');
        const stored = await Room.findById(room._id);
        // Precondition: the live roster really has dropped them.
        expect(stored!.participants.map(String)).not.toContain(guest.userId);
        expect(stored!.attendees.map(String)).toContain(guest.userId);

        const result = await api('/api/rooms/history', { token: host.token });
        const companions = result.body.data[0].companions;

        expect(companions).toHaveLength(1);
        expect(companions[0]).toMatchObject({
            _id: guest.userId,
            fullName: 'Guest Person',
            isHost: false,
        });
    });

    it('never lists you among your own companions', async () => {
        const movie = await seedMovie();
        const room = await createRoom(api, host.token, movie._id.toString());
        await api('/api/rooms/join', {
            method: 'POST',
            token: guest.token,
            body: { roomId: room._id },
        });

        const asGuest = await api('/api/rooms/history', { token: guest.token });
        const ids = asGuest.body.data[0].companions.map((c: any) => c._id);

        expect(ids).not.toContain(guest.userId);
        expect(ids).toContain(host.userId);
    });

    it('marks which companion was the host', async () => {
        const movie = await seedMovie();
        const room = await createRoom(api, host.token, movie._id.toString());
        await api('/api/rooms/join', {
            method: 'POST',
            token: guest.token,
            body: { roomId: room._id },
        });

        const asGuest = await api('/api/rooms/history', { token: guest.token });
        const [companion] = asGuest.body.data[0].companions;

        expect(companion).toMatchObject({ _id: host.userId, isHost: true });
        expect(asGuest.body.data[0].youHosted).toBe(false);
    });

    it('shows a guest the rooms they joined, and not ones they did not', async () => {
        const movie = await seedMovie();
        const joined = await createRoom(api, host.token, movie._id.toString(), {
            name: 'Attended',
        });
        await createRoom(api, host.token, movie._id.toString(), { name: 'Not Attended' });

        await api('/api/rooms/join', {
            method: 'POST',
            token: guest.token,
            body: { roomId: joined._id },
        });

        const result = await api('/api/rooms/history', { token: guest.token });
        const names = result.body.data.map((entry: any) => entry.name);

        expect(names).toContain('Attended');
        expect(names).not.toContain('Not Attended');
    });

    it('keeps finished sessions in history', async () => {
        // Ending a room must not erase it — that is the entire archive.
        const movie = await seedMovie();
        const room = await createRoom(api, host.token, movie._id.toString(), {
            name: 'Finished Night',
        });
        await api(`/api/rooms/${room._id}/end`, { method: 'POST', token: host.token });

        const result = await api('/api/rooms/history', { token: host.token });

        expect(result.body.data[0]).toMatchObject({
            name: 'Finished Night',
            status: 'finished',
        });
    });

    it('returns the most recent session first', async () => {
        const movie = await seedMovie();
        await createRoom(api, host.token, movie._id.toString(), { name: 'Older' });
        await new Promise((r) => setTimeout(r, 1100));
        await createRoom(api, host.token, movie._id.toString(), { name: 'Newer' });

        const result = await api('/api/rooms/history', { token: host.token });
        expect(result.body.data[0].name).toBe('Newer');
    });

    it('is not confused by the literal path segment', async () => {
        // '/history' sits above '/:id'; if that order were wrong it would be
        // parsed as a room id and return 404 or a cast error.
        const result = await api('/api/rooms/history', { token: host.token });
        expect(result.status).toBe(200);
        expect(Array.isArray(result.body.data)).toBe(true);
    });
});

describe('attendance recording', () => {
    it('records everyone admitted through the approval flow', async () => {
        const host = await registerUser(api, 'Host');
        const guest = await registerUser(api, 'Guest');
        const movie = await seedMovie();
        const room = await createRoom(api, host.token, movie._id.toString(), {
            type: 'private',
            approvalRequired: true,
        });

        await api(`/api/rooms/${room._id}/request-join`, { method: 'POST', token: guest.token });
        await api(`/api/rooms/${room._id}/approve-request/${guest.userId}`, {
            method: 'POST',
            token: host.token,
        });

        const { Room } = await import('../src/models/Room');
        const stored = await Room.findById(room._id);
        expect(stored!.attendees.map(String)).toContain(guest.userId);
    });

    it('does not duplicate someone who joins repeatedly', async () => {
        const host = await registerUser(api, 'Host');
        const guest = await registerUser(api, 'Guest');
        const movie = await seedMovie();
        const room = await createRoom(api, host.token, movie._id.toString());

        for (let i = 0; i < 3; i++) {
            await api('/api/rooms/join', {
                method: 'POST',
                token: guest.token,
                body: { roomId: room._id },
            });
            await api(`/api/rooms/${room._id}/leave`, { method: 'POST', token: guest.token });
        }

        const { Room } = await import('../src/models/Room');
        const stored = await Room.findById(room._id);
        const appearances = stored!.attendees.filter((a) => a.toString() === guest.userId);
        expect(appearances).toHaveLength(1);
    });
});
