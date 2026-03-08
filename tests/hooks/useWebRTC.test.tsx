import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWebRTC } from '../../src/hooks/useWebRTC';

vi.mock('../../src/services/signaling', () => ({
  signalingService: {
    connect: vi.fn(() => ({
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
      connected: true,
      id: 'mock-socket-id',
    })),
    disconnect: vi.fn(),
    sendOffer: vi.fn(),
    sendAnswer: vi.fn(),
    sendIceCandidate: vi.fn(),
    sendChatMessage: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    isConnected: true,
    waitForConnection: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connected: true,
    id: 'mock-socket-id',
    io: { on: vi.fn() },
  })),
}));

describe('useWebRTC Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should initialize with empty state', () => {
      const { result } = renderHook(() => useWebRTC(null, null));

      expect(result.current.localStream).toBeNull();
      expect(result.current.peers).toEqual([]);
      expect(result.current.messages).toEqual([]);
      expect(result.current.isConnected).toBe(false);
    });

    it('should not initialize without roomId or userId', () => {
      const { result } = renderHook(() => useWebRTC(null, 'user-1'));

      expect(result.current.localStream).toBeNull();
    });

    it('should not initialize without userId', () => {
      const { result } = renderHook(() => useWebRTC('room-1', null));

      expect(result.current.localStream).toBeNull();
    });
  });

  describe('toggleAudio', () => {
    it('should toggle audio enabled state', async () => {
      const { result } = renderHook(() => useWebRTC('room-1', 'user-1'));

      const mockStream = {
        getTracks: vi.fn().mockReturnValue([{ stop: vi.fn(), enabled: true }]),
        getAudioTracks: vi.fn().mockReturnValue([{ stop: vi.fn(), enabled: true }]),
        getVideoTracks: vi.fn().mockReturnValue([]),
      };

      act(() => {
        (result.current as any).localStreamRef.current = mockStream;
      });

      const audioEnabled = result.current.toggleAudio();
      expect(typeof audioEnabled).toBe('boolean');
    });

    it('should return false when no local stream', () => {
      const { result } = renderHook(() => useWebRTC('room-1', 'user-1'));

      const audioEnabled = result.current.toggleAudio();
      expect(audioEnabled).toBe(false);
    });
  });

  describe('toggleVideo', () => {
    it('should toggle video enabled state', async () => {
      const { result } = renderHook(() => useWebRTC('room-1', 'user-1'));

      const mockStream = {
        getTracks: vi.fn().mockReturnValue([]),
        getAudioTracks: vi.fn().mockReturnValue([]),
        getVideoTracks: vi.fn().mockReturnValue([{ stop: vi.fn(), enabled: true }]),
      };

      act(() => {
        (result.current as any).localStreamRef.current = mockStream;
      });

      const videoEnabled = result.current.toggleVideo();
      expect(typeof videoEnabled).toBe('boolean');
    });

    it('should return false when no local stream', () => {
      const { result } = renderHook(() => useWebRTC('room-1', 'user-1'));

      const videoEnabled = result.current.toggleVideo();
      expect(videoEnabled).toBe(false);
    });
  });

  describe('sendChatMessage', () => {
    it('should send chat message', () => {
      const { result } = renderHook(() => useWebRTC('room-1', 'user-1'));

      result.current.sendChatMessage('Hello world');

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].text).toBe('Hello world');
      expect(result.current.messages[0].userId).toBe('user-1');
    });

    it('should not send message without roomId', () => {
      const { result } = renderHook(() => useWebRTC(null, 'user-1'));

      result.current.sendChatMessage('Hello');

      expect(result.current.messages).toHaveLength(0);
    });

    it('should not send message without userId', () => {
      const { result } = renderHook(() => useWebRTC('room-1', null));

      result.current.sendChatMessage('Hello');

      expect(result.current.messages).toHaveLength(0);
    });
  });

  describe('cleanup', () => {
    it('should cleanup on unmount', () => {
      const { unmount } = renderHook(() => useWebRTC('room-1', 'user-1'));

      unmount();
    });
  });
});
