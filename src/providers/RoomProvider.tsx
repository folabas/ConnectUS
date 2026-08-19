'use client';

/**
 * Everything about "the room I am currently in", keyed off the URL.
 *
 * The old flow stored `currentRoomId` in localStorage and hoped `/waiting-room`
 * and `/watch` would agree about which room that was. Consequences: no deep
 * links, no two rooms in two tabs, and a refresh could land you in a stale room.
 * The room id now comes from the route, and this provider is the single owner of
 * room state for that route subtree.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { errorMessage, roomApi } from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';
import { useSocket, useSocketEvent } from '@/providers/SocketProvider';
import { isHost as computeIsHost, type JoinRequest, type Room } from '@/types';

type RoomPhase =
  | 'loading'
  /** Present in the room and admitted. */
  | 'member'
  /** Waiting for the host to approve. */
  | 'pending-approval'
  /** The host said no, or the room is gone/full. */
  | 'denied'
  | 'error';

interface RoomContextValue {
  room: Room | null;
  phase: RoomPhase;
  error: string | null;
  isHost: boolean;
  /** Join requests still awaiting a decision. Host-only; empty for everyone else. */
  pendingRequests: JoinRequest[];
  refresh(): Promise<void>;
  requestToJoin(): Promise<void>;
  approve(userId: string): Promise<void>;
  reject(userId: string): Promise<void>;
  start(): Promise<void>;
  end(): Promise<void>;
  leave(transferTo?: string): Promise<void>;
}

const RoomContext = createContext<RoomContextValue | null>(null);

