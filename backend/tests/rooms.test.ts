/**
 * Room HTTP behaviour: the approval flow, membership rules, and the stat
 * accounting that used to double-count.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Socket } from 'socket.io-client';
import {
    apiClient,
    connectDatabase,
    createRoom,
    disconnectDatabase,
    emitWithAck,
    openSocket,
    registerUser,
    resetDatabase,
    seedMovie,
    startTestServer,
    waitFor,
    type TestServer,
    type TestUser,
} from './helpers';

let server: TestServer;
let api: ReturnType<typeof apiClient>;
const openSockets: Socket[] = [];

const track = (socket: Socket) => (openSockets.push(socket), socket);

beforeAll(async () => {
    await connectDatabase();
    server = await startTestServer();
    api = apiClient(server.baseUrl);
});

afterAll(async () => {
    openSockets.forEach((s) => s.disconnect());
    await server.close();
    await disconnectDatabase();
});

beforeEach(async () => {
    openSockets.splice(0).forEach((s) => s.disconnect());
    await resetDatabase();
});

describe('join approval', () => {
    let host: TestUser;
    let guest: TestUser;
    let roomId: string;
    let code: string;

    beforeEach(async () => {
        host = await registerUser(api, 'Host');
        guest = await registerUser(api, 'Guest');
        const movie = await seedMovie();
        const room = await createRoom(api, host.token, movie._id.toString(), {
            type: 'private',
            approvalRequired: true,
        });
        roomId = room._id;
        code = room.code;
    });

    it('gates a waiting room, not only one already playing', async () => {
        // The gate used to apply only when status was 'playing', so anyone with
        // the code walked straight into a waiting private room past the host.
        const result = await api('/api/rooms/join', {
            method: 'POST',
            token: guest.token,
            body: { code },
        });

        expect(result.status).toBe(200);
        expect(result.body.requiresApproval).toBe(true);

        const { Room } = await import('../src/models/Room');
        const room = await Room.findById(roomId);
        expect(room?.participants.map(String)).not.toContain(guest.userId);
    });

    it('notifies the host on their own channel', async () => {
        const hostSocket = track((await openSocket(server.baseUrl, host.token)).socket);
        await emitWithAck(hostSocket, 'join-room', roomId);

        const notified = waitFor(hostSocket, 'join-request-received', 4000);
        await api(`/api/rooms/${roomId}/request-join`, { method: 'POST', token: guest.token });

        const payload = await notified;
        expect(payload).toMatchObject({ roomId });
        expect(payload?.user?._id).toBe(guest.userId);
    });

    it('delivers approval to the requester, who is not in the room channel', async () => {
        // The original bug had two halves: the result was broadcast to the room
        // channel a pending user has by definition not joined, and the lookup
        // ran against a populated joinRequests.user so it never matched at all.
        const guestSocket = track((await openSocket(server.baseUrl, guest.token)).socket);

        await api(`/api/rooms/${roomId}/request-join`, { method: 'POST', token: guest.token });

        const approved = waitFor(guestSocket, 'join-request-approved', 5000);
        const result = await api(
            `/api/rooms/${roomId}/approve-request/${guest.userId}`,
            { method: 'POST', token: host.token },
        );

        expect(result.status).toBe(200);
        expect(await approved).toMatchObject({ roomId });

        const { Room } = await import('../src/models/Room');
        const room = await Room.findById(roomId);
        expect(room?.participants.map(String)).toContain(guest.userId);
    });

    it('delivers rejection to the requester', async () => {
        const guestSocket = track((await openSocket(server.baseUrl, guest.token)).socket);
        await api(`/api/rooms/${roomId}/request-join`, { method: 'POST', token: guest.token });

        const rejected = waitFor(guestSocket, 'join-request-rejected', 5000);
        const result = await api(
            `/api/rooms/${roomId}/reject-request/${guest.userId}`,
            { method: 'POST', token: host.token },
        );

        expect(result.status).toBe(200);
        expect(await rejected).toMatchObject({ roomId });
    });

    it('treats asking twice as a no-op rather than an error', async () => {
        // The client sends this automatically on arrival, so a refresh while a
        // request is already pending must not surface a failure for something
        // that is working. It used to return 400.
        const first = await api(`/api/rooms/${roomId}/request-join`, {
            method: 'POST',
            token: guest.token,
        });
        const second = await api(`/api/rooms/${roomId}/request-join`, {
            method: 'POST',
            token: guest.token,
        });

        expect(first.status).toBe(200);
        expect(second.status).toBe(200);

        // And it must not have queued a duplicate.
        const { Room } = await import('../src/models/Room');
        const room = await Room.findById(roomId);
        const pending = room!.joinRequests!.filter((r) => r.status === 'pending');
        expect(pending).toHaveLength(1);
    });

    it('lets a rejected user ask again', async () => {
        // Rejection used to be permanent with no way for the host to relent.
        await api(`/api/rooms/${roomId}/request-join`, { method: 'POST', token: guest.token });
        await api(`/api/rooms/${roomId}/reject-request/${guest.userId}`, {
            method: 'POST',
            token: host.token,
        });

        const again = await api(`/api/rooms/${roomId}/request-join`, {
            method: 'POST',
            token: guest.token,
        });
        expect(again.status).toBe(200);
    });

    it('only lets the host decide', async () => {
        const other = await registerUser(api, 'Nosy');
        await api(`/api/rooms/${roomId}/request-join`, { method: 'POST', token: guest.token });

        const result = await api(
            `/api/rooms/${roomId}/approve-request/${guest.userId}`,
            { method: 'POST', token: other.token },
        );
        expect(result.status).toBe(403);
    });

    it('does not add a duplicate participant when approval races the socket join', async () => {
        // approveJoinRequest used push while the socket handler used $addToSet.
        await api(`/api/rooms/${roomId}/request-join`, { method: 'POST', token: guest.token });

        await Promise.all([
            api(`/api/rooms/${roomId}/approve-request/${guest.userId}`, {
                method: 'POST',
                token: host.token,
            }),
            api('/api/rooms/join', {
                method: 'POST',
                token: guest.token,
                body: { roomId },
            }),
        ]);

        const { Room } = await import('../src/models/Room');
        const room = await Room.findById(roomId);
        const appearances = room!.participants.filter((p) => p.toString() === guest.userId);
        expect(appearances).toHaveLength(1);
    });
});

describe('membership and capacity', () => {
    it('refuses a private room reached by id without prior admission', async () => {
        const host = await registerUser(api, 'Host');
        const guest = await registerUser(api, 'Guest');
        const movie = await seedMovie();
        const room = await createRoom(api, host.token, movie._id.toString(), {
            type: 'private',
            approvalRequired: false,
        });

        const result = await api('/api/rooms/join', {
            method: 'POST',
            token: guest.token,
            body: { roomId: room._id },
        });
        expect(result.status).toBe(403);
    });

    it('refuses a full room', async () => {
        const host = await registerUser(api, 'Host');
        const movie = await seedMovie();
        const room = await createRoom(api, host.token, movie._id.toString(), {
            maxParticipants: 2,
        });

        const first = await registerUser(api, 'First');
        await api('/api/rooms/join', {
            method: 'POST',
            token: first.token,
            body: { roomId: room._id },
        });

        const second = await registerUser(api, 'Second');
        const result = await api('/api/rooms/join', {
            method: 'POST',
            token: second.token,
            body: { roomId: room._id },
        });

        expect(result.status).toBe(400);
        expect(result.body.message).toMatch(/full/i);
    });

    it('refuses a finished room', async () => {
        const host = await registerUser(api, 'Host');
        const guest = await registerUser(api, 'Guest');
        const movie = await seedMovie();
        const room = await createRoom(api, host.token, movie._id.toString());

        await api(`/api/rooms/${room._id}/end`, { method: 'POST', token: host.token });

        const result = await api('/api/rooms/join', {
            method: 'POST',
            token: guest.token,
            body: { roomId: room._id },
        });
        expect(result.status).toBe(400);
    });

    it('lets the host end a room after someone has left', async () => {
        // Production 500. leave/disconnect write joinRequests[].status = 'left'
        // through updateOne, which skips validation. 'left' was missing from the
        // schema enum, so the next room.save() validated the whole document,
        // hit the unknown value and threw. In practice: once one person left,
        // the host could never end their own room again. start/approve/reject
        // use the same save() and failed identically.
        const host = await registerUser(api, 'Host');
        const guest = await registerUser(api, 'Guest');
        const movie = await seedMovie();
        const room = await createRoom(api, host.token, movie._id.toString(), {
            approvalRequired: true,
            type: 'private',
        });

        await api(`/api/rooms/${room._id}/request-join`, { method: 'POST', token: guest.token });
        await api(`/api/rooms/${room._id}/approve-request/${guest.userId}`, {
            method: 'POST',
            token: host.token,
        });
        await api(`/api/rooms/${room._id}/leave`, { method: 'POST', token: guest.token });

        // Precondition: the request really is parked in the 'left' state.
        const { Room } = await import('../src/models/Room');
        const stored = await Room.findById(room._id);
        expect(stored!.joinRequests!.some((r) => r.status === 'left')).toBe(true);

        const ended = await api(`/api/rooms/${room._id}/end`, {
            method: 'POST',
            token: host.token,
        });
        expect(ended.status).toBe(200);
    });

    it('lets the host start a room after someone has left', async () => {
        const host = await registerUser(api, 'Host');
        const guest = await registerUser(api, 'Guest');
        const movie = await seedMovie();
        const room = await createRoom(api, host.token, movie._id.toString());

        await api('/api/rooms/join', {
            method: 'POST',
            token: guest.token,
            body: { roomId: room._id },
        });
        await api(`/api/rooms/${room._id}/leave`, { method: 'POST', token: guest.token });

        const started = await api(`/api/rooms/${room._id}/start`, {
            method: 'POST',
            token: host.token,
        });
        expect(started.status).toBe(200);
    });

    it('will not let a lone host leave, since that ends the session anyway', async () => {
        const host = await registerUser(api, 'Host');
        const movie = await seedMovie();
        const room = await createRoom(api, host.token, movie._id.toString());

        const result = await api(`/api/rooms/${room._id}/leave`, {
            method: 'POST',
            token: host.token,
        });
        expect(result.status).toBe(400);
        expect(result.body.code).toBe('LAST_PERSON');
    });

    it('hands hosting to the only other person automatically', async () => {
        // With one candidate there is no decision to make, so the host is not
        // asked to make one.
        const host = await registerUser(api, 'Host');
        const guest = await registerUser(api, 'Guest');
        const movie = await seedMovie();
        const room = await createRoom(api, host.token, movie._id.toString());

        await api('/api/rooms/join', {
            method: 'POST',
            token: guest.token,
            body: { roomId: room._id },
        });

        const result = await api(`/api/rooms/${room._id}/leave`, {
            method: 'POST',
            token: host.token,
        });
        expect(result.status).toBe(200);

        const { Room } = await import('../src/models/Room');
        const stored = await Room.findById(room._id);
        expect(stored!.host.toString()).toBe(guest.userId);
        // And the departing host is no longer in the room.
        expect(stored!.participants.map(String)).not.toContain(host.userId);
    });

    it('asks who should take over when several people remain', async () => {
        const host = await registerUser(api, 'Host');
        const first = await registerUser(api, 'First');
        const second = await registerUser(api, 'Second');
        const movie = await seedMovie();
        const room = await createRoom(api, host.token, movie._id.toString());

        for (const person of [first, second]) {
            await api('/api/rooms/join', {
                method: 'POST',
                token: person.token,
                body: { roomId: room._id },
            });
        }

        const result = await api(`/api/rooms/${room._id}/leave`, {
            method: 'POST',
            token: host.token,
        });

        expect(result.status).toBe(400);
        expect(result.body.code).toBe('SUCCESSOR_REQUIRED');
        expect(result.body.data.candidates).toHaveLength(2);

        // The room must still have its original host until one is chosen.
        const { Room } = await import('../src/models/Room');
        expect((await Room.findById(room._id))!.host.toString()).toBe(host.userId);
    });

    it('transfers to the person the host names', async () => {
        const host = await registerUser(api, 'Host');
        const first = await registerUser(api, 'First');
        const second = await registerUser(api, 'Second');
        const movie = await seedMovie();
        const room = await createRoom(api, host.token, movie._id.toString());

        for (const person of [first, second]) {
            await api('/api/rooms/join', {
                method: 'POST',
                token: person.token,
                body: { roomId: room._id },
            });
        }

        const result = await api(`/api/rooms/${room._id}/leave`, {
            method: 'POST',
            token: host.token,
            body: { transferTo: second.userId },
        });
        expect(result.status).toBe(200);

        const { Room } = await import('../src/models/Room');
        expect((await Room.findById(room._id))!.host.toString()).toBe(second.userId);
    });

    it('refuses to hand the room to someone who is not in it', async () => {
        const host = await registerUser(api, 'Host');
        const guest = await registerUser(api, 'Guest');
        const outsider = await registerUser(api, 'Outsider');
        const movie = await seedMovie();
        const room = await createRoom(api, host.token, movie._id.toString());

        await api('/api/rooms/join', {
            method: 'POST',
            token: guest.token,
            body: { roomId: room._id },
        });

        const result = await api(`/api/rooms/${room._id}/leave`, {
            method: 'POST',
            token: host.token,
            body: { transferTo: outsider.userId },
        });

        // One candidate means auto-selection, so the named outsider is simply
        // ignored rather than accepted — the room stays with someone present.
        const { Room } = await import('../src/models/Room');
        const stored = await Room.findById(room._id);
        expect(stored!.host.toString()).not.toBe(outsider.userId);
        expect(result.status).toBe(200);
    });

    it('lets the new host end the room afterwards', async () => {
        // The point of handing over: the room stays usable.
        const host = await registerUser(api, 'Host');
        const guest = await registerUser(api, 'Guest');
        const movie = await seedMovie();
        const room = await createRoom(api, host.token, movie._id.toString());

        await api('/api/rooms/join', {
            method: 'POST',
            token: guest.token,
            body: { roomId: room._id },
        });
        await api(`/api/rooms/${room._id}/leave`, { method: 'POST', token: host.token });

        const ended = await api(`/api/rooms/${room._id}/end`, {
            method: 'POST',
            token: guest.token,
        });
        expect(ended.status).toBe(200);
    });
});

describe('watch statistics', () => {
    it('counts a movie once per user per room however often they rejoin', async () => {
        // Disconnect pulls a user from participants, so every refresh used to
        // re-run the increment and append another watch-history row.
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

        const { User } = await import('../src/models/User');
        const record = await User.findById(guest.userId);
        expect(record?.moviesWatched).toBe(1);
        expect(record?.watchHistory).toHaveLength(1);
    });

    it('does not count the host as having watched their own room', async () => {
        const host = await registerUser(api, 'Host');
        const movie = await seedMovie();
        const room = await createRoom(api, host.token, movie._id.toString());

        await api('/api/rooms/join', {
            method: 'POST',
            token: host.token,
            body: { roomId: room._id },
        });

        const { User } = await import('../src/models/User');
        const record = await User.findById(host.userId);
        expect(record?.moviesWatched ?? 0).toBe(0);
        expect(record?.sessionsHosted).toBe(1);
    });
});

describe('public room listing', () => {
    it('includes scheduled rooms, which used to be invisible', async () => {
        const host = await registerUser(api, 'Host');
        const movie = await seedMovie();

        const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        await createRoom(api, host.token, movie._id.toString(), {
            name: 'Later tonight',
            startTime: future,
        });

        const result = await api('/api/rooms', { token: host.token });
        const names = result.body.data.map((r: any) => r.name);
        expect(names).toContain('Later tonight');
    });

    it('excludes finished rooms', async () => {
        const host = await registerUser(api, 'Host');
        const movie = await seedMovie();
        const room = await createRoom(api, host.token, movie._id.toString(), {
            name: 'Already over',
        });
        await api(`/api/rooms/${room._id}/end`, { method: 'POST', token: host.token });

        const result = await api('/api/rooms', { token: host.token });
        const names = result.body.data.map((r: any) => r.name);
        expect(names).not.toContain('Already over');
    });

    it('excludes private rooms', async () => {
        const host = await registerUser(api, 'Host');
        const movie = await seedMovie();
        await createRoom(api, host.token, movie._id.toString(), {
            name: 'Invite only',
            type: 'private',
        });

        const result = await api('/api/rooms', { token: host.token });
        const names = result.body.data.map((r: any) => r.name);
        expect(names).not.toContain('Invite only');
    });
});

describe('authorisation', () => {
    it('rejects unauthenticated requests', async () => {
        expect((await api('/api/rooms')).status).toBe(401);
    });

    it('lets only the host start or end a room', async () => {
        const host = await registerUser(api, 'Host');
        const guest = await registerUser(api, 'Guest');
        const movie = await seedMovie();
        const room = await createRoom(api, host.token, movie._id.toString());

        await api('/api/rooms/join', {
            method: 'POST',
            token: guest.token,
            body: { roomId: room._id },
        });

        expect(
            (await api(`/api/rooms/${room._id}/start`, { method: 'POST', token: guest.token }))
                .status,
        ).toBe(403);
        expect(
            (await api(`/api/rooms/${room._id}/end`, { method: 'POST', token: guest.token }))
                .status,
        ).toBe(403);
        expect(
            (await api(`/api/rooms/${room._id}/start`, { method: 'POST', token: host.token }))
                .status,
        ).toBe(200);
    });
});

describe('movie catalog safety', () => {
    it('seeds without deleting what is already there', async () => {
        // POST /api/movies/seed called deleteMany({}) behind nothing but a valid
        // login, so any account could empty the catalog.
        const user = await registerUser(api);
        const existing = await seedMovie();

        await api('/api/movies/seed', { method: 'POST', token: user.token });

        const { Movie } = await import('../src/models/Movie');
        expect(await Movie.findById(existing._id)).not.toBeNull();
    });

    it('removes the dead sample-bucket entries', async () => {
        // The old seed pointed at commondatastorage.googleapis.com, which now
        // 403s, so every one of those titles was a broken play button.
        const user = await registerUser(api);
        const { Movie } = await import('../src/models/Movie');

        await Movie.create({
            title: 'Quantum Horizon',
            image: 'https://example.test/poster.jpg',
            duration: '2h 15m',
            rating: '8.5',
            genre: 'Sci-Fi',
            videoUrl:
                'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        });

        await api('/api/movies/seed', { method: 'POST', token: user.token });

        expect(await Movie.findOne({ title: 'Quantum Horizon' })).toBeNull();
    });

    it('leaves user-added films alone while clearing dead ones', async () => {
        const user = await registerUser(api);
        const { Movie } = await import('../src/models/Movie');
        const mine = await seedMovie();

        await api('/api/movies/seed', { method: 'POST', token: user.token });

        expect(await Movie.findById(mine._id)).not.toBeNull();
    });

    it('seeds real archive titles with playable urls', async () => {
        const user = await registerUser(api);
        await api('/api/movies/seed', { method: 'POST', token: user.token });

        const { Movie } = await import('../src/models/Movie');
        const seeded = await Movie.find({ source: 'archive' });

        expect(seeded.length).toBeGreaterThanOrEqual(6);
        seeded.forEach((movie) => {
            expect(movie.videoUrl).toContain('archive.org');
            expect(movie.archiveId).toBeTruthy();
        });
    });

    it('is idempotent across repeated runs', async () => {
        const user = await registerUser(api);

        await api('/api/movies/seed', { method: 'POST', token: user.token });
        const { Movie } = await import('../src/models/Movie');
        const afterFirst = await Movie.countDocuments();

        await api('/api/movies/seed', { method: 'POST', token: user.token });
        expect(await Movie.countDocuments()).toBe(afterFirst);
    });
});
