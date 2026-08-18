// Environment must load and validate before anything reads process.env.
import dotenv from 'dotenv';
dotenv.config();

import { env } from './config/env';

import express, { Application, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server } from 'socket.io';

import { connectDB } from './config/database';
import authRoutes from './routes/authRoutes';
import movieRoutes from './routes/movieRoutes';
import roomRoutes from './routes/roomRoutes';
import friendRoutes from './routes/friendRoutes';
import notificationRoutes from './routes/notificationRoutes';
import { apiLimiter } from './middleware/rateLimit';
import { registerSocketHandlers } from './sockets';
import { schedulerService } from './services/schedulerService';

const app: Application = express();
const httpServer = createServer(app);

// Origins come from the environment now; they used to be a hardcoded list in
// this file, so adding a staging domain meant a code change and a redeploy.
const corsOptions = {
    origin: env.allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
};

const io = new Server(httpServer, {
    cors: { origin: env.allowedOrigins, methods: ['GET', 'POST'], credentials: true },
});

app.set('io', io);

// Behind a proxy (Render, Railway, Fly, nginx) the client IP arrives in
// X-Forwarded-For. Without this, rate limiting would bucket every request under
// the proxy's own address.
app.set('trust proxy', 1);

app.use(helmet({
    // The API serves JSON only; COEP would break nothing here but adds no value.
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false,
}));
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

registerSocketHandlers(io);

app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({
        success: true,
        message: 'ConnectUS API is running',
        timestamp: new Date().toISOString(),
    });
});

app.use('/api', apiLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/', (_req: Request, res: Response) => {
    res.status(200).json({ success: true, message: 'ConnectUS API is live! 🍿' });
});

app.use((_req: Request, res: Response) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(err.status || 500).json({
        success: false,
        // Internal messages can carry stack details and query fragments; they
        // stay out of production responses.
        message: env.isProduction
            ? 'Internal server error'
            : err.message || 'Internal server error',
    });
});

const startServer = async () => {
    try {
        await connectDB();

        schedulerService.setIo(io);
        schedulerService.start();

        httpServer.listen(env.PORT, () => {
            console.log(`🚀 Server running on port ${env.PORT} (${env.NODE_ENV})`);
            console.log(`🏥 Health check: http://localhost:${env.PORT}/api/health`);
            console.log(`🔌 Socket.io ready — JWT required in the handshake`);
            console.log(`🌐 Allowed origins: ${env.allowedOrigins.join(', ')}`);
            if (!env.emailEnabled) console.log('✉️  Email disabled (no SMTP or Resend key)');
            if (!env.muxEnabled) console.log('📼 Uploads disabled (no Mux credentials)');
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

// Never leave the process in a half-dead state after an unhandled rejection.
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled promise rejection:', reason);
});

const shutdown = (signal: string) => {
    console.log(`\n${signal} received, shutting down.`);
    io.close();
    httpServer.close(() => process.exit(0));
    // Force exit if connections refuse to drain.
    setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startServer();

export default app;
