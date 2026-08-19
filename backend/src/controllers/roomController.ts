import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Room } from '../models/Room';
import { Message } from '../models/Message';
import { User } from '../models/User';
import { Movie } from '../models/Movie';
import { AuthRequest } from '../middleware/auth';
import crypto from 'crypto';
import { emailService } from '../services/emailService';
import { userChannel } from '../sockets';

// Helper to generate random room code
const generateRoomCode = (): string => {
    return crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 chars
};

/** How many past sessions the history endpoint returns. */
const HISTORY_LIMIT = 50;

/** Cap on a single email-invite batch, so the endpoint is not a mail relay. */
const MAX_INVITES_PER_REQUEST = 20;

/** The id of a join request's user, whether or not the ref has been populated. */
const requestUserId = (user: any): string =>
    (user?._id ?? user)?.toString();

/** Newest N messages returned as history; older ones stay in the database. */
const MESSAGE_HISTORY_LIMIT = 200;

/** The populate shape every room response uses. */
const populateRoom = (id: string) =>
    Room.findById(id)
        .populate('host', '_id fullName avatarUrl')
        .populate('movie')
        .populate('participants', '_id fullName avatarUrl')
        .populate('joinRequests.user', '_id fullName avatarUrl');

// POST /api/rooms
export const createRoom = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { name, movieId, type, theme, startTime, maxParticipants, adminEnabled, approvalRequired } = req.body;
        const userId = req.user?.userId;

        if (!userId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        // Generate code for private rooms
        let code;
        if (type === 'private') {
            code = generateRoomCode();
            // Ensure uniqueness (simple check, could be improved)
            let existing = await Room.findOne({ code });
            while (existing) {
                code = generateRoomCode();
                existing = await Room.findOne({ code });
            }
        }

        // Parse scheduled start time if provided
        let scheduledStartTime: Date | undefined;
        let roomStatus: 'waiting' | 'scheduled' = 'waiting';

        if (startTime) {
            const parsedTime = new Date(startTime);
            const now = new Date();

            // If start time is in the future, set as scheduled
            if (parsedTime > now) {
                scheduledStartTime = parsedTime;
                roomStatus = 'scheduled';
            }
        }

        const room = await Room.create({
            name,
            host: userId as any,
            movie: movieId as any,
            type,
            code,
            theme,
            startTime,
            scheduledStartTime,
            maxParticipants,
            adminEnabled,
            approvalRequired: approvalRequired ?? (type === 'private'), // Default to true for private rooms
            participants: [userId as any], // Host is automatically a participant
            attendees: [userId as any],
            status: roomStatus,
        });

        // Increment sessions hosted
        await User.findByIdAndUpdate(userId, { $inc: { sessionsHosted: 1 } });

        res.status(201).json({
            success: true,
            data: room,
        });
    } catch (error: any) {
        console.error('Create room error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
};

// GET /api/rooms
export const getRooms = async (req: Request, res: Response): Promise<void> => {
    try {
        // Only list public rooms that are waiting or playing
        const rooms = await Room.find({
            type: 'public',
            // 'scheduled' and 'active' rooms were previously invisible in browse,
            // so a room scheduled for later could never be discovered.
            status: { $in: ['waiting', 'scheduled', 'active', 'playing'] },
        })
            .populate('host', 'fullName avatarUrl')
            .populate('movie', 'title image duration')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: rooms.length,
            data: rooms.map(room => {
                const r = room.toObject();
                return {
                    ...r,
                    approvalRequired: r.approvalRequired ?? (r.type === 'private')
                };
            }),
        });
    } catch (error: any) {
        console.error('Get rooms error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
};

// GET /api/rooms/:id
export const getRoomById = async (req: Request, res: Response): Promise<void> => {
    try {
        // Uses the shared populate so joinRequests.user comes back hydrated.
        // Without it the host's pending-request panel had only an ObjectId to
        // render and showed everyone as "Guest".
        const room = await populateRoom(req.params.id);

        if (!room) {
            res.status(404).json({
                success: false,
                message: 'Room not found',
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: room,
        });
    } catch (error: any) {
        console.error('Get room error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
};

// POST /api/rooms/join
export const joinRoom = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { roomId, code } = req.body;
        const userId = req.user?.userId;

        if (!userId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const room = roomId
            ? await Room.findById(roomId).populate('movie')
            : code
                ? await Room.findOne({ code: String(code).toUpperCase() }).populate('movie')
                : null;

        if (!room) {
            res.status(404).json({ success: false, message: 'Room not found' });
            return;
        }

        if (room.status === 'finished') {
            res.status(400).json({ success: false, message: 'This room session has ended' });
            return;
        }

        const isHost = room.host.toString() === userId;
        const isParticipant = room.participants.some((p) => p.toString() === userId);
        const isApproved = room.joinRequests?.some(
            (r) => r.user.toString() === userId && r.status === 'approved'
        );

        // Approval gate. Previously this only applied once the room was already
        // 'playing', so anyone holding the code could walk straight into a
        // waiting private room and bypass the host entirely.
        if (room.approvalRequired && !isHost && !isParticipant && !isApproved) {
            res.status(200).json({
                success: true,
                requiresApproval: true,
                message: 'The host needs to approve your request to join.',
                data: await populateRoom(room._id.toString()),
            });
            return;
        }

        // Private rooms reached by id rather than by code require prior admission.
        if (room.type === 'private' && !code && !isHost && !isParticipant && !isApproved) {
            res.status(403).json({
                success: false,
                message: 'This is a private room. Use an invite link or room code.',
            });
            return;
        }

        if (!isParticipant && !isHost && room.participants.length >= room.maxParticipants) {
            res.status(400).json({ success: false, message: 'Room is full' });
            return;
        }

        if (!isParticipant) {
            await Room.updateOne(
                { _id: room._id },
                {
                    $addToSet: {
                        participants: new mongoose.Types.ObjectId(userId),
                        // Append-only: this is what history is built from.
                        attendees: new mongoose.Types.ObjectId(userId),
                    },
                }
            );

            // Count the watch once per user per room. A socket disconnect pulls
            // the user out of `participants`, so without this guard every
            // refresh re-incremented moviesWatched and appended a duplicate
            // watch-history entry.
            const alreadyCounted = await User.exists({
                _id: userId,
                'watchHistory.roomId': room._id,
            });

            if (!alreadyCounted && !isHost) {
                const movie = room.movie as any;
                await User.findByIdAndUpdate(userId, {
                    $inc: { moviesWatched: 1 },
                    $push: {
                        watchHistory: {
                            movieId: movie?._id ?? room.movie,
                            roomId: room._id,
                            title: movie?.title ?? 'Unknown Movie',
                            date: new Date(),
                            rating: 0,
                        },
                    },
                });
            }
        }

        res.status(200).json({
            success: true,
            requiresApproval: false,
            data: await populateRoom(room._id.toString()),
        });
    } catch (error: any) {
        console.error('Join room error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// POST /api/rooms/:id/leave
export const leaveRoom = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;

        if (!userId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const room = await Room.findById(id);
        if (!room) {
            res.status(404).json({ success: false, message: 'Room not found' });
            return;
        }

        // The host leaving would orphan the room; they end it instead.
        if (room.host.toString() === userId) {
            res.status(400).json({
                success: false,
                message: 'As host, end the session instead of leaving it.',
            });
            return;
        }

        await Room.updateOne(
            { _id: id },
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
            }
        );

        const updated = await populateRoom(id);
        const io = req.app.get('io');
        if (io && updated) {
            io.to(id).emit('room-updated', {
                roomId: id,
                participantCount: updated.participants.length,
                participants: updated.participants,
                host: updated.host,
                movie: updated.movie,
                status: updated.status,
            });
        }

        res.status(200).json({ success: true, message: 'Left the room' });
    } catch (error: any) {
        console.error('Leave room error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// GET /api/rooms/:id/messages
export const getRoomMessages = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;

        const room = await Room.findById(id).select('host participants joinRequests');
        if (!room) {
            res.status(404).json({ success: false, message: 'Room not found' });
            return;
        }

        // History is only readable by people who were actually in the room.
        const allowed =
            room.host.toString() === userId ||
            room.participants.some((p) => p.toString() === userId) ||
            room.joinRequests?.some(
                (r) => r.user.toString() === userId && ['approved', 'left'].includes(r.status)
            );

        if (!allowed) {
            res.status(403).json({ success: false, message: 'You are not in this room' });
            return;
        }

        const messages = await Message.find({ room: id })
            .sort({ createdAt: 1 })
            .limit(MESSAGE_HISTORY_LIMIT)
            .lean();

        res.status(200).json({
            success: true,
            data: messages.map((message) => ({
                id: message._id.toString(),
                roomId: id,
                userId: message.user.toString(),
                userName: message.userName,
                text: message.text,
                timestamp: message.createdAt.toISOString(),
            })),
        });
    } catch (error: any) {
        console.error('Get messages error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// GET /api/rooms/history
export const getRoomHistory = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const objectId = new mongoose.Types.ObjectId(userId);

        // `attendees` is append-only, so it survives everyone leaving. Rooms
        // created before that field existed are matched on the live roster and
        // on host, which is the best that can be reconstructed for them.
        const rooms = await Room.find({
            $or: [
                { attendees: objectId },
                { participants: objectId },
                { host: objectId },
            ],
        })
            .populate('movie', 'title image duration genre year source videoUrl')
            .populate('host', '_id fullName avatarUrl')
            .populate('attendees', '_id fullName avatarUrl')
            .populate('participants', '_id fullName avatarUrl')
            .sort({ updatedAt: -1 })
            .limit(HISTORY_LIMIT)
            .lean();

        const data = rooms.map((room: any) => {
            // Prefer the permanent record; fall back for pre-existing rooms.
            const everyone = (room.attendees?.length ? room.attendees : room.participants) ?? [];
            const hostId = room.host?._id?.toString();

            return {
                roomId: room._id.toString(),
                name: room.name,
                status: room.status,
                type: room.type,
                theme: room.theme,
                watchedAt: room.updatedAt,
                createdAt: room.createdAt,
                movie: room.movie ?? null,
                host: room.host ?? null,
                youHosted: hostId === userId,
                // "With who": everyone who was ever in the room, minus you.
                companions: everyone
                    .filter((person: any) => person?._id?.toString() !== userId)
                    .map((person: any) => ({
                        _id: person._id.toString(),
                        fullName: person.fullName,
                        avatarUrl: person.avatarUrl,
                        isHost: person._id.toString() === hostId,
                    })),
            };
        });

        res.status(200).json({ success: true, count: data.length, data });
    } catch (error: any) {
        console.error('Room history error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// POST /api/rooms/invite/:friendId
export const inviteToRoom = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { roomId, emails } = req.body;
        const userId = req.user?.userId;

        if (!userId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const room = await Room.findById(roomId).populate('host');
        if (!room) {
            res.status(404).json({ success: false, message: 'Room not found' });
            return;
        }

        // Check if user is host
        if (room.host._id.toString() !== userId) {
            res.status(403).json({ success: false, message: 'Only host can send invites' });
            return;
        }

        const user = await User.findById(userId);
        const inviterName = user?.fullName || 'A friend';

        // Send emails
        const movie = await Movie.findById(room.movie);
        const movieTitle = movie?.title || 'a movie';

        const recipients = (Array.isArray(emails) ? emails : [])
            .map((email: unknown) => String(email).trim())
            .filter((email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
            .slice(0, MAX_INVITES_PER_REQUEST);

        if (recipients.length === 0) {
            res.status(400).json({ success: false, message: 'No valid email addresses provided' });
            return;
        }

        // One bad address should not fail the whole batch.
        const results = await Promise.allSettled(
            recipients.map((email: string) =>
                emailService.sendRoomInvite({
                    toEmail: email,
                    toName: email.split('@')[0],
                    fromName: inviterName,
                    movieTitle,
                    roomCode: room.code,
                    roomId: room._id.toString()
                })
            )
        );

        const sent = results.filter((result) => result.status === 'fulfilled').length;
        if (sent === 0) {
            res.status(502).json({
                success: false,
                message: 'Invitations could not be sent. Check the email configuration.'
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: `Invitations sent to ${sent} recipient(s)`
        });
    } catch (error: any) {
        console.error('Invite error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send invitations'
        });
    }
};

// POST /api/rooms/:id/start
export const startRoom = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;
        const room = await Room.findById(id)
            .populate('movie')
            .populate('host', '_id fullName avatarUrl')
            .populate('participants', '_id fullName avatarUrl');
        if (!room) {
            res.status(404).json({ success: false, message: 'Room not found' });
            return;
        }

        if (room.host._id.toString() !== userId) {
            res.status(403).json({ success: false, message: 'Only host can start room' });
            return;
        }

        room.status = 'playing';
        await room.save();

        // Get IO instance from app
        const io = req.app.get('io');
        if (io) {
            // Broadcast start event with FULL room data including movie
            io.to(id).emit('room-started', {
                roomId: id,
                message: "Session started",
                room
            });

            // Trigger auto-play
            io.to(id).emit('video-play', {
                roomId: id,
                currentTime: 0
            });
        }

        res.status(200).json({ success: true, data: room });
    } catch (error: any) {
        console.error('Start room error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// POST /api/rooms/:id/request-join
export const requestToJoin = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;

        if (!userId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const room = await Room.findById(id);
        if (!room) {
            res.status(404).json({ success: false, message: 'Room not found' });
            return;
        }

        // Check if room is full
        if (room.participants.length >= room.maxParticipants) {
            res.status(400).json({ success: false, message: 'Room is full' });
            return;
        }

        // Check if user is already a participant
        const isAlreadyParticipant = room.participants.some(p => p.toString() === userId);
        if (isAlreadyParticipant) {
            res.status(400).json({ success: false, message: 'You are already in this room' });
            return;
        }

        // Asking again while a request is already pending is a no-op, not an
        // error. The client sends this automatically on arrival, so a refresh
        // would otherwise surface a failure for something that is working.
        const existingRequest = room.joinRequests?.find(
            r => requestUserId(r.user) === userId && r.status === 'pending'
        );
        if (existingRequest) {
            res.status(200).json({ success: true, message: 'Request already pending' });
            return;
        }

        // A previous rejection no longer bars a fresh attempt: the old code left
        // the user permanently locked out with no way for the host to relent.
        // The stale entry is dropped so the new request is the only pending one.
        if (!room.joinRequests) {
            room.joinRequests = [];
        }
        room.joinRequests = room.joinRequests.filter(
            r => r.user.toString() !== userId
        ) as typeof room.joinRequests;

        const requestedAt = new Date();
        room.joinRequests.push({
            user: userId as any,
            requestedAt,
            status: 'pending'
        });
        await room.save();

        const requester = await User.findById(userId).select('_id fullName avatarUrl');

        // Addressed to the host's own channel rather than the room channel. The
        // host may not have a socket in the room yet, and broadcasting a join
        // request to every participant leaked who was knocking.
        const io = req.app.get('io');
        if (io) {
            io.to(userChannel(room.host.toString())).emit('join-request-received', {
                roomId: id,
                user: {
                    _id: userId,
                    fullName: requester?.fullName,
                    avatarUrl: requester?.avatarUrl
                },
                requestedAt: requestedAt.toISOString()
            });
        }

        res.status(200).json({ success: true, message: 'Join request sent' });
    } catch (error: any) {
        console.error('Request to join error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// POST /api/rooms/:id/approve-request/:userId
export const approveJoinRequest = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id, userId } = req.params;
        const hostId = req.user?.userId;

        if (!hostId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        // Deliberately NOT populating joinRequests.user here: populate replaces
        // the ObjectId with a document, and the lookup below compares against a
        // raw id string. With populate the comparison never matched, so every
        // approval and rejection returned 'Join request not found'.
        const room = await Room.findById(id);
        if (!room) {
            res.status(404).json({ success: false, message: 'Room not found' });
            return;
        }

        // Only host can approve requests
        if (room.host.toString() !== hostId) {
            res.status(403).json({ success: false, message: 'Only host can approve requests' });
            return;
        }

        // Check if room is full
        if (room.participants.length >= room.maxParticipants) {
            res.status(400).json({ success: false, message: 'Room is full' });
            return;
        }

        // Find the request
        const request = room.joinRequests?.find(
            r => requestUserId(r.user) === userId && r.status === 'pending'
        );
        if (!request) {
            res.status(404).json({ success: false, message: 'Join request not found' });
            return;
        }

        // Update request status
        request.status = 'approved';
        await room.save();

        // $addToSet rather than push: the socket join handler also adds the user,
        // and two concurrent writes with push produced duplicate participants.
        await Room.updateOne(
            { _id: id },
            {
                $addToSet: {
                    participants: new mongoose.Types.ObjectId(userId),
                    attendees: new mongoose.Types.ObjectId(userId),
                },
            }
        );

        // Re-populate to get full details
        const updatedRoom = await Room.findById(id)
            .populate('host', '_id fullName avatarUrl')
            .populate('movie')
            .populate('participants', '_id fullName avatarUrl')
            .populate('joinRequests.user', '_id fullName avatarUrl');

        const io = req.app.get('io');
        if (io) {
            // To the requester's own channel: a pending user is deliberately not
            // in the room channel, so the previous room-scoped emit reached
            // everyone except the one person waiting for the answer.
            io.to(userChannel(userId)).emit('join-request-approved', {
                roomId: id,
                room: updatedRoom
            });
            // And tell the room it has a new participant.
            io.to(id).emit('room-updated', {
                roomId: id,
                participantCount: updatedRoom!.participants.length,
                participants: updatedRoom!.participants,
                movie: updatedRoom!.movie,
                host: updatedRoom!.host,
                status: updatedRoom!.status
            });
        }

        res.status(200).json({ success: true, data: updatedRoom });
    } catch (error: any) {
        console.error('Approve join request error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// POST /api/rooms/:id/reject-request/:userId
export const rejectJoinRequest = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id, userId } = req.params;
        const hostId = req.user?.userId;

        if (!hostId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        // Deliberately NOT populating joinRequests.user here: populate replaces
        // the ObjectId with a document, and the lookup below compares against a
        // raw id string. With populate the comparison never matched, so every
        // approval and rejection returned 'Join request not found'.
        const room = await Room.findById(id);
        if (!room) {
            res.status(404).json({ success: false, message: 'Room not found' });
            return;
        }

        // Only host can reject requests
        if (room.host.toString() !== hostId) {
            res.status(403).json({ success: false, message: 'Only host can reject requests' });
            return;
        }

        // Find the request
        const request = room.joinRequests?.find(
            r => requestUserId(r.user) === userId && r.status === 'pending'
        );
        if (!request) {
            res.status(404).json({ success: false, message: 'Join request not found' });
            return;
        }

        // Update request status
        request.status = 'rejected';
        await room.save();

        // Same reasoning as approval: the requester is not in the room channel.
        const io = req.app.get('io');
        if (io) {
            io.to(userChannel(userId)).emit('join-request-rejected', {
                roomId: id,
                message: 'The host declined your request to join.'
            });
        }

        res.status(200).json({ success: true, message: 'Join request rejected' });
    } catch (error: any) {
        console.error('Reject join request error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// POST /api/rooms/:id/end
export const endRoom = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const hostId = req.user?.userId;

        if (!hostId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const room = await Room.findById(id);
        if (!room) {
            res.status(404).json({ success: false, message: 'Room not found' });
            return;
        }

        // Only host can end the room
        if (room.host.toString() !== hostId) {
            res.status(403).json({ success: false, message: 'Only host can end this session' });
            return;
        }

        // Update room status
        room.status = 'finished';
        await room.save();

        // Notify all participants via socket
        const io = req.app.get('io');
        if (io) {
            io.to(id).emit('room-ended', {
                roomId: id,
                message: 'This session has been ended by the host.'
            });
        }

        res.status(200).json({ success: true, message: 'Room ended successfully' });
    } catch (error: any) {
        console.error('End room error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};
