/**
 * Socket.io handlers.
 *
 * Extracted from server.ts, and — the substantive change — authenticated.
 * Previously every handler trusted a `userId` the client supplied in the emit
 * payload, so any connected socket could:
 *   - join any room by id, including private rooms it had never been admitted to
 *   - post chat as any user
 *   - mark an arbitrary user online
 *
 * Identity now comes from the JWT presented in the handshake, and room
 * membership is checked against the database before a socket is allowed into a
 * room channel.
 */

import type { Server, Socket } from 'socket.io';
import mongoose from 'mongoose';
import { verifyToken } from '../utils/jwt';
import { User } from '../models/User';
import { Friend } from '../models/Friend';
import { Room } from '../models/Room';
import { Message, MAX_CHAT_LENGTH } from '../models/Message';

/** Reactions clients may send. Anything else is dropped. */
const ALLOWED_REACTIONS = new Set(['❤️', '😂', '😮', '😢', '🔥', '👏', '🍿', '👍']);

/** Populate shape used everywhere a room is broadcast. */
const ROOM_POPULATE = [
    { path: 'participants', select: '_id fullName avatarUrl' },
    { path: 'host', select: '_id fullName avatarUrl' },
    { path: 'movie' },
] as const;

interface SocketData {
    userId: string;
    email: string;
    currentRoom?: string;
    /** Cached host check per room, so a seek does not hit the database. */
    controlsPlayback?: boolean;
}

type AppSocket = Socket & { data: SocketData };

/** userId -> set of socket ids (one user may have several tabs open). */
const userSockets = new Map<string, Set<string>>();

function trackSocket(userId: string, socketId: string) {
    const existing = userSockets.get(userId);
    if (existing) existing.add(socketId);
    else userSockets.set(userId, new Set([socketId]));
}

/** Returns true when this was the user's last open socket. */
function untrackSocket(userId: string, socketId: string): boolean {
    const existing = userSockets.get(userId);
    if (!existing) return true;
    existing.delete(socketId);
    if (existing.size === 0) {
        userSockets.delete(userId);
        return true;
    }
    return false;
}

/**
 * Every user has a private channel named after their id. It is how the server
 * reaches someone who is *not* in a room channel — notably a person waiting for
 * their join request to be approved. The previous code emitted approval results
 * to the room, which by definition the requester had not joined, so approvals
 * and rejections never arrived.
 */
export function userChannel(userId: string): string {
    return `user:${userId}`;
}

