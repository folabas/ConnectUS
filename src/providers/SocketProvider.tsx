'use client';

/**
 * One authenticated socket for the whole app.
 *
 * Two problems in the previous singleton this fixes:
 *   - identity was whatever `userId` the client emitted, so any connected socket
 *     could join any room or speak as any user. The token now travels in the
 *     handshake and the server derives identity from it.
 *   - `off(event)` removed *every* listener for that event, so one component
 *     unmounting silently deafened the others. `useSocketEvent` removes only its
 *     own handler.
 */

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { session } from '@/lib/api';
import type { ClientEvents, ServerEvents } from '@/lib/socket-events';
import { useAuth } from '@/providers/AuthProvider';

export type AppSocket = Socket<ServerEvents, ClientEvents>;

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface SocketContextValue {
  socket: AppSocket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextValue>({ socket: null, connected: false });

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const [socket, setSocket] = useState<AppSocket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // No setState on this path: the cleanup from the previous run has already
    // cleared the socket, so setting it again here would only cascade a render.
    if (!isAuthenticated || !user) return;

    const token = session.getToken();
    if (!token) return;

    const instance: AppSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
    });

    instance.on('connect', () => setConnected(true));
    instance.on('disconnect', () => setConnected(false));
    instance.on('connect_error', (error) => {
      setConnected(false);
      console.error('Socket connection failed:', error.message);
    });

    setSocket(instance);

    return () => {
      instance.removeAllListeners();
      instance.disconnect();
      setSocket(null);
      setConnected(false);
    };
    // Re-connect when the signed-in identity changes, not on every user field
    // edit — depending on `user` itself would tear the socket down on a profile
    // rename.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.userId]);

  const value = useMemo(() => ({ socket, connected }), [socket, connected]);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket(): SocketContextValue {
  return useContext(SocketContext);
}

/**
 * Subscribe to one server event for the lifetime of the calling component.
 *
 * The handler is held in a ref so callers can pass an inline closure without
 * resubscribing on every render.
 */
export function useSocketEvent<E extends keyof ServerEvents>(
  event: E,
  handler: ServerEvents[E],
) {
  const { socket } = useSocket();
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!socket) return;
    const listener = ((...args: unknown[]) =>
      (handlerRef.current as (...a: unknown[]) => void)(...args)) as ServerEvents[E];

    socket.on(event, listener as never);
    return () => {
      socket.off(event, listener as never);
    };
  }, [socket, event]);
}
