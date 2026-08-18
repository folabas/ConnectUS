/**
 * Application assembly, separated from process startup.
 *
 * `server.ts` used to build the app and start listening in the same module, so
 * importing anything from it booted a server and connected to the database as a
 * side effect. That made the app untestable in-process: a test could not get an
 * instance without also taking over the port. This module builds and returns;
 * starting is someone else's job.
 */

import express, { Application, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer, Server as HttpServer } from 'http';
import { Server as IOServer } from 'socket.io';

import { env } from './config/env';
import authRoutes from './routes/authRoutes';
import movieRoutes from './routes/movieRoutes';
import roomRoutes from './routes/roomRoutes';
import friendRoutes from './routes/friendRoutes';
import notificationRoutes from './routes/notificationRoutes';
import { apiLimiter } from './middleware/rateLimit';
import { registerSocketHandlers } from './sockets';

export interface AppBundle {
    app: Application;
    httpServer: HttpServer;
    io: IOServer;
}

export function createApp(): AppBundle {
    const app: Application = express();
    const httpServer = createServer(app);

    const io = new IOServer(httpServer, {
        cors: { origin: env.allowedOrigins, methods: ['GET', 'POST'], credentials: true },
    });

    app.set('io', io);

    // Behind a proxy the client IP arrives in X-Forwarded-For; without this the
    // rate limiter buckets every request under the proxy's own address.
    app.set('trust proxy', 1);

    app.use(
        helmet({
            // The API serves JSON only.
            crossOriginEmbedderPolicy: false,
            contentSecurityPolicy: false,
        }),
    );
    app.use(
        cors({
            origin: env.allowedOrigins,
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            credentials: true,
            allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
        }),
    );
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: true, limit: '1mb' }));

    registerSocketHandlers(io);

    // Health sits above the rate limiter so an uptime probe cannot be throttled.
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
            // Internal messages can carry stack details and query fragments.
            message: env.isProduction
                ? 'Internal server error'
                : err.message || 'Internal server error',
        });
    });

    return { app, httpServer, io };
}
