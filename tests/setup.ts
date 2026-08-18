import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

/**
 * A real in-memory store rather than bare `vi.fn()` stubs. The session helpers
 * write and then read back, which silent no-op stubs cannot model — every
 * assertion about persisted state would pass vacuously.
 */
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  clear() {
    this.store.clear();
  }

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
}

Object.defineProperty(window, 'localStorage', {
  value: new MemoryStorage(),
  writable: true,
});

Object.defineProperty(window, 'RTCPeerConnection', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    close: vi.fn(),
    createOffer: vi.fn().mockResolvedValue({ type: 'offer', sdp: 'mock-sdp' }),
    createAnswer: vi.fn().mockResolvedValue({ type: 'answer', sdp: 'mock-sdp' }),
    setLocalDescription: vi.fn().mockResolvedValue(undefined),
    setRemoteDescription: vi.fn().mockResolvedValue(undefined),
    addIceCandidate: vi.fn().mockResolvedValue(undefined),
    addTrack: vi.fn(),
    onicecandidate: null,
    ontrack: null,
    onconnectionstatechange: null,
  })),
});

Object.defineProperty(window, 'RTCSessionDescription', {
  writable: true,
  value: vi.fn().mockImplementation((init) => init),
});

Object.defineProperty(window, 'RTCIceCandidate', {
  writable: true,
  value: vi.fn().mockImplementation((init) => init),
});

Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn(), enabled: true }],
      getAudioTracks: () => [{ stop: vi.fn(), enabled: true }],
      getVideoTracks: () => [{ stop: vi.fn(), enabled: true }],
    }),
  },
});
