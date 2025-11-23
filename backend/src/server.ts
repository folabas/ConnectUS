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

// Universal OPTIONS handler (Fix for Express 5)
app.use((req, res, next) => {
    if (req.method === "OPTIONS") {
        res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
        res.header("Access-Control-Allow-Credentials", "true");
        res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
        res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, X-Requested-With");
        return res.sendStatus(200);
    }
    next();
});

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Socket.io Signaling Logic
const userSockets = new Map<string, string>(); // userId -> socketId

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // User online status
    socket.on('user-online', async (userId: string) => {
        userSockets.set(userId, socket.id);
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

        // Update room participants in database
        try {
            const room = await Room.findById(roomId);
            if (room && !room.participants.includes(userId)) {
                room.participants.push(userId);
                await room.save();

                // Populate participants before emitting
                const updatedRoom = await Room.findById(roomId)
                    .populate('participants', 'fullName avatarUrl');

                if (updatedRoom) {
                    // Emit updated room data to all users in the room
                    io.to(roomId).emit('room-updated', {
                        roomId,
                        participantCount: updatedRoom.participants.length,
                        participants: updatedRoom.participants
                    });
                }
            }
        } catch (error) {
            console.error('Error updating room participants:', error);
        }

        socket.to(roomId).emit('user-connected', userId);
        console.log(`User ${userId} joined room ${roomId}`);

        socket.on('disconnect', () => {
            socket.to(roomId).emit('user-disconnected', userId);
        });
    });

    socket.on('offer', (payload) => {
        io.to(payload.target).emit('offer', payload);
    });

    socket.on('answer', (payload) => {
        io.to(payload.target).emit('answer', payload);
    });

    socket.on('ice-candidate', (payload) => {
        io.to(payload.target).emit('ice-candidate', payload);
    });

    socket.on('chat-message', (payload) => {
        const message = {
            id: payload.id,
            userId: payload.userId,
            text: payload.text,
            timestamp: payload.timestamp
        };
        io.to(payload.roomId).emit('chat-message', message);
    });

    socket.on('disconnect', async () => {
        // Find user by socket ID
        let disconnectedUserId: string | null = null;
        for (const [userId, socketId] of userSockets.entries()) {
            if (socketId === socket.id) {
                disconnectedUserId = userId;
                userSockets.delete(userId);
                break;
            }
        }

        if (disconnectedUserId) {
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