export function RoomProvider({
  roomId,
  children,
}: {
  roomId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { socket, connected } = useSocket();

  const [room, setRoom] = useState<Room | null>(null);
  const [phase, setPhase] = useState<RoomPhase>('loading');
  const [error, setError] = useState<string | null>(null);

  const isHost = computeIsHost(room, user?.userId);

  /** Set once we have joined the socket room, so reconnects can re-join. */
  const joinedRef = useRef(false);

  // Read inside `load` without making it a dependency, which would re-run the
  // join every time the user object is replaced.
  const userIdRef = useRef(user?.userId);
  useEffect(() => {
    userIdRef.current = user?.userId;
  }, [user?.userId]);

  /* ---------------------------------------------------------------------- */
  /* Initial load                                                           */
  /* ---------------------------------------------------------------------- */

  const load = useCallback(async () => {
    try {
      const result = await roomApi.join({ roomId });
      setRoom(result.room);
      setError(null);

      if (!result.requiresApproval) {
        setPhase('member');
        return;
      }

      setPhase('pending-approval');

      // Arriving at a gated room *is* asking to come in. Previously this only
      // set the waiting state: the guest saw "waiting for the host" while no
      // request had been created and the host had nothing to approve, so both
      // ends appeared broken. Sending it is idempotent, so a refresh while
      // already pending is harmless.
      const alreadyAsked = result.room.joinRequests?.some(
        (request) =>
          (typeof request.user === 'string' ? request.user : request.user?._id) ===
            userIdRef.current && request.status === 'pending',
      );

      if (!alreadyAsked) {
        try {
          await roomApi.requestToJoin(roomId);
        } catch (err) {
          // A rejected requester cannot ask again; show why rather than
          // leaving them on a waiting screen that will never resolve.
          setError(errorMessage(err));
          setPhase('denied');
        }
      }
    } catch (err) {
      setError(errorMessage(err));
      setPhase('error');
    }
  }, [roomId]);

  useEffect(() => {
    // Fetch-on-mount: the room request is the external system this effect
    // synchronises with, and every setState inside `load` runs after an await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    try {
      setRoom(await roomApi.get(roomId));
    } catch {
      // Keep the last good snapshot rather than blanking the UI mid-session.
    }
  }, [roomId]);

  /* ---------------------------------------------------------------------- */
  /* Socket room membership                                                 */
  /* ---------------------------------------------------------------------- */

  // Join the socket room only once admitted. A user awaiting approval must not
  // be in the broadcast room — otherwise they would receive chat and playback
  // for a session they have not been let into.
  useEffect(() => {
    if (!socket || !connected || phase !== 'member') return;

    socket.emit('join-room', roomId, (result) => {
      if (result?.ok === false) {
        setError(result.error || 'Could not join this room.');
        setPhase('error');
        return;
      }
      joinedRef.current = true;
    });

    return () => {
      if (joinedRef.current) {
        socket.emit('leave-room', roomId);
        joinedRef.current = false;
      }
    };
  }, [socket, connected, phase, roomId]);

  /* ---------------------------------------------------------------------- */
  /* Actions                                                                */
  /* ---------------------------------------------------------------------- */

  const requestToJoin = useCallback(async () => {
    try {
      await roomApi.requestToJoin(roomId);
      setPhase('pending-approval');
      toast.success('Request sent. Waiting for the host.');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }, [roomId]);

  const approve = useCallback(
    async (userId: string) => {
      try {
        setRoom(await roomApi.approveRequest(roomId, userId));
      } catch (err) {
        toast.error(errorMessage(err));
      }
    },
    [roomId],
  );

  const reject = useCallback(
    async (userId: string) => {
      try {
        await roomApi.rejectRequest(roomId, userId);
        await refresh();
      } catch (err) {
        toast.error(errorMessage(err));
      }
    },
    [roomId, refresh],
  );

  const start = useCallback(async () => {
    try {
      const started = await roomApi.start(roomId);
      setRoom(started);
      router.push(`/room/${roomId}/watch`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }, [roomId, router]);

  const end = useCallback(async () => {
    try {
      await roomApi.end(roomId);
      router.push('/library');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }, [roomId, router]);

  const leave = useCallback(
    async (transferTo?: string) => {
      try {
        await roomApi.leave(roomId, transferTo);
      } catch (err) {
        // A host who has not named a successor must not be quietly dropped out
        // of a room they still own — surface it instead.
        toast.error(errorMessage(err));
        throw err;
      }
      router.push('/library');
    },
    [roomId, router],
  );

  /* ---------------------------------------------------------------------- */
  /* Live updates                                                           */
  /* ---------------------------------------------------------------------- */

  useSocketEvent('room-updated', (payload) => {
    if (payload.roomId !== roomId) return;
    setRoom((current) =>
      current
        ? {
            ...current,
            participants: payload.participants,
            host: payload.host,
            movie: payload.movie,
            status: payload.status,
          }
        : current,
    );
  });

  useSocketEvent('room-started', (payload) => {
    if (payload.roomId !== roomId) return;
    setRoom(payload.room);
    router.push(`/room/${roomId}/watch`);
  });

  useSocketEvent('room-ended', (payload) => {
    if (payload.roomId !== roomId) return;
    toast.info(payload.message || 'The host ended this session.');
    router.push('/library');
  });

  // Host-side: someone is asking to be let in.
  useSocketEvent('join-request-received', (payload) => {
    if (payload.roomId !== roomId) return;
    void refresh();
    toast.info(`${payload.user.fullName || 'Someone'} wants to join`, {
      action: {
        label: 'Approve',
        onClick: () => void approve(payload.user._id),
      },
    });
  });

  // Requester-side. These arrive on the user's personal channel rather than the
  // room channel, because a pending user is deliberately not in the room yet.
  useSocketEvent('join-request-approved', (payload) => {
    if (payload.roomId !== roomId) return;
    setRoom(payload.room);
    setPhase('member');
    toast.success('The host let you in.');
  });

  useSocketEvent('join-request-rejected', (payload) => {
    if (payload.roomId !== roomId) return;
    setPhase('denied');
    setError(payload.message || 'The host declined your request to join.');
  });

  // The previous host handed over and left.
  useSocketEvent('host-changed', (payload) => {
    if (payload.roomId !== roomId) return;
    setRoom((current) => (current ? { ...current, host: payload.host } : current));

    const inherited = payload.host?._id === userIdRef.current;
    toast.info(
      inherited
        ? 'You are the host now — the room is yours.'
        : `${payload.host?.fullName ?? 'Someone else'} is hosting now.`,
    );
  });

  useSocketEvent('server-error', (payload) => {
    toast.error(payload.message);
  });

  const pendingRequests = useMemo(
    () => (isHost ? (room?.joinRequests ?? []).filter((r) => r.status === 'pending') : []),
    [isHost, room?.joinRequests],
  );

  const value = useMemo<RoomContextValue>(
    () => ({
      room,
      phase,
      error,
      isHost,
      pendingRequests,
      refresh,
      requestToJoin,
      approve,
      reject,
      start,
      end,
      leave,
    }),
    [
      room,
      phase,
      error,
      isHost,
      pendingRequests,
      refresh,
      requestToJoin,
      approve,
      reject,
      start,
      end,
      leave,
    ],
  );

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoom(): RoomContextValue {
  const context = useContext(RoomContext);
  if (!context) throw new Error('useRoom must be used inside <RoomProvider>');
  return context;
}
