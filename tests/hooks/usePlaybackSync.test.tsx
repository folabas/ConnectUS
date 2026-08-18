import { createRef } from 'react';
import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlaybackSync } from '@/hooks/usePlaybackSync';

/**
 * A minimal socket stand-in that lets a test deliver a server event and inspect
 * what the hook emitted back.
 */
function createSocketStub() {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  const emit = vi.fn();

  return {
    emit,
    on(event: string, handler: (payload: unknown) => void) {
      const set = listeners.get(event) ?? new Set();
      set.add(handler);
      listeners.set(event, set);
    },
    off(event: string, handler: (payload: unknown) => void) {
      listeners.get(event)?.delete(handler);
    },
    /** Deliver a server event to every current subscriber. */
    deliver(event: string, payload: unknown) {
      listeners.get(event)?.forEach((handler) => handler(payload));
    },
    listenerCount(event: string) {
      return listeners.get(event)?.size ?? 0;
    },
  };
}

const socketStub = createSocketStub();

vi.mock('@/providers/SocketProvider', async () => {
  const react = await import('react');
  return {
    useSocket: () => ({ socket: socketStub, connected: true }),
    // Mirrors the real hook: one handler per component, removed on unmount.
    useSocketEvent: (event: string, handler: (payload: unknown) => void) => {
      const ref = react.useRef(handler);
      react.useEffect(() => {
        ref.current = handler;
      });
      react.useEffect(() => {
        const listener = (payload: unknown) => ref.current(payload);
        socketStub.on(event, listener);
        return () => socketStub.off(event, listener);
      }, [event]);
    },
  };
});

/** A video element with just the surface the hook touches. */
function createVideo(overrides: Partial<HTMLVideoElement> = {}) {
  const handlers = new Map<string, EventListener>();
  const video = {
    currentTime: 0,
    paused: true,
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(function (this: any) {
      this.paused = true;
    }),
    addEventListener: (event: string, handler: EventListener) => handlers.set(event, handler),
    removeEventListener: (event: string) => handlers.delete(event),
    /** Fire a DOM event the way the browser would. */
    fire: (event: string) => handlers.get(event)?.(new Event(event)),
    ...overrides,
  };
  return video as unknown as HTMLVideoElement & { fire(event: string): void };
}

const ROOM_ID = 'room-1';

function render(video: HTMLVideoElement, canControl: boolean) {
  const ref = createRef<HTMLVideoElement>();
  (ref as { current: HTMLVideoElement | null }).current = video;
  const result = renderHook(() =>
    usePlaybackSync({ roomId: ROOM_ID, canControl, videoRef: ref }),
  );
  return result;
}

describe('usePlaybackSync', () => {
  beforeEach(() => {
    socketStub.emit.mockReset();
    vi.useRealTimers();
  });

  describe('as a follower', () => {
    it('seeks to the host position on video-seek', () => {
      const video = createVideo({ currentTime: 10 });
      render(video, false);

      act(() => {
        socketStub.deliver('video-seek', {
          roomId: ROOM_ID,
          currentTime: 120,
          emittedAt: Date.now(),
        });
      });

      expect(video.currentTime).toBeCloseTo(120, 0);
    });

    it('adds the message latency when playback is running', () => {
      // The host's position was true when sent; by arrival it has advanced.
      const video = createVideo({ currentTime: 0, paused: false });
      render(video, false);

      act(() => {
        socketStub.deliver('video-play', {
          roomId: ROOM_ID,
          currentTime: 100,
          emittedAt: Date.now() - 2000,
        });
      });

      expect(video.currentTime).toBeGreaterThanOrEqual(101.5);
      expect(video.currentTime).toBeLessThanOrEqual(102.5);
    });

    it('does not add latency to a pause, which has no forward motion', () => {
      const video = createVideo({ currentTime: 0, paused: false });
      render(video, false);

      act(() => {
        socketStub.deliver('video-pause', {
          roomId: ROOM_ID,
          currentTime: 100,
          emittedAt: Date.now() - 2000,
        });
      });

      expect(video.currentTime).toBeCloseTo(100, 1);
    });

    it('ignores drift under the tolerance rather than micro-seeking', () => {
      const video = createVideo({ currentTime: 100.2 });
      render(video, false);

      act(() => {
        socketStub.deliver('video-seek', {
          roomId: ROOM_ID,
          currentTime: 100,
          emittedAt: Date.now(),
        });
      });

      expect(video.currentTime).toBe(100.2);
    });

    it('ignores events addressed to a different room', () => {
      const video = createVideo({ currentTime: 5 });
      render(video, false);

      act(() => {
        socketStub.deliver('video-seek', {
          roomId: 'someone-elses-room',
          currentTime: 900,
          emittedAt: Date.now(),
        });
      });

      expect(video.currentTime).toBe(5);
    });

    it('never emits playback events', () => {
      const video = createVideo();
      render(video, false);

      act(() => {
        video.fire('play');
        video.fire('seeked');
      });

      expect(socketStub.emit).not.toHaveBeenCalled();
    });

    it('requests the current position on arrival', () => {
      const video = createVideo();
      const { result } = render(video, false);

      act(() => result.current.requestSync());

      expect(socketStub.emit).toHaveBeenCalledWith('video-sync-request', {
        roomId: ROOM_ID,
      });
    });
  });

  describe('as a controller', () => {
    it('broadcasts local play, pause and seek', () => {
      const video = createVideo({ currentTime: 42 });
      render(video, true);

      act(() => {
        video.fire('play');
        video.fire('pause');
        video.fire('seeked');
      });

      expect(socketStub.emit).toHaveBeenCalledWith('video-play', {
        roomId: ROOM_ID,
        currentTime: 42,
      });
      expect(socketStub.emit).toHaveBeenCalledWith('video-pause', {
        roomId: ROOM_ID,
        currentTime: 42,
      });
      expect(socketStub.emit).toHaveBeenCalledWith('video-seek', {
        roomId: ROOM_ID,
        currentTime: 42,
      });
    });

    it('does not rebroadcast a seek it applied from the network', () => {
      // Without echo suppression the applied remote seek fires the element's own
      // `seeked` event, the controller broadcasts it back, and the room
      // oscillates.
      const video = createVideo({ currentTime: 0 });
      render(video, true);

      act(() => {
        socketStub.deliver('video-seek', {
          roomId: ROOM_ID,
          currentTime: 300,
          emittedAt: Date.now(),
        });
        video.fire('seeked');
      });

      expect(socketStub.emit).not.toHaveBeenCalledWith(
        'video-seek',
        expect.anything(),
      );
    });

    it('answers a sync request with its current position', () => {
      const video = createVideo({ currentTime: 77 });
      render(video, true);

      act(() => {
        socketStub.deliver('video-sync-request', {
          roomId: ROOM_ID,
          requesterSocketId: 'socket-9',
        });
      });

      expect(socketStub.emit).toHaveBeenCalledWith('video-sync-response', {
        roomId: ROOM_ID,
        targetSocketId: 'socket-9',
        currentTime: 77,
      });
    });

    it('does not ask the room for a position it already owns', () => {
      const video = createVideo();
      const { result } = render(video, true);

      act(() => result.current.requestSync());

      expect(socketStub.emit).not.toHaveBeenCalled();
    });
  });

  it('removes its listeners on unmount', () => {
    const video = createVideo();
    const { unmount } = render(video, false);

    expect(socketStub.listenerCount('video-seek')).toBe(1);
    unmount();
    expect(socketStub.listenerCount('video-seek')).toBe(0);
  });
});
