/**
 * Checks that WebRTC signalling carries the sender's identity, not just their
 * socket id.
 *
 * The receiving client has to attach an incoming media stream to a participant
 * in the room. A socket id identifies the connection; it says nothing about who
 * is on the other end. Without `senderUserId` the receiver had no way to make
 * that match and rendered every remote peer as "camera off" — while the
 * initiating side, which already knew the id from `user-connected`, looked fine.
 * That asymmetry is why it presented as "their camera is off but mine is on".
 *
 * Usage:  npx ts-node --transpile-only scripts/verify-peer-identity.ts
 */

import { writeSync } from 'fs';
import { io as connect, type Socket } from 'socket.io-client';

const API = process.env.VERIFY_API_URL || 'http://localhost:5000';
const STAMP = Date.now();

const say = (line: string) => writeSync(1, `${line}\n`);

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail = '') {
    if (ok) {
        passed++;
        say(`  PASS  ${label}`);
    } else {
        failed++;
        say(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
    }
}

async function api(path: string, options: { method?: string; body?: unknown; token?: string } = {}) {
    const response = await fetch(`${API}${path}`, {
        method: options.method ?? 'GET',
        headers: {
            'Content-Type': 'application/json',
            ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const text = await response.text();
    try {
        return { status: response.status, body: JSON.parse(text) };
    } catch {
        return { status: response.status, body: text as any };
    }
}

function openSocket(token: string): Promise<Socket> {
    return new Promise((resolve, reject) => {
        const socket = connect(API, { auth: { token }, transports: ['websocket'], reconnection: false });
        socket.on('connect', () => resolve(socket));
        socket.on('connect_error', reject);
    });
}

function waitFor<T = any>(socket: Socket, event: string, ms = 4000): Promise<T | null> {
    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            socket.off(event, handler);
            resolve(null);
        }, ms);
        const handler = (payload: T) => {
            clearTimeout(timer);
            socket.off(event, handler);
            resolve(payload);
        };
        socket.on(event, handler);
    });
}

function emitWithAck(socket: Socket, event: string, payload: unknown): Promise<any> {
    return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(null), 5000);
        socket.emit(event, payload, (result: any) => {
            clearTimeout(timer);
            resolve(result);
        });
    });
}

