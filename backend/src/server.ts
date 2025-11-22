import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { connectDB } from './config/database';
import authRoutes from './routes/authRoutes';
import movieRoutes from './routes/movieRoutes';
import roomRoutes from './routes/roomRoutes';

// Load environment variables
dotenv.config();

// Create Express app
const app: Application = express();
const httpServer = createServer(app);

// Initialize Socket.io
const io = new Server(httpServer, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Socket.io Signaling Logic
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-room', (roomId: string, userId: string) => {
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
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/rooms', roomRoutes);

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
