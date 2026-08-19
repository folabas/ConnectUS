'use client';

/**
 * Keeps one `<video>` element in step with the rest of the room.
 *
 * The PRD asks for playback within 500ms across participants. Two things make
 * that hard, and both are handled here:
 *
 *   1. **Echo.** Applying a remote seek fires the element's own `seeking` event.
 *      Without suppression the follower would broadcast that back and the room
 *      would oscillate. `applyingRemote` gates outbound emits while a remote
 *      change is being applied.
 *   2. **Latency.** A `currentTime` that was true when the host sent it is stale
 *      by the time it arrives. Payloads carry `emittedAt`, so followers add the
 *      elapsed time before seeking.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useSocket, useSocketEvent } from '@/providers/SocketProvider';

/** Don't correct drift smaller than this — micro-seeks are more jarring than drift. */
const DRIFT_TOLERANCE_SECONDS = 0.75;

/** How long after applying a remote change we ignore local events. */
const ECHO_WINDOW_MS = 400;

interface Options {
  roomId: string;
  /** This client drives playback (host, or a room with host control disabled). */
  canControl: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /**
   * Called when the browser refuses to start playback without a gesture.
   *
   * Followers have no controls of their own, so a silently swallowed rejection
   * left them staring at a paused frame with no way to start it. The caller
   * uses this to put a tap target on screen.
   */
  onAutoplayBlocked?(blocked: boolean): void;
}

export function usePlaybackSync({
  roomId,
  canControl,
  videoRef,
  onAutoplayBlocked,
}: Options) {
  const { socket } = useSocket();
  const applyingRemote = useRef(false);

  // Held in a ref so the effects below do not resubscribe when the caller
  // passes a fresh closure on every render.
  const blockedRef = useRef(onAutoplayBlocked);
  useEffect(() => {
    blockedRef.current = onAutoplayBlocked;
  });

  const suppressEcho = useCallback(() => {
    applyingRemote.current = true;
    setTimeout(() => {
      applyingRemote.current = false;
    }, ECHO_WINDOW_MS);
  }, []);

  /**
   * Start playback, reporting a refusal rather than swallowing it.
   *
   * Browsers block unmuted playback that no gesture asked for. Followers have
   * no controls of their own, so a swallowed rejection stranded them on a
   * paused frame with no way out.
   */
  const attemptPlay = useCallback(
    (video: HTMLVideoElement) => {
      suppressEcho();
      video
        .play()
        .then(() => blockedRef.current?.(false))
        .catch(() => blockedRef.current?.(true));
    },
    [suppressEcho],
  );

  /** Seek, compensating for the time the message spent in flight. */
  const applyRemoteTime = useCallback(
    (currentTime: number, emittedAt: number, playing: boolean) => {
      const video = videoRef.current;
      if (!video) return;

      const latencySeconds = emittedAt ? Math.max(0, (Date.now() - emittedAt) / 1000) : 0;
      const target = currentTime + (playing ? latencySeconds : 0);

      if (Math.abs(video.currentTime - target) > DRIFT_TOLERANCE_SECONDS) {
        suppressEcho();
        video.currentTime = target;
      }
    },
    [videoRef, suppressEcho],
  );

  /* ------------------------------------------------------------------ */
  /* Inbound                                                            */
  /* ------------------------------------------------------------------ */

  useSocketEvent('video-play', (payload) => {
    if (payload.roomId !== roomId) return;
    const video = videoRef.current;
    if (!video) return;
    applyRemoteTime(payload.currentTime, payload.emittedAt, true);
    if (video.paused) attemptPlay(video);
  });

  useSocketEvent('video-pause', (payload) => {
    if (payload.roomId !== roomId) return;
    const video = videoRef.current;
    if (!video) return;
    suppressEcho();
    video.pause();
    applyRemoteTime(payload.currentTime, payload.emittedAt, false);
  });

  useSocketEvent('video-seek', (payload) => {
    if (payload.roomId !== roomId) return;
    applyRemoteTime(payload.currentTime, payload.emittedAt, !videoRef.current?.paused);
  });

  // A newcomer asks where everyone is; whoever can control answers.
  useSocketEvent('video-sync-request', (payload) => {
    if (payload.roomId !== roomId || !canControl || !socket) return;
    const video = videoRef.current;
    if (!video) return;
    socket.emit('video-sync-response', {
      roomId,
      targetSocketId: payload.requesterSocketId,
      currentTime: video.currentTime,
      paused: video.paused,
    });
  });

  useSocketEvent('video-sync-response', (payload) => {
    if (payload.roomId !== roomId) return;
    const video = videoRef.current;
    if (!video) return;

    applyRemoteTime(payload.currentTime, payload.emittedAt, !payload.paused);

    // A late joiner never receives the original video-play — it fired before
    // they arrived — so without this they synced the position and then sat on a
    // paused frame indefinitely.
    if (!payload.paused && video.paused) attemptPlay(video);
    if (payload.paused && !video.paused) {
      suppressEcho();
      video.pause();
    }
  });

  /* ------------------------------------------------------------------ */
  /* Outbound                                                           */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !socket || !canControl) return;

    const emit = (event: 'video-play' | 'video-pause' | 'video-seek') => () => {
      if (applyingRemote.current) return;
      socket.emit(event, { roomId, currentTime: video.currentTime });
    };

    const onPlay = emit('video-play');
    const onPause = emit('video-pause');
    const onSeeked = emit('video-seek');

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('seeked', onSeeked);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('seeked', onSeeked);
    };
  }, [socket, canControl, roomId, videoRef]);

  /** Ask the room for the current position — called once on arrival. */
  const requestSync = useCallback(() => {
    if (!socket || canControl) return;
    socket.emit('video-sync-request', { roomId });
  }, [socket, canControl, roomId]);

  return { requestSync };
}
