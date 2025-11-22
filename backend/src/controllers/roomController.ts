import { Request, Response } from 'express';
import { Room } from '../models/Room';
import { User } from '../models/User';
import { AuthRequest } from '../middleware/auth';
import crypto from 'crypto';

// Helper to generate random room code
const generateRoomCode = (): string => {
    return crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 chars
};

// POST /api/rooms
export const createRoom = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { name, movieId, type, theme, startTime, maxParticipants, adminEnabled } = req.body;
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

        const room = await Room.create({
            name,
            host: userId as any,
            movie: movieId as any,
            type,
            code,
            theme,
            startTime,
            maxParticipants,
            adminEnabled,
            participants: [userId as any], // Host is automatically a participant
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
            status: { $in: ['waiting', 'playing'] },
        })
            .populate('host', 'fullName avatarUrl')
            .populate('movie', 'title image duration')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: rooms.length,
            data: rooms,
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
        const room = await Room.findById(req.params.id)
            .populate('host', 'fullName avatarUrl')
            .populate('movie', 'title image videoUrl duration')
            .populate('participants', 'fullName avatarUrl');

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

        let room;

        if (roomId) {
            room = await Room.findById(roomId).populate('movie');
        } else if (code) {
            room = await Room.findOne({ code: code.toUpperCase() }).populate('movie');
        }

        if (!room) {
            res.status(404).json({
                success: false,
                message: 'Room not found',
            });
            return;
        }

        // Check if room is full
        if (room.participants.length >= room.maxParticipants) {
            // Check if user is already in the room
            const isParticipant = room.participants.some((p) => p.toString() === userId);
            if (!isParticipant) {
                res.status(400).json({
                    success: false,
                    message: 'Room is full',
                });
                return;
            }
        }

        // Add user to participants if not already there
        const isParticipant = room.participants.some((p) => p.toString() === userId);
        if (!isParticipant) {
            room.participants.push(userId as any);
            await room.save();

            // Update user stats
            const movieTitle = (room.movie as any)?.title || 'Unknown Movie';
            const movieId = (room.movie as any)?._id || room.movie;

            await User.findByIdAndUpdate(userId, {
                $inc: { moviesWatched: 1 },
                $push: {
                    watchHistory: {
                        movieId: movieId,
                        title: movieTitle,
                        date: new Date(),
                        rating: 0 // Default rating
                    }
                }
            });
        }

        res.status(200).json({
            success: true,
            data: room,
        });
    } catch (error: any) {
        console.error('Join room error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
};
