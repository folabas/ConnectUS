import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
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
    onicecandidate: null,
    ontrack: null,
    onconnectionstatechange: null,
  })),
});

Object.defineProperty(window, 'RTCSessionDescription', {
  writable: true,
  value: vi.fn().mockImplementation((descriptionInitDict) => descriptionInitDict),
});

Object.defineProperty(window, 'RTCIceCandidate', {
  writable: true,
  value: vi.fn().mockImplementation((candidateInitDict) => candidateInitDict),
});

Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: vi.fn().mockReturnValue([
        { stop: vi.fn(), enabled: true },
        { stop: vi.fn(), enabled: true },
      ]),
      getAudioTracks: vi.fn().mockReturnValue([{ stop: vi.fn(), enabled: true }]),
      getVideoTracks: vi.fn().mockReturnValue([{ stop: vi.fn(), enabled: true }]),
    }),
  },
  writable: true,
});
