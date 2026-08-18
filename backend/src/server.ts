// Environment must load and validate before anything reads process.env.
import dotenv from 'dotenv';
dotenv.config();

import { env } from './config/env';
import { createApp } from './app';
import { connectDB } from './config/database';
import { schedulerService } from './services/schedulerService';

const { app, httpServer, io } = createApp();

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