export function registerSocketHandlers(io: Server) {
    /* ------------------------------------------------------------------ */
    /* Handshake authentication                                           */
    /* ------------------------------------------------------------------ */

    io.use(async (socket, next) => {
        try {
            const token =
                (socket.handshake.auth?.token as string | undefined) ??
                socket.handshake.headers.authorization?.replace(/^Bearer /, '');

            if (!token) return next(new Error('Authentication required'));

            const payload = verifyToken(token);
            const user = await User.findById(payload.userId).select('_id fullName email');
            if (!user) return next(new Error('Account no longer exists'));

            const data = socket.data as SocketData;
            data.userId = user._id.toString();
            data.email = payload.email;
            next();
        } catch {
            next(new Error('Invalid or expired token'));
        }
    });

    io.on('connection', (socket: Socket) => {
        const appSocket = socket as AppSocket;
        const { userId } = appSocket.data;

        socket.join(userChannel(userId));
        trackSocket(userId, socket.id);

        // Presence is updated without blocking. Awaiting it here would delay
        // listener registration below by a database round trip, and any event
        // the client emits immediately on connect — `join-room` being the
        // obvious one — would arrive with no handler attached and be dropped,
        // leaving the caller waiting on an acknowledgement that never comes.
        void markOnline(io, userId);

        /* -------------------------------------------------------------- */
        /* Rooms                                                          */
        /* -------------------------------------------------------------- */

        socket.on('join-room', async (roomId: string, ack?: (result: { ok: boolean; error?: string }) => void) => {
            if (!mongoose.isValidObjectId(roomId)) {
                ack?.({ ok: false, error: 'Unknown room' });
                return;
            }

            try {
                const room = await Room.findById(roomId);
                if (!room) {
                    ack?.({ ok: false, error: 'Room not found' });
                    return;
                }
                if (room.status === 'finished') {
                    ack?.({ ok: false, error: 'This session has ended' });
                    return;
                }

                const isHost = room.host.toString() === userId;
                const isParticipant = room.participants.some((p) => p.toString() === userId);

                // The HTTP join endpoint is what admits people. The socket only
                // confirms an existing membership — otherwise knowing a room id
                // would be enough to eavesdrop on a private session.
                if (!isHost && !isParticipant) {
                    ack?.({ ok: false, error: 'You have not been admitted to this room' });
                    return;
                }

                socket.join(roomId);
                appSocket.data.currentRoom = roomId;
                // adminEnabled === false means anyone may drive playback.
                appSocket.data.controlsPlayback = isHost || room.adminEnabled === false;

                const updated = await Room.findByIdAndUpdate(
                    roomId,
                    { $addToSet: { participants: userId, attendees: userId } },
                    { new: true },
                ).populate(ROOM_POPULATE as never);

                if (updated) io.to(roomId).emit('room-updated', roomSnapshot(updated));

                // Tell the newcomer who is already here, and tell everyone else
                // that someone arrived, so WebRTC can negotiate.
                const sockets = await io.in(roomId).fetchSockets();
                socket.emit(
                    'existing-participants',
                    sockets
                        .filter((s) => s.id !== socket.id)
                        .map((s) => ({
                            socketId: s.id,
                            userId: (s.data as SocketData).userId,
                        })),
                );

                socket.to(roomId).emit('user-connected', { userId, socketId: socket.id });
                ack?.({ ok: true });
            } catch (error) {
                console.error('join-room failed:', error);
                ack?.({ ok: false, error: 'Could not join the room' });
            }
        });

        /**
         * Who else is in my room?
         *
         * `existing-participants` is emitted once, in response to join-room.
         * The room layout joins as soon as the lobby opens, but the WebRTC
         * hook only mounts on the watch screen — so that event had always
         * fired and gone before anything was listening for it, and no peer
         * ever offered. This lets a client ask at the moment it is ready.
         */
        socket.on(
            'list-peers',
            async (
                roomId: string,
                ack?: (peers: { socketId: string; userId: string }[]) => void,
            ) => {
                if (!ack) return;
                if (appSocket.data.currentRoom !== roomId) {
                    ack([]);
                    return;
                }
                const sockets = await io.in(roomId).fetchSockets();
                ack(
                    sockets
                        .filter((s) => s.id !== socket.id)
                        .map((s) => ({
                            socketId: s.id,
                            userId: (s.data as SocketData).userId,
                        })),
                );
            },
        );

        /**
         * "My WebRTC layer is mounted and listening."
         *
         * Joining a room and being ready to negotiate are different moments.
         * The room layout joins on the lobby; the peer connection code only
         * mounts on the watch screen. An offer sent on `user-connected` — which
         * fires at join time — therefore arrived while the recipient had no
         * offer listener, and was dropped. The recipient then waited for an
         * offer that had already come and gone, and neither side ever spoke
         * again.
         *
         * Announcing readiness lets whichever side should initiate do so at a
         * moment the other is certain to hear it.
         */
        socket.on('peer-ready', (roomId: string) => {
            if (appSocket.data.currentRoom !== roomId) return;
            socket.to(roomId).emit('peer-ready', { socketId: socket.id, userId });
        });

        /**
         * "My WebRTC layer is listening now."
         *
         * user-connected fires when a socket joins the room, which happens in
         * the room layout — well before the watch screen has mounted and
         * registered an offer handler. An offer sent on that signal arrived at
         * a client that was not listening yet and was simply lost, and since
         * only one side of a pair initiates, nothing ever retried.
         *
         * This is emitted by the peer itself once it is genuinely ready to
         * answer, so the offer cannot outrun the handler.
         */
        socket.on('peer-ready', (roomId: string) => {
            if (appSocket.data.currentRoom !== roomId) return;
            socket.to(roomId).emit('peer-ready', { roomId, socketId: socket.id, userId });
        });

        socket.on('leave-room', async (roomId: string) => {
            if (appSocket.data.currentRoom !== roomId) return;
            socket.leave(roomId);
            appSocket.data.currentRoom = undefined;
            await handleDeparture(io, socket as AppSocket, roomId, userId);
        });

        /* -------------------------------------------------------------- */
        /* WebRTC signalling                                              */
        /* -------------------------------------------------------------- */

        const relay = (event: 'offer' | 'answer' | 'ice-candidate') =>
            socket.on(event, (payload: { targetSocketId?: string }) => {
                const target = payload?.targetSocketId;
                if (!target) return;
                // Only relay between sockets that share a room.
                const room = appSocket.data.currentRoom;
                if (!room) return;
                // senderUserId matters as much as the socket id: the receiving
                // client has to attach the incoming stream to a participant, and
                // a socket id alone tells it nothing about who that is. Without
                // this the receiver labelled every remote peer "camera off".
                io.to(target).emit(event, {
                    ...payload,
                    senderSocketId: socket.id,
                    senderUserId: userId,
                });
            });

        relay('offer');
        relay('answer');
        relay('ice-candidate');

        /* -------------------------------------------------------------- */
        /* Chat                                                           */
        /* -------------------------------------------------------------- */

        socket.on('chat-message', async (payload: { roomId?: string; text?: string }) => {
            const roomId = payload?.roomId;
            const text = typeof payload?.text === 'string' ? payload.text.trim() : '';

            if (!roomId || appSocket.data.currentRoom !== roomId) return;
            if (!text) return;
            if (text.length > MAX_CHAT_LENGTH) {
                socket.emit('server-error', {
                    event: 'chat-message',
                    message: `Messages are limited to ${MAX_CHAT_LENGTH} characters.`,
                });
                return;
            }

            try {
                const user = await User.findById(userId).select('fullName email');
                const userName = user?.fullName || user?.email || 'Guest';

                const message = await Message.create({
                    room: roomId,
                    user: userId,
                    userName,
                    text,
                });

                // Broadcast to everyone including the sender, so the server is the
                // single ordering authority and no client renders an optimistic
                // message that history later contradicts.
                io.to(roomId).emit('chat-message', {
                    id: message._id.toString(),
                    roomId,
                    userId,
                    userName,
                    text: message.text,
                    timestamp: message.createdAt.toISOString(),
                });
            } catch (error) {
                console.error('chat-message failed:', error);
                socket.emit('server-error', {
                    event: 'chat-message',
                    message: 'Message could not be sent.',
                });
            }
        });

        socket.on('reaction', (payload: { roomId?: string; emoji?: string }) => {
            const roomId = payload?.roomId;
            if (!roomId || appSocket.data.currentRoom !== roomId) return;
            if (!payload.emoji || !ALLOWED_REACTIONS.has(payload.emoji)) return;
            socket.to(roomId).emit('reaction', { roomId, userId, emoji: payload.emoji });
        });

        /* -------------------------------------------------------------- */
        /* Playback synchronisation                                       */
        /* -------------------------------------------------------------- */

        // The host check is resolved once at join time. Previously every event —
        // including each frame of a scrub — issued its own Room.findById.
        const playbackEvent = (event: 'video-play' | 'video-pause' | 'video-seek') =>
            socket.on(event, (payload: { roomId?: string; currentTime?: number }) => {
                const roomId = payload?.roomId;
                if (!roomId || appSocket.data.currentRoom !== roomId) return;

                if (!appSocket.data.controlsPlayback) {
                    socket.emit('server-error', {
                        event,
                        message: 'Only the host controls playback in this room.',
                    });
                    return;
                }

                socket.to(roomId).emit(event, {
                    roomId,
                    currentTime: Number(payload.currentTime) || 0,
                    emittedAt: Date.now(),
                });
            });

        playbackEvent('video-play');
        playbackEvent('video-pause');
        playbackEvent('video-seek');

        // A newcomer asks the room where playback is; controllers answer directly.
        socket.on('video-sync-request', (payload: { roomId?: string }) => {
            const roomId = payload?.roomId;
            if (!roomId || appSocket.data.currentRoom !== roomId) return;
            socket.to(roomId).emit('video-sync-request', {
                roomId,
                requesterSocketId: socket.id,
            });
        });

        socket.on(
            'video-sync-response',
            (payload: {
                roomId?: string;
                targetSocketId?: string;
                currentTime?: number;
                paused?: boolean;
            }) => {
                const { roomId, targetSocketId } = payload ?? {};
                if (!roomId || !targetSocketId) return;
                if (appSocket.data.currentRoom !== roomId) return;
                if (!appSocket.data.controlsPlayback) return;

                io.to(targetSocketId).emit('video-sync-response', {
                    roomId,
                    targetSocketId,
                    currentTime: Number(payload.currentTime) || 0,
                    // A late joiner needs to know the film is *running*, not just
                    // where it has got to. Without this they synced the position
                    // and then sat on a paused frame.
                    paused: Boolean(payload.paused),
                    emittedAt: Date.now(),
                });
            },
        );

        /* -------------------------------------------------------------- */
        /* Disconnect                                                     */
        /* -------------------------------------------------------------- */

        socket.on('disconnect', async () => {
            const roomId = appSocket.data.currentRoom;
            if (roomId) await handleDeparture(io, appSocket, roomId, userId);

            const wasLastSocket = untrackSocket(userId, socket.id);
            // Only go offline once every tab has closed. The old single-socket map
            // marked a user offline as soon as any one of their tabs closed.
            if (wasLastSocket) await markOffline(io, userId);
        });
    });
}

