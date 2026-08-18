/**
 * End-to-end verification of the realtime layer against a running server.
 *
 * Drives two real users through the whole flow with two authenticated
 * Socket.io clients and asserts what actually arrives on the wire:
 *
 *   - a socket with no token, or a forged one, is refused
 *   - chat reaches every member of the room, sender included, with server order
 *   - playback events reach followers and carry the latency stamp
 *   - a non-host cannot drive playback
 *   - WebRTC offer/answer/ICE are relayed to the right peer
 *   - reactions are relayed and validated
 *   - a stranger cannot join a room they were never admitted to
 *   - join requests, approval, and the resulting room update all land
 *
 * Usage:  npx ts-node scripts/verify-realtime.ts
 */

import { writeSync } from 'fs';
import { io as connect, type Socket } from 'socket.io-client';

/** Unbuffered, so progress is visible even when stdout is redirected to a file. */
const say = (line: string) => writeSync(1, `${line}\n`);

const API = process.env.VERIFY_API_URL || 'http://localhost:5000';
const STAMP = Date.now();

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

function section(title: string) {
    say(`\n${title}`);
    say('-'.repeat(title.length));
}

async function api<T = any>(
    path: string,
    options: { method?: string; body?: unknown; token?: string } = {},
): Promise<{ status: number; body: any }> {
    const response = await fetch(`${API}${path}`, {
        method: options.method ?? 'GET',
        headers: {
            'Content-Type': 'application/json',
            ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const text = await response.text();
    let body: any = null;
    try {
        body = JSON.parse(text);
    } catch {
        body = text;
    }
    return { status: response.status, body };
}

/** Wait for one event, or resolve null after `ms`. */
function once<T = any>(socket: Socket, event: string, ms = 3000): Promise<T | null> {
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

/** Collect every occurrence of an event for `ms`. */
function collect<T = any>(socket: Socket, event: string, ms = 1200): Promise<T[]> {
    const seen: T[] = [];
    const handler = (payload: T) => seen.push(payload);
    socket.on(event, handler);
    return new Promise((resolve) =>
        setTimeout(() => {
            socket.off(event, handler);
            resolve(seen);
        }, ms),
    );
}

function connectSocket(token?: string): Promise<{ socket: Socket; error?: string }> {
    return new Promise((resolve) => {
        const socket = connect(API, {
            auth: token ? { token } : {},
            transports: ['websocket'],
            reconnection: false,
        });
        socket.on('connect', () => resolve({ socket }));
        socket.on('connect_error', (error) => resolve({ socket, error: error.message }));
    });
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
    say(`Verifying realtime layer at ${API}\n`);

    const health = await api('/api/health');
    if (health.status !== 200) {
        console.error(`Server not reachable at ${API}. Start the backend first.`);
        process.exit(1);
    }

    /* ------------------------------------------------------------------ */
    section('Setup: two users and a room');
    /* ------------------------------------------------------------------ */

    const hostCreds = { email: `host-${STAMP}@verify.test`, password: 'verify-password-1', fullName: 'Host User' };
    const guestCreds = { email: `guest-${STAMP}@verify.test`, password: 'verify-password-2', fullName: 'Guest User' };
    const strangerCreds = { email: `stranger-${STAMP}@verify.test`, password: 'verify-password-3', fullName: 'Stranger' };

    const host = (await api('/api/auth/register', { method: 'POST', body: hostCreds })).body?.data;
    const guest = (await api('/api/auth/register', { method: 'POST', body: guestCreds })).body?.data;
    const stranger = (await api('/api/auth/register', { method: 'POST', body: strangerCreds })).body?.data;

    check('three users registered', Boolean(host?.token && guest?.token && stranger?.token));
    if (!host?.token) process.exit(1);

    await api('/api/movies/seed', { method: 'POST', token: host.token });
    const movies = (await api('/api/movies')).body?.data ?? [];
    check('movie catalog is populated', movies.length > 0, `${movies.length} movies`);

    const created = await api('/api/rooms', {
        method: 'POST',
        token: host.token,
        body: {
            name: `Verify room ${STAMP}`,
            movieId: movies[0]?._id,
            type: 'public',
            theme: { primary: '#695CFF', secondary: '#8B7FFF', name: 'Purple Dream' },
            maxParticipants: 4,
            adminEnabled: true,
            approvalRequired: false,
        },
    });
    const room = created.body?.data;
    check('room created', Boolean(room?._id), created.body?.message);
    if (!room?._id) process.exit(1);

    const roomId = room._id;

    /* ------------------------------------------------------------------ */
    section('Socket authentication');
    /* ------------------------------------------------------------------ */

    const anonymous = await connectSocket();
    check('connection without a token is refused', Boolean(anonymous.error), anonymous.error);
    anonymous.socket.close();

    const forged = await connectSocket('not.a.real.token');
    check('connection with a forged token is refused', Boolean(forged.error), forged.error);
    forged.socket.close();

    const hostConn = await connectSocket(host.token);
    const guestConn = await connectSocket(guest.token);
    check('valid tokens connect', !hostConn.error && !guestConn.error);

    const hostSocket = hostConn.socket;
    const guestSocket = guestConn.socket;

    /* ------------------------------------------------------------------ */
    section('Room membership');
    /* ------------------------------------------------------------------ */

    const strangerConn = await connectSocket(stranger.token);
    const strangerJoin = await new Promise<any>((resolve) =>
        strangerConn.socket.emit('join-room', roomId, resolve),
    );
    check(
        'a non-member cannot join the room channel',
        strangerJoin?.ok === false,
        JSON.stringify(strangerJoin),
    );
    strangerConn.socket.close();

    const hostJoin = await new Promise<any>((resolve) =>
        hostSocket.emit('join-room', roomId, resolve),
    );
    check('host joins its own room', hostJoin?.ok === true, JSON.stringify(hostJoin));

    // The guest must be admitted over HTTP before the socket will let them in.
    const guestJoinHttp = await api('/api/rooms/join', {
        method: 'POST',
        token: guest.token,
        body: { roomId },
    });
    check('guest admitted over HTTP', guestJoinHttp.body?.success === true);

    const roomUpdatePromise = once(hostSocket, 'room-updated');
    const peerPromise = once(hostSocket, 'user-connected');
    const guestJoin = await new Promise<any>((resolve) =>
        guestSocket.emit('join-room', roomId, resolve),
    );
    check('guest joins the room channel', guestJoin?.ok === true, JSON.stringify(guestJoin));

    const roomUpdate = await roomUpdatePromise;
    check(
        'host receives room-updated with both participants',
        roomUpdate?.participantCount === 2,
        `count=${roomUpdate?.participantCount}`,
    );

    const peer = await peerPromise;
    check(
        'host is told a peer connected, with a socket id for WebRTC',
        Boolean(peer?.socketId && peer?.userId),
        JSON.stringify(peer),
    );

    /* ------------------------------------------------------------------ */
    section('Chat');
    /* ------------------------------------------------------------------ */

    const hostChat = collect(hostSocket, 'chat-message', 1500);
    const guestChat = collect(guestSocket, 'chat-message', 1500);

    hostSocket.emit('chat-message', { roomId, text: 'Message from the host' });
    await wait(250);
    guestSocket.emit('chat-message', { roomId, text: 'Reply from the guest' });

    const [hostSaw, guestSaw] = await Promise.all([hostChat, guestChat]);

    check('host sees both messages', hostSaw.length === 2, `saw ${hostSaw.length}`);
    check('guest sees both messages', guestSaw.length === 2, `saw ${guestSaw.length}`);
    check(
        'the sender receives their own message back (server is the ordering authority)',
        hostSaw.some((m: any) => m.text === 'Message from the host'),
    );
    check(
        'both users see the same order',
        JSON.stringify(hostSaw.map((m: any) => m.text)) ===
            JSON.stringify(guestSaw.map((m: any) => m.text)),
        `${hostSaw.map((m: any) => m.text)} vs ${guestSaw.map((m: any) => m.text)}`,
    );
    check(
        'messages carry a resolved display name',
        hostSaw.every((m: any) => Boolean(m.userName)),
    );

    const overlong = collect(guestSocket, 'chat-message', 800);
    hostSocket.emit('chat-message', { roomId, text: 'x'.repeat(2000) });
    check('an over-length message is rejected', (await overlong).length === 0);

    const history = await api(`/api/rooms/${roomId}/messages`, { token: guest.token });
    check(
        'chat history persists and is readable by a member',
        Array.isArray(history.body?.data) && history.body.data.length === 2,
        `${history.body?.data?.length} stored`,
    );

    const strangerHistory = await api(`/api/rooms/${roomId}/messages`, { token: stranger.token });
    check('chat history is hidden from non-members', strangerHistory.status === 403);

    /* ------------------------------------------------------------------ */
    section('Playback synchronisation');
    /* ------------------------------------------------------------------ */

    const guestPlay = once(guestSocket, 'video-play');
    hostSocket.emit('video-play', { roomId, currentTime: 42.5 });
    const play = await guestPlay;
    check('host play reaches the guest', play?.currentTime === 42.5, JSON.stringify(play));
    check(
        'playback events carry emittedAt for latency compensation',
        typeof play?.emittedAt === 'number' && play.emittedAt > 0,
    );

    const guestSeek = once(guestSocket, 'video-seek');
    hostSocket.emit('video-seek', { roomId, currentTime: 900 });
    const seek = await guestSeek;
    check('host seek reaches the guest', seek?.currentTime === 900);

    const guestPause = once(guestSocket, 'video-pause');
    hostSocket.emit('video-pause', { roomId, currentTime: 901 });
    check('host pause reaches the guest', (await guestPause)?.currentTime === 901);

    // The guest is not the host and adminEnabled is true, so this must be refused.
    const hostShouldNotSee = collect(hostSocket, 'video-play', 900);
    const guestError = once(guestSocket, 'server-error', 900);
    guestSocket.emit('video-play', { roomId, currentTime: 7 });

    check('a non-host cannot drive playback', (await hostShouldNotSee).length === 0);
    check(
        'the non-host is told why',
        Boolean((await guestError)?.message),
        (await guestError)?.message,
    );

    const syncRequest = once(hostSocket, 'video-sync-request');
    guestSocket.emit('video-sync-request', { roomId });
    const request = await syncRequest;
    check(
        'a late joiner can ask the host for the current position',
        Boolean(request?.requesterSocketId),
    );

    if (request?.requesterSocketId) {
        const syncResponse = once(guestSocket, 'video-sync-response');
        hostSocket.emit('video-sync-response', {
            roomId,
            targetSocketId: request.requesterSocketId,
            currentTime: 123.4,
        });
        const response = await syncResponse;
        check('the host answer reaches that joiner only', response?.currentTime === 123.4);
    }

    /* ------------------------------------------------------------------ */
    section('WebRTC signalling (video and voice)');
    /* ------------------------------------------------------------------ */

    const guestOffer = once(guestSocket, 'offer');
    hostSocket.emit('offer', {
        targetSocketId: guestSocket.id,
        sdp: { type: 'offer', sdp: 'v=0 fake-offer' },
    });
    const offer = await guestOffer;
    check('offer is relayed to the target peer', offer?.sdp?.sdp === 'v=0 fake-offer');
    check(
        'offer carries senderSocketId so the peer can answer',
        offer?.senderSocketId === hostSocket.id,
    );

    const hostAnswer = once(hostSocket, 'answer');
    guestSocket.emit('answer', {
        targetSocketId: hostSocket.id,
        sdp: { type: 'answer', sdp: 'v=0 fake-answer' },
    });
    const answer = await hostAnswer;
    check('answer is relayed back', answer?.sdp?.sdp === 'v=0 fake-answer');
    check('answer carries senderSocketId', answer?.senderSocketId === guestSocket.id);

    const guestCandidate = once(guestSocket, 'ice-candidate');
    hostSocket.emit('ice-candidate', {
        targetSocketId: guestSocket.id,
        candidate: { candidate: 'candidate:1 1 udp 2130706431 10.0.0.1 54321 typ host' },
    });
    const candidate = await guestCandidate;
    check('ICE candidate is relayed', Boolean(candidate?.candidate));
    check('ICE candidate carries senderSocketId', candidate?.senderSocketId === hostSocket.id);

    /* ------------------------------------------------------------------ */
    section('Reactions');
    /* ------------------------------------------------------------------ */

    const guestReaction = once(guestSocket, 'reaction');
    hostSocket.emit('reaction', { roomId, emoji: '🍿' });
    check('an allowed reaction is relayed', (await guestReaction)?.emoji === '🍿');

    const blockedReaction = collect(guestSocket, 'reaction', 800);
    hostSocket.emit('reaction', { roomId, emoji: '<script>alert(1)</script>' });
    check('an arbitrary payload is rejected', (await blockedReaction).length === 0);

    /* ------------------------------------------------------------------ */
    section('Join approval flow');
    /* ------------------------------------------------------------------ */

    const privateRoom = (
        await api('/api/rooms', {
            method: 'POST',
            token: host.token,
            body: {
                name: `Private verify ${STAMP}`,
                movieId: movies[0]?._id,
                type: 'private',
                theme: { primary: '#695CFF', secondary: '#8B7FFF', name: 'Purple Dream' },
                maxParticipants: 4,
                adminEnabled: true,
                approvalRequired: true,
            },
        })
    ).body?.data;

    check('private room created with a code', Boolean(privateRoom?.code), privateRoom?.code);

    const gate = await api('/api/rooms/join', {
        method: 'POST',
        token: stranger.token,
        body: { code: privateRoom?.code },
    });
    check(
        'joining an approval-gated room returns requiresApproval instead of admitting',
        gate.body?.requiresApproval === true,
    );

    const strangerConn2 = await connectSocket(stranger.token);
    const hostNotified = once(hostSocket, 'join-request-received', 4000);
    const approvalArrived = once(strangerConn2.socket, 'join-request-approved', 6000);

    await api(`/api/rooms/${privateRoom._id}/request-join`, {
        method: 'POST',
        token: stranger.token,
    });

    const notification = await hostNotified;
    check(
        'the host is notified of the request on their own channel',
        Boolean(notification?.user?._id),
        JSON.stringify(notification),
    );

    await api(`/api/rooms/${privateRoom._id}/approve-request/${stranger.userId}`, {
        method: 'POST',
        token: host.token,
    });

    const approval = await approvalArrived;
    check(
        'the requester receives the approval (previously sent to a channel they were not in)',
        Boolean(approval?.room),
        JSON.stringify(approval)?.slice(0, 120),
    );

    strangerConn2.socket.close();

    /* ------------------------------------------------------------------ */
    section('Departure');
    /* ------------------------------------------------------------------ */

    const departure = once(hostSocket, 'room-updated', 4000);
    guestSocket.emit('leave-room', roomId);
    const afterLeave = await departure;
    check(
        'the room updates when a participant leaves',
        afterLeave?.participantCount === 1,
        `count=${afterLeave?.participantCount}`,
    );

    hostSocket.close();
    guestSocket.close();

    /* ------------------------------------------------------------------ */
    say(`\n${'='.repeat(46)}`);
    say(`  ${passed} passed, ${failed} failed`);
    say('='.repeat(46));
    process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
    console.error('\nVerification crashed:', error);
    process.exit(1);
});
