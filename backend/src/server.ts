// Load environment variables FIRST before any other imports
import dotenv from 'dotenv';
dotenv.config();

import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { connectDB } from './config/database';
import authRoutes from './routes/authRoutes';
import movieRoutes from './routes/movieRoutes';
import roomRoutes from './routes/roomRoutes';
import friendRoutes from './routes/friendRoutes';
import notificationRoutes from './routes/notificationRoutes';
import { User } from './models/User';
import { Friend } from './models/Friend';
import { Room } from './models/Room';
import { schedulerService } from './services/schedulerService';

// Create Express app
const app: Application = express();
const httpServer = createServer(app);

// Initialize Socket.io
const io = new Server(httpServer, {
    cors: {
        origin: [
            "http://localhost:3000",
            "https://connectus.live",
            "https://www.connectus.live"
        ],
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Make io accessible to our router
app.set('io', io);

// CORS Middleware - MUST be FIRST
app.use(cors({
    origin: [
        "http://localhost:3000",
        "https://connectus.live",
        "https://www.connectus.live"
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: [
        "Content-Type",
        "Authorization",
        "Accept",
        "X-Requested-With"
    ]
}));

// JSON Body Parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Socket.io Signaling Logic
const userSockets = new Map<string, string>(); // userId -> socketId
const socketToUser = new Map<string, string>(); // socketId -> userId (Reverse map for O(1) lookup)

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // User online status
    socket.on('user-online', async (userId: string) => {
        userSockets.set(userId, socket.id);
        socketToUser.set(socket.id, userId); // Add to reverse map
        await User.findByIdAndUpdate(userId, { onlineStatus: 'online', lastSeen: new Date() });

        // Notify friends
        const friendships = await Friend.find({
            $or: [{ requester: userId }, { recipient: userId }],
            status: 'accepted'
        });

        const friendIds = friendships.map(f =>
            f.requester.toString() === userId ? f.recipient.toString() : f.requester.toString()
        );

        friendIds.forEach(friendId => {
            const friendSocketId = userSockets.get(friendId);
            if (friendSocketId) {
                io.to(friendSocketId).emit('friend-online', userId);
            }
        });
    });

    socket.on('join-room', async (roomId, userId) => {
        socket.join(roomId);

        // Update room participants in database using atomic operator
        try {
            // Use $addToSet to prevent race conditions and duplicates
            const updatedRoom = await Room.findByIdAndUpdate(
                roomId,
                { $addToSet: { participants: userId } },
                { new: true }
            ).populate('participants', '_id fullName avatarUrl').populate('host', '_id fullName avatarUrl').populate('movie');

            if (updatedRoom) {
                // Emit FULL room data to all users in the room
                io.to(roomId).emit('room-updated', {
                    roomId,
                    participantCount: updatedRoom.participants.length,
                    participants: updatedRoom.participants,
                    host: updatedRoom.host,
                    movie: updatedRoom.movie,
                    status: updatedRoom.status
                });
            }
        } catch (error) {
            console.error('Error updating room participants:', error);
        }

        // FIX: Send list of existing users to the new user
        const sockets = await io.in(roomId).fetchSockets();
        const existingParticipants = sockets
            .filter(s => s.id !== socket.id)
            .map(s => ({
                socketId: s.id,
                userId: socketToUser.get(s.id) || 'unknown'
            }));

        socket.emit('existing-participants', existingParticipants);

        // FIX: Emit object with socketId so frontend can create peer connection
        socket.to(roomId).emit('user-connected', {
            userId,
            socketId: socket.id
        });
        console.log(`User ${userId} joined room ${roomId} (socket ${socket.id})`);

        // Store roomId on socket for disconnect handling
        socket.data.currentRoom = roomId;
        socket.data.currentUserId = userId;
    });

    socket.on('leave-room', async (roomId, userId) => {
        socket.leave(roomId);
        console.log(`User ${userId} left room ${roomId}`);

        try {
            const updatedRoom = await Room.findByIdAndUpdate(
                roomId,
                {
                    $pull: { participants: userId },
                    $set: { "joinRequests.$[elem].status": "left" }
                },
                {
                    arrayFilters: [{ "elem.user": userId, "elem.status": "approved" }],
                    new: true
                }
            ).populate('participants', '_id fullName avatarUrl').populate('host', '_id fullName avatarUrl').populate('movie');

            if (updatedRoom) {
                io.to(roomId).emit('room-updated', {
                    roomId,
                    participantCount: updatedRoom.participants.length,
                    participants: updatedRoom.participants,
                    host: updatedRoom.host,
                    movie: updatedRoom.movie,
                    status: updatedRoom.status
                });
            }
        } catch (error) {
            console.error('Error updating room on leave:', error);
        }
    });

    // Forward signaling payloads with senderSocketId
    socket.on('offer', (payload) => {
        // Payload should include: targetSocketId, sdp, sender (userId)
        const target = payload.targetSocketId || payload.target;
        if (!target) return;

        io.to(target).emit('offer', {
            ...payload,
            senderSocketId: socket.id // FIX: Add sender's socket ID
        });
    });

    socket.on('answer', (payload) => {
        const target = payload.targetSocketId || payload.target;
        if (!target) return;

        io.to(target).emit('answer', {
            ...payload,
            senderSocketId: socket.id
        });
    });

    socket.on('ice-candidate', (payload) => {
        const target = payload.targetSocketId || payload.target;
        if (!target) return;

        io.to(target).emit('ice-candidate', {
            ...payload,
            senderSocketId: socket.id
        });
    });

    socket.on('chat-message', (payload) => {
        const message = {
            id: payload.id,
            userId: payload.userId,
            text: payload.text,
            timestamp: payload.timestamp
        };
        // Use socket.to to exclude sender (prevents duplication)
        socket.to(payload.roomId).emit('chat-message', message);
    });

    // Video synchronization events - with host validation
    socket.on('video-play', async (payload) => {
        const userId = socketToUser.get(socket.id);
        if (!userId) return;

        // Check if user is host
        const room = await Room.findById(payload.roomId);
        if (!room || room.host.toString() !== userId) {
            socket.emit('error', { message: 'Only host can control playback' });
            return;
        }

        socket.to(payload.roomId).emit('video-play', payload);
    });

    socket.on('video-pause', async (payload) => {
        const userId = socketToUser.get(socket.id);
        if (!userId) return;

        const room = await Room.findById(payload.roomId);
        if (!room || room.host.toString() !== userId) {
            socket.emit('error', { message: 'Only host can control playback' });
            return;
        }

        socket.to(payload.roomId).emit('video-pause', payload);
    });

    socket.on('video-seek', async (payload) => {
        const userId = socketToUser.get(socket.id);
        if (!userId) return;

        const room = await Room.findById(payload.roomId);
        if (!room || room.host.toString() !== userId) {
            socket.emit('error', { message: 'Only host can control playback' });
            return;
        }

        socket.to(payload.roomId).emit('video-seek', payload);
    });

    socket.on('video-sync-request', (payload) => {
        socket.to(payload.roomId).emit('video-sync-request', payload);
    });

    socket.on('video-sync-response', (payload) => {
        socket.to(payload.roomId).emit('video-sync-response', payload);
    });

    // Reaction events - open to all participants
    socket.on('reaction', (payload) => {
        socket.to(payload.roomId).emit('reaction', payload);
    });

    socket.on('disconnect', async () => {
        // Get the room they were in from socket data
        const roomId = socket.data.currentRoom;
        const disconnectedUserId = socketToUser.get(socket.id) || socket.data.currentUserId;

        // If user was in a room, emit user-disconnected and update room
        if (roomId && disconnectedUserId) {
            socket.to(roomId).emit('user-disconnected', { userId: disconnectedUserId, socketId: socket.id });

            // Remove user from room participants in DB and emit update
            try {
                const updatedRoom = await Room.findByIdAndUpdate(
                    roomId,
                    {
                        $pull: { participants: disconnectedUserId },
                        $set: { "joinRequests.$[elem].status": "left" }
                    },
                    {
                        arrayFilters: [{ "elem.user": disconnectedUserId, "elem.status": "approved" }],
                        new: true
                    }
                ).populate('participants', '_id fullName avatarUrl').populate('host', '_id fullName avatarUrl').populate('movie');

                if (updatedRoom) {
                    socket.to(roomId).emit('room-updated', {
                        roomId,
                        participantCount: updatedRoom.participants.length,
                        participants: updatedRoom.participants,
                        host: updatedRoom.host,
                        movie: updatedRoom.movie,
                        status: updatedRoom.status
                    });
                }
            } catch (error) {
                console.error('Error updating room on disconnect:', error);
            }
        }

        // Optimized disconnect handling using reverse map O(1)
        if (disconnectedUserId) {
            // Clean up maps
            userSockets.delete(disconnectedUserId);
            socketToUser.delete(socket.id);

            await User.findByIdAndUpdate(disconnectedUserId, {
                onlineStatus: 'offline',
                lastSeen: new Date()
            });

            // Notify friends
            const friendships = await Friend.find({
                $or: [{ requester: disconnectedUserId }, { recipient: disconnectedUserId }],
                status: 'accepted'
            });

            const friendIds = friendships.map(f =>
                f.requester.toString() === disconnectedUserId ? f.recipient.toString() : f.requester.toString()
            );

            friendIds.forEach(friendId => {
                const friendSocketId = userSockets.get(friendId);
                if (friendSocketId) {
                    io.to(friendSocketId).emit('friend-offline', disconnectedUserId);
                }
            });
        }
    });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check route
app.get('/api/health', (req: Request, res: Response) => {
    res.status(200).json({
        success: true,
        message: 'ConnectUS API is running',
        timestamp: new Date().toISOString(),
    });
});

// Root route
app.get('/', (req: Request, res: Response) => {
    res.status(200).json({
        success: true,
        message: 'ConnectUS API is live! 🍿',
    });
});

// 404 handler
app.use((req: Request, res: Response) => {
    res.status(404).json({
        success: false,
        message: 'Route not found',
    });
});

// Error handler
app.use((err: any, req: Request, res: Response, next: any) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error',
    });
});

// Start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        // Connect to database
        await connectDB();


        // Start room scheduler
        schedulerService.setIo(io);
        schedulerService.start();
        console.log('📅 Room scheduler started');

        // Start listening
        httpServer.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📍 API URL: http://localhost:${PORT}`);
            console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
            console.log(`🔌 Socket.io ready`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

export default app;