/* ---------------------------------------------------------------------- */
/* Helpers                                                                */
/* ---------------------------------------------------------------------- */

function roomSnapshot(room: any) {
    return {
        roomId: room._id.toString(),
        participantCount: room.participants.length,
        participants: room.participants,
        host: room.host,
        movie: room.movie,
        status: room.status,
    };
}

/**
 * Someone left a room, by navigating away or by disconnecting.
 *
 * The host keeps their seat: they own the room, and dropping them from
 * `participants` on a page refresh used to make the room look hostless and let
 * `joinRoom` re-run its stat increments when they came back.
 */
async function handleDeparture(
    io: Server,
    socket: AppSocket,
    roomId: string,
    userId: string,
) {
    try {
        const room = await Room.findById(roomId);
        if (!room) return;

        socket.to(roomId).emit('user-disconnected', { userId, socketId: socket.id });

        if (room.host.toString() === userId) {
            // Host stays a participant; just tell the room they dropped off.
            const user = await User.findById(userId).select('fullName');
            io.to(roomId).emit('user-left', {
                userId,
                userName: user?.fullName || 'The host',
            });
            return;
        }

        // Another tab of the same user may still be in the room.
        const remaining = await io.in(roomId).fetchSockets();
        const stillPresent = remaining.some(
            (s) => s.id !== socket.id && (s.data as SocketData).userId === userId,
        );
        if (stillPresent) return;

        const user = await User.findById(userId).select('fullName');
        io.to(roomId).emit('user-left', {
            userId,
            userName: user?.fullName || 'A participant',
        });

        const updated = await Room.findByIdAndUpdate(
            roomId,
            {
                $pull: { participants: new mongoose.Types.ObjectId(userId) },
                $set: { 'joinRequests.$[elem].status': 'left' },
            },
            {
                arrayFilters: [
                    {
                        'elem.user': new mongoose.Types.ObjectId(userId),
                        'elem.status': 'approved',
                    },
                ],
                new: true,
            },
        ).populate(ROOM_POPULATE as never);

        if (updated) io.to(roomId).emit('room-updated', roomSnapshot(updated));
    } catch (error) {
        console.error('Departure handling failed:', error);
    }
}

async function markOnline(io: Server, userId: string) {
    try {
        await User.findByIdAndUpdate(userId, {
            onlineStatus: 'online',
            lastSeen: new Date(),
        });
        await notifyFriends(io, userId, 'friend-online');
    } catch (error) {
        console.error('Online status update failed:', error);
    }
}

async function markOffline(io: Server, userId: string) {
    try {
        await User.findByIdAndUpdate(userId, {
            onlineStatus: 'offline',
            lastSeen: new Date(),
        });
        await notifyFriends(io, userId, 'friend-offline');
    } catch (error) {
        console.error('Offline status update failed:', error);
    }
}

async function notifyFriends(io: Server, userId: string, event: string) {
    const friendships = await Friend.find({
        $or: [{ requester: userId }, { recipient: userId }],
        status: 'accepted',
    }).select('requester recipient');

    friendships.forEach((friendship) => {
        const friendId =
            friendship.requester.toString() === userId
                ? friendship.recipient.toString()
                : friendship.requester.toString();
        io.to(userChannel(friendId)).emit(event, { userId });
    });
}
