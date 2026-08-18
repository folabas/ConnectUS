/**
 * Shared test scaffolding: boot a real server on an ephemeral port, register
 * real users, and open authenticated sockets against it.
 */

import mongoose from 'mongoose';
import { io as connectClient, type Socket } from 'socket.io-client';
import type { AddressInfo } from 'net';
import { createApp } from '../src/app';

export interface TestServer {
    baseUrl: string;
    close(): Promise<void>;
}

/** Boot the app on port 0 so parallel runs cannot collide. */
export async function startTestServer(): Promise<TestServer> {
    const { httpServer, io } = createApp();

    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const { port } = httpServer.address() as AddressInfo;

    return {
        baseUrl: `http://127.0.0.1:${port}`,
        close: () =>
            new Promise<void>((resolve) => {
                io.close();
                httpServer.close(() => resolve());
            }),
    };
}

export async function connectDatabase() {
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGODB_URI as string);
    }
}

/** Drop every collection so each file starts from a known state. */
export async function resetDatabase() {
    const { db } = mongoose.connection;
    if (!db) return;
    const collections = await db.listCollections().toArray();
    await Promise.all(
        collections.map((c) => db.collection(c.name).deleteMany({})),
    );
}

export async function disconnectDatabase() {
    await mongoose.disconnect();
}

export interface ApiResult<T = any> {
    status: number;
    body: T & { success?: boolean; message?: string; data?: any; [key: string]: any };
}

export function apiClient(baseUrl: string) {
    return async function api<T = any>(
        path: string,
        options: { method?: string; body?: unknown; token?: string } = {},
    ): Promise<ApiResult<T>> {
        const response = await fetch(`${baseUrl}${path}`, {
            method: options.method ?? 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
            },
            body: options.body === undefined ? undefined : JSON.stringify(options.body),
        });

        const text = await response.text();
        let body: any = null;
        if (text) {
            try {
                body = JSON.parse(text);
            } catch {
                body = text;
            }
        }
        return { status: response.status, body };
    };
}

export interface TestUser {
    userId: string;
    email: string;
    fullName: string;
    token: string;
}

let userCounter = 0;

export async function registerUser(
    api: ReturnType<typeof apiClient>,
    name = 'Test User',
): Promise<TestUser> {
    const email = `user-${Date.now()}-${(userCounter += 1)}@test.local`;
    const result = await api('/api/auth/register', {
        method: 'POST',
        body: { email, password: 'test-password-1234', fullName: name },
    });
    if (!result.body?.data?.token) {
        throw new Error(`registerUser failed: ${JSON.stringify(result.body)}`);
    }
    return { ...result.body.data, fullName: name };
}

/** Open a socket, resolving with the error message if the handshake is refused. */
export function openSocket(
    baseUrl: string,
    token?: string,
): Promise<{ socket: Socket; error?: string }> {
    return new Promise((resolve) => {
        const socket = connectClient(baseUrl, {
            auth: token ? { token } : {},
            transports: ['websocket'],
            reconnection: false,
        });
        socket.on('connect', () => resolve({ socket }));
        socket.on('connect_error', (error) => resolve({ socket, error: error.message }));
    });
}

/** Resolve with the first payload for `event`, or null after `ms`. */
export function waitFor<T = any>(socket: Socket, event: string, ms = 3000): Promise<T | null> {
    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            socket.off(event, handler);
            resolve(null);
        }, ms);
        const handler = (payload: T) => {
            clearTimeout(timer);
            socket.off(event, handler);
            resolve(payload);
        };
        socket.on(event, handler);
    });
}

/** Collect every payload for `event` over `ms`. */
export function collect<T = any>(socket: Socket, event: string, ms = 700): Promise<T[]> {
    const seen: T[] = [];
    const handler = (payload: T) => seen.push(payload);
    socket.on(event, handler);
    return new Promise((resolve) =>
        setTimeout(() => {
            socket.off(event, handler);
            resolve(seen);
        }, ms),
    );
}

/** Emit with an acknowledgement, timing out rather than hanging the suite. */
export function emitWithAck<T = any>(
    socket: Socket,
    event: string,
    payload: unknown,
    ms = 5000,
): Promise<T | null> {
    return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(null), ms);
        socket.emit(event, payload, (result: T) => {
            clearTimeout(timer);
            resolve(result);
        });
    });
}

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A movie to build rooms around. */
export async function seedMovie() {
    const { Movie } = await import('../src/models/Movie');
    return Movie.create({
        title: 'Test Feature',
        image: 'https://example.test/poster.jpg',
        duration: '1h 30m',
        rating: '7.5',
        genre: 'Drama',
        videoUrl: 'https://example.test/video.mp4',
        source: 'archive',
    });
}

export async function createRoom(
    api: ReturnType<typeof apiClient>,
    token: string,
    movieId: string,
    overrides: Record<string, unknown> = {},
) {
    const result = await api('/api/rooms', {
        method: 'POST',
        token,
        body: {
            name: 'Test Room',
            movieId,
            type: 'public',
            theme: { primary: '#695CFF', secondary: '#8B7FFF', name: 'Purple Dream' },
            maxParticipants: 4,
            adminEnabled: true,
            approvalRequired: false,
            ...overrides,
        },
    });
    if (!result.body?.data?._id) {
        throw new Error(`createRoom failed: ${JSON.stringify(result.body)}`);
    }
    return result.body.data;
}
