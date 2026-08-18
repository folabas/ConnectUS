/**
 * Socket authorisation and realtime behaviour.
 *
 * Every case here corresponds to something that was actually broken:
 * unauthenticated sockets, membership not being checked, handlers registered
 * after an await so early emits were dropped, and playback control that any
 * participant could exercise.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Socket } from 'socket.io-client';
import {
    apiClient,
    collect,
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

function track(socket: Socket) {
    openSockets.push(socket);
    return socket;
}

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

describe('handshake authentication', () => {
    it('refuses a connection with no token', async () => {
        const { socket, error } = await openSocket(server.baseUrl);
        track(socket);
        expect(error).toBeTruthy();
    });

    it('refuses a forged token', async () => {
        const { socket, error } = await openSocket(server.baseUrl, 'not.a.jwt');
        track(socket);
        expect(error).toBeTruthy();
    });

    it('refuses a well-formed token for a deleted account', async () => {
        const user = await registerUser(api);
        const { User } = await import('../src/models/User');
        await User.deleteOne({ _id: user.userId });

        const { socket, error } = await openSocket(server.baseUrl, user.token);
        track(socket);
        expect(error).toBeTruthy();
    });

    it('accepts a valid token', async () => {
        const user = await registerUser(api);
        const { socket, error } = await openSocket(server.baseUrl, user.token);
        track(socket);
        expect(error).toBeUndefined();
        expect(socket.connected).toBe(true);
    });
});

describe('joining a room channel', () => {
    let host: TestUser;
    let stranger: TestUser;
    let roomId: string;

    beforeEach(async () => {
        host = await registerUser(api, 'Host');
        stranger = await registerUser(api, 'Stranger');
        const movie = await seedMovie();
        const room = await createRoom(api, host.token, movie._id.toString());
        roomId = room._id;
    });

    it('acknowledges immediately after connecting', async () => {
        // Regression: handlers were registered after `await markOnline()`, so a
        // client emitting join-room the instant it connected — which is what the
        // app does — found no listener attached and waited forever.
        const { socket } = await openSocket(server.baseUrl, host.token);
        track(socket);

        const ack = await emitWithAck(socket, 'join-room', roomId, 4000);
        expect(ack).not.toBeNull();
        expect(ack).toMatchObject({ ok: true });
    });

    it('refuses a user who was never admitted', async () => {
        const { socket } = await openSocket(server.baseUrl, stranger.token);
        track(socket);

        const ack = await emitWithAck(socket, 'join-room', roomId);
        expect(ack).toMatchObject({ ok: false });
    });

    it('refuses an unknown room id without crashing', async () => {
        const { socket } = await openSocket(server.baseUrl, host.token);
        track(socket);

        const ack = await emitWithAck(socket, 'join-room', 'not-an-object-id');
        expect(ack).toMatchObject({ ok: false });
        expect(socket.connected).toBe(true);
    });

    it('admits a user who joined over HTTP first, and tells the room', async () => {
        const guest = await registerUser(api, 'Guest');
        const { socket: hostSocket } = await openSocket(server.baseUrl, host.token);
        track(hostSocket);
        await emitWithAck(hostSocket, 'join-room', roomId);

        await api('/api/rooms/join', { method: 'POST', token: guest.token, body: { roomId } });

        const updated = waitFor(hostSocket, 'room-updated');
        const peer = waitFor(hostSocket, 'user-connected');

        const { socket: guestSocket } = await openSocket(server.baseUrl, guest.token);
        track(guestSocket);
        const ack = await emitWithAck(guestSocket, 'join-room', roomId);

        expect(ack).toMatchObject({ ok: true });
        expect((await updated)?.participantCount).toBe(2);
        // The socket id is what WebRTC negotiation is addressed to.
        expect(await peer).toMatchObject({ socketId: expect.any(String) });
    });
});

describe('chat', () => {
    let host: TestUser;
    let guest: TestUser;
    let roomId: string;
    let hostSocket: Socket;
    let guestSocket: Socket;

    beforeEach(async () => {
        host = await registerUser(api, 'Host');
        guest = await registerUser(api, 'Guest');
        const movie = await seedMovie();
        roomId = (await createRoom(api, host.token, movie._id.toString()))._id;

        hostSocket = track((await openSocket(server.baseUrl, host.token)).socket);
        await emitWithAck(hostSocket, 'join-room', roomId);

        await api('/api/rooms/join', { method: 'POST', token: guest.token, body: { roomId } });
        guestSocket = track((await openSocket(server.baseUrl, guest.token)).socket);
        await emitWithAck(guestSocket, 'join-room', roomId);
    });

    it('delivers to every member including the sender', async () => {
        // The server is the ordering authority, so the sender gets its own
        // message back rather than rendering an optimistic copy.
        const seen = collect(hostSocket, 'chat-message', 900);
        hostSocket.emit('chat-message', { roomId, text: 'hello room' });

        const messages = await seen;
        expect(messages).toHaveLength(1);
        expect(messages[0]).toMatchObject({ text: 'hello room', userId: host.userId });
        expect(messages[0].userName).toBeTruthy();
    });

    it('gives both users the same order', async () => {
        const hostSaw = collect(hostSocket, 'chat-message', 1200);
        const guestSaw = collect(guestSocket, 'chat-message', 1200);

        hostSocket.emit('chat-message', { roomId, text: 'first' });
        await new Promise((r) => setTimeout(r, 200));
        guestSocket.emit('chat-message', { roomId, text: 'second' });

        const [a, b] = await Promise.all([hostSaw, guestSaw]);
        expect(a.map((m) => m.text)).toEqual(['first', 'second']);
        expect(b.map((m) => m.text)).toEqual(['first', 'second']);
    });

    it('rejects an over-length message', async () => {
        const seen = collect(guestSocket, 'chat-message', 700);
        hostSocket.emit('chat-message', { roomId, text: 'x'.repeat(2000) });
        expect(await seen).toHaveLength(0);
    });

    it('ignores a message addressed to a room the sender is not in', async () => {
        const outsider = await registerUser(api, 'Outsider');
        const outsiderSocket = track((await openSocket(server.baseUrl, outsider.token)).socket);

        const seen = collect(hostSocket, 'chat-message', 700);
        outsiderSocket.emit('chat-message', { roomId, text: 'let me in' });
        expect(await seen).toHaveLength(0);
    });

    it('persists history for members and hides it from everyone else', async () => {
        hostSocket.emit('chat-message', { roomId, text: 'stored message' });
        await new Promise((r) => setTimeout(r, 400));

        const asMember = await api(`/api/rooms/${roomId}/messages`, { token: guest.token });
        expect(asMember.status).toBe(200);
        expect(asMember.body.data).toHaveLength(1);
        expect(asMember.body.data[0]).toMatchObject({ text: 'stored message' });

        const outsider = await registerUser(api, 'Outsider');
        const asOutsider = await api(`/api/rooms/${roomId}/messages`, { token: outsider.token });
        expect(asOutsider.status).toBe(403);
    });
});

describe('playback authority', () => {
    let host: TestUser;
    let guest: TestUser;
    let hostSocket: Socket;
    let guestSocket: Socket;

    async function setUpRoom(adminEnabled: boolean) {
        const movie = await seedMovie();
        const room = await createRoom(api, host.token, movie._id.toString(), { adminEnabled });

        hostSocket = track((await openSocket(server.baseUrl, host.token)).socket);
        await emitWithAck(hostSocket, 'join-room', room._id);

        await api('/api/rooms/join', {
            method: 'POST',
            token: guest.token,
            body: { roomId: room._id },
        });
        guestSocket = track((await openSocket(server.baseUrl, guest.token)).socket);
        await emitWithAck(guestSocket, 'join-room', room._id);

        return room._id as string;
    }

    beforeEach(async () => {
        host = await registerUser(api, 'Host');
        guest = await registerUser(api, 'Guest');
    });

    it('relays host play to followers with a latency stamp', async () => {
        const roomId = await setUpRoom(true);

        const received = waitFor(guestSocket, 'video-play');
        hostSocket.emit('video-play', { roomId, currentTime: 42.5 });

        const payload = await received;
        expect(payload).toMatchObject({ currentTime: 42.5 });
        // Followers add the message's flight time before seeking.
        expect(typeof payload?.emittedAt).toBe('number');
    });

    it('relays seek and pause', async () => {
        const roomId = await setUpRoom(true);

        const seek = waitFor(guestSocket, 'video-seek');
        hostSocket.emit('video-seek', { roomId, currentTime: 900 });
        expect((await seek)?.currentTime).toBe(900);

        const pause = waitFor(guestSocket, 'video-pause');
        hostSocket.emit('video-pause', { roomId, currentTime: 901 });
        expect((await pause)?.currentTime).toBe(901);
    });

    it('refuses a non-host while host control is on, and says why', async () => {
        const roomId = await setUpRoom(true);

        const hostShouldNotSee = collect(hostSocket, 'video-play', 700);
        const complaint = waitFor(guestSocket, 'server-error', 700);
        guestSocket.emit('video-play', { roomId, currentTime: 7 });

        expect(await hostShouldNotSee).toHaveLength(0);
        expect((await complaint)?.message).toMatch(/host/i);
    });

    it('lets anyone drive when host control is off', async () => {
        const roomId = await setUpRoom(false);

        const received = waitFor(hostSocket, 'video-play');
        guestSocket.emit('video-play', { roomId, currentTime: 12 });
        expect((await received)?.currentTime).toBe(12);
    });

    it('answers a late joiner asking where playback is', async () => {
        const roomId = await setUpRoom(true);

        const request = waitFor(hostSocket, 'video-sync-request');
        guestSocket.emit('video-sync-request', { roomId });
        const asked = await request;
        expect(asked?.requesterSocketId).toBeTruthy();

        const answer = waitFor(guestSocket, 'video-sync-response');
        hostSocket.emit('video-sync-response', {
            roomId,
            targetSocketId: asked!.requesterSocketId,
            currentTime: 123.4,
        });
        expect((await answer)?.currentTime).toBe(123.4);
    });
});

describe('WebRTC signalling', () => {
    it('relays offer, answer and candidate with the sender socket id', async () => {
        const host = await registerUser(api, 'Host');
        const guest = await registerUser(api, 'Guest');
        const movie = await seedMovie();
        const room = await createRoom(api, host.token, movie._id.toString());

        const hostSocket = track((await openSocket(server.baseUrl, host.token)).socket);
        await emitWithAck(hostSocket, 'join-room', room._id);

        await api('/api/rooms/join', {
            method: 'POST',
            token: guest.token,
            body: { roomId: room._id },
        });
        const guestSocket = track((await openSocket(server.baseUrl, guest.token)).socket);
        await emitWithAck(guestSocket, 'join-room', room._id);

        const offer = waitFor(guestSocket, 'offer');
        hostSocket.emit('offer', {
            targetSocketId: guestSocket.id,
            sdp: { type: 'offer', sdp: 'v=0 test-offer' },
        });
        const gotOffer = await offer;
        expect(gotOffer?.sdp?.sdp).toBe('v=0 test-offer');
        // Without this the peer has no address to answer to.
        expect(gotOffer?.senderSocketId).toBe(hostSocket.id);

        const answer = waitFor(hostSocket, 'answer');
        guestSocket.emit('answer', {
            targetSocketId: hostSocket.id,
            sdp: { type: 'answer', sdp: 'v=0 test-answer' },
        });
        expect((await answer)?.senderSocketId).toBe(guestSocket.id);

        const candidate = waitFor(guestSocket, 'ice-candidate');
        hostSocket.emit('ice-candidate', {
            targetSocketId: guestSocket.id,
            candidate: { candidate: 'candidate:1 1 udp 2130706431 10.0.0.1 54321 typ host' },
        });
        expect((await candidate)?.senderSocketId).toBe(hostSocket.id);
    });
});

describe('reactions', () => {
    it('relays an allowed emoji and drops anything else', async () => {
        const host = await registerUser(api, 'Host');
        const guest = await registerUser(api, 'Guest');
        const movie = await seedMovie();
        const room = await createRoom(api, host.token, movie._id.toString());

        const hostSocket = track((await openSocket(server.baseUrl, host.token)).socket);
        await emitWithAck(hostSocket, 'join-room', room._id);

        await api('/api/rooms/join', {
            method: 'POST',
            token: guest.token,
            body: { roomId: room._id },
        });
        const guestSocket = track((await openSocket(server.baseUrl, guest.token)).socket);
        await emitWithAck(guestSocket, 'join-room', room._id);

        const allowed = waitFor(guestSocket, 'reaction');
        hostSocket.emit('reaction', { roomId: room._id, emoji: '🍿' });
        expect((await allowed)?.emoji).toBe('🍿');

        const blocked = collect(guestSocket, 'reaction', 700);
        hostSocket.emit('reaction', { roomId: room._id, emoji: '<script>alert(1)</script>' });
        expect(await blocked).toHaveLength(0);
    });
});
