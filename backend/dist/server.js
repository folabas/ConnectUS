"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Load environment variables FIRST before any other imports
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const database_1 = require("./config/database");
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const movieRoutes_1 = __importDefault(require("./routes/movieRoutes"));
const roomRoutes_1 = __importDefault(require("./routes/roomRoutes"));
const friendRoutes_1 = __importDefault(require("./routes/friendRoutes"));
const notificationRoutes_1 = __importDefault(require("./routes/notificationRoutes"));
const User_1 = require("./models/User");
const Friend_1 = require("./models/Friend");
// Create Express app
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
// Initialize Socket.io
const io = new socket_io_1.Server(httpServer, {
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
app.use((0, cors_1.default)({
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
// Handle preflight requests
app.options("*", (0, cors_1.default)());
// Body parsing middleware
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Socket.io Signaling Logic
const userSockets = new Map(); // userId -> socketId
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    // User online status
    socket.on('user-online', async (userId) => {
        userSockets.set(userId, socket.id);
        await User_1.User.findByIdAndUpdate(userId, { onlineStatus: 'online', lastSeen: new Date() });
        // Notify friends
        const friendships = await Friend_1.Friend.find({
            $or: [{ requester: userId }, { recipient: userId }],
            status: 'accepted'
        });
        const friendIds = friendships.map(f => f.requester.toString() === userId ? f.recipient.toString() : f.requester.toString());
        friendIds.forEach(friendId => {
            const friendSocketId = userSockets.get(friendId);
            if (friendSocketId) {
                io.to(friendSocketId).emit('friend-online', userId);
            }
        });
    });
    socket.on('join-room', (roomId, userId) => {
        socket.join(roomId);
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
        io.to(payload.roomId).emit('chat-message', payload);
    });
    socket.on('disconnect', async () => {
        // Find user by socket ID
        let disconnectedUserId = null;
        for (const [userId, socketId] of userSockets.entries()) {
            if (socketId === socket.id) {
                disconnectedUserId = userId;
                userSockets.delete(userId);
                break;
            }
        }
        if (disconnectedUserId) {
            await User_1.User.findByIdAndUpdate(disconnectedUserId, {
                onlineStatus: 'offline',
                lastSeen: new Date()
            });
            // Notify friends
            const friendships = await Friend_1.Friend.find({
                $or: [{ requester: disconnectedUserId }, { recipient: disconnectedUserId }],
                status: 'accepted'
            });
            const friendIds = friendships.map(f => f.requester.toString() === disconnectedUserId ? f.recipient.toString() : f.requester.toString());
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
app.use('/api/auth', authRoutes_1.default);
app.use('/api/movies', movieRoutes_1.default);
app.use('/api/rooms', roomRoutes_1.default);
app.use('/api/friends', friendRoutes_1.default);
app.use('/api/notifications', notificationRoutes_1.default);
// Health check route
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'ConnectUS API is running',
        timestamp: new Date().toISOString(),
    });
});
// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found',
    });
});
// Error handler
app.use((err, req, res, next) => {
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
        await (0, database_1.connectDB)();
        // Start listening
        httpServer.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📍 API URL: http://localhost:${PORT}`);
            console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
            console.log(`🔌 Socket.io ready`);
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};
startServer();
exports.default = app;
//# sourceMappingURL=server.js.map