async function main() {
    say(`Verifying peer identity at ${API}\n`);

    const host = (
        await api('/api/auth/register', {
            method: 'POST',
            body: {
                email: `peer-host-${STAMP}@test.local`,
                password: 'peer-password-1',
                fullName: 'Peer Host',
            },
        })
    ).body?.data;

    const guest = (
        await api('/api/auth/register', {
            method: 'POST',
            body: {
                email: `peer-guest-${STAMP}@test.local`,
                password: 'peer-password-2',
                fullName: 'Peer Guest',
            },
        })
    ).body?.data;

    await api('/api/movies/seed', { method: 'POST', token: host.token });
    const movies = (await api('/api/movies')).body?.data ?? [];

    const room = (
        await api('/api/rooms', {
            method: 'POST',
            token: host.token,
            body: {
                name: `Peer identity ${STAMP}`,
                movieId: movies[0]?._id,
                type: 'public',
                theme: { primary: '#E39A2E', secondary: '#F5C77A', name: 'Projector' },
                maxParticipants: 4,
                adminEnabled: true,
                approvalRequired: false,
            },
        })
    ).body?.data;

    const hostSocket = await openSocket(host.token);
    await emitWithAck(hostSocket, 'join-room', room._id);

    await api('/api/rooms/join', { method: 'POST', token: guest.token, body: { roomId: room._id } });
    const guestSocket = await openSocket(guest.token);

    const peerAnnounce = waitFor(hostSocket, 'user-connected');
    await emitWithAck(guestSocket, 'join-room', room._id);
    const announced = await peerAnnounce;

    say('WebRTC signalling identity');
    say('-------------------------');

    check(
        'user-connected carries the arriving user id',
        announced?.userId === guest.userId,
        JSON.stringify(announced),
    );

    // Host offers to the guest, exactly as the app does.
    const guestGotOffer = waitFor(guestSocket, 'offer');
    hostSocket.emit('offer', {
        targetSocketId: announced.socketId,
        sdp: { type: 'offer', sdp: 'v=0 identity-test' },
    });
    const offer = await guestGotOffer;

    check('offer reaches the peer', offer?.sdp?.sdp === 'v=0 identity-test');
    check(
        'offer identifies the sender by user id, not just socket id',
        offer?.senderUserId === host.userId,
        `senderUserId=${offer?.senderUserId} expected=${host.userId}`,
    );

    const hostGotAnswer = waitFor(hostSocket, 'answer');
    guestSocket.emit('answer', {
        targetSocketId: offer.senderSocketId,
        sdp: { type: 'answer', sdp: 'v=0 identity-answer' },
    });
    const answer = await hostGotAnswer;

    check(
        'answer identifies the sender by user id',
        answer?.senderUserId === guest.userId,
        `senderUserId=${answer?.senderUserId}`,
    );

    const guestGotCandidate = waitFor(guestSocket, 'ice-candidate');
    hostSocket.emit('ice-candidate', {
        targetSocketId: announced.socketId,
        candidate: { candidate: 'candidate:1 1 udp 2130706431 10.0.0.1 54321 typ host' },
    });
    const candidate = await guestGotCandidate;

    check(
        'ice-candidate identifies the sender by user id',
        candidate?.senderUserId === host.userId,
        `senderUserId=${candidate?.senderUserId}`,
    );

    say('');
    say('Peer discovery after joining');
    say('----------------------------');

    // The watch screen mounts long after the layout joined the socket room, so
    // the one-shot existing-participants has already been and gone. This is the
    // path that has to work, and it is the one that was missing entirely.
    const hostSees = await new Promise<any>((resolve) => {
        const timer = setTimeout(() => resolve(null), 4000);
        hostSocket.emit('list-peers', room._id, (peers: any) => {
            clearTimeout(timer);
            resolve(peers);
        });
    });

    check(
        'a client can ask who is in the room after it has already joined',
        Array.isArray(hostSees) && hostSees.length === 1,
        JSON.stringify(hostSees),
    );
    check(
        'the answer carries both socket id and user id',
        Boolean(hostSees?.[0]?.socketId && hostSees?.[0]?.userId === guest.userId),
        JSON.stringify(hostSees?.[0]),
    );

    const guestSees = await new Promise<any>((resolve) => {
        const timer = setTimeout(() => resolve(null), 4000);
        guestSocket.emit('list-peers', room._id, (peers: any) => {
            clearTimeout(timer);
            resolve(peers);
        });
    });

    check(
        'each side sees the other, and not itself',
        guestSees?.length === 1 && guestSees[0].userId === host.userId,
        JSON.stringify(guestSees),
    );

    // Exactly one of the pair must open the negotiation, or the offers cross.
    const hostInitiates = hostSocket.id! > guestSocket.id!;
    const guestInitiates = guestSocket.id! > hostSocket.id!;
    check(
        'the socket-id rule picks exactly one initiator',
        hostInitiates !== guestInitiates,
        `host=${hostInitiates} guest=${guestInitiates}`,
    );

    say('');
    say('Readiness handshake');
    say('-------------------');

    // The offer must wait for the peer to say it can answer. Announcing on
    // join-room raced the watch screen mounting, and the offer was lost.
    const hostSawReady = waitFor(hostSocket, 'peer-ready', 4000);
    guestSocket.emit('peer-ready', room._id);
    const ready = await hostSawReady;

    check(
        'peer-ready reaches the other side of the room',
        Boolean(ready),
        JSON.stringify(ready),
    );
    check(
        'it identifies who is ready, by socket and user',
        ready?.socketId === guestSocket.id && ready?.userId === guest.userId,
        JSON.stringify(ready),
    );

    // It must not echo back to the announcer, or a client would try to offer
    // to itself.
    const echoed = await new Promise<any>((resolve) => {
        const timer = setTimeout(() => resolve(null), 1200);
        guestSocket.once('peer-ready', (p: any) => {
            clearTimeout(timer);
            resolve(p);
        });
        guestSocket.emit('peer-ready', room._id);
    });
    check('it does not echo back to the sender', echoed === null, JSON.stringify(echoed));

    say('');
    say('Late-joiner playback');
    say('--------------------');

    const hostGotRequest = waitFor(hostSocket, 'video-sync-request');
    guestSocket.emit('video-sync-request', { roomId: room._id });
    const request = await hostGotRequest;

    check('a late joiner can ask where playback is', Boolean(request?.requesterSocketId));

    const guestGotResponse = waitFor(guestSocket, 'video-sync-response');
    hostSocket.emit('video-sync-response', {
        roomId: room._id,
        targetSocketId: request.requesterSocketId,
        currentTime: 512,
        paused: false,
    });
    const response = await guestGotResponse;

    check('the answer carries the position', response?.currentTime === 512);
    check(
        'the answer says whether the film is actually running',
        response?.paused === false,
        `paused=${response?.paused}`,
    );

    hostSocket.close();
    guestSocket.close();

    say('');
    say('='.repeat(46));
    say(`  ${passed} passed, ${failed} failed`);
    say('='.repeat(46));
    process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
    say(`\nCrashed: ${error}`);
    process.exit(1);
});
