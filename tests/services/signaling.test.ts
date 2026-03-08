import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signalingService } from '../../src/services/signaling';

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connected: false,
    id: 'mock-socket-id',
  })),
}));

describe('Signaling Service', () => {
  let mockSocket: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
      connected: true,
      id: 'mock-socket-id',
      io: {
        on: vi.fn(),
      },
    };
    (signalingService as any).socket = null;
    (signalingService as any).currentRoomId = null;
    (signalingService as any).currentUserId = null;
  });

  describe('connect', () => {
    it('should create a socket connection', () => {
      const socket = signalingService.connect();
      expect(socket).toBeDefined();
    });

    it('should return existing socket if already connected', () => {
      const socket1 = signalingService.connect();
      const socket2 = signalingService.connect();
      expect(socket1).toBe(socket2);
    });
  });

  describe('disconnect', () => {
    it('should disconnect the socket', () => {
      signalingService.connect();
      signalingService.disconnect();
      expect((signalingService as any).socket).toBeNull();
    });

    it('should emit leave-room before disconnecting', () => {
      (signalingService as any).currentRoomId = 'room-1';
      (signalingService as any).currentUserId = 'user-1';
      
      signalingService.connect();
      signalingService.disconnect();
      
      expect((signalingService as any).socket).toBeNull();
      expect((signalingService as any).currentRoomId).toBeNull();
    });
  });

  describe('joinRoom', () => {
    it('should set current room and user id', async () => {
      signalingService.connect();
      
      await signalingService.joinRoom('room-1', 'user-1');
      
      expect((signalingService as any).currentRoomId).toBe('room-1');
      expect((signalingService as any).currentUserId).toBe('user-1');
    });
  });

  describe('sendOffer', () => {
    it('should emit offer event when connected', () => {
      signalingService.connect();
      (signalingService as any).socket = { 
        ...mockSocket, 
        connected: true,
        emit: vi.fn(),
      };
      
      signalingService.sendOffer({
        roomId: 'room-1',
        targetSocketId: 'socket-2',
        sdp: { type: 'offer', sdp: 'mock-sdp' },
        sender: 'user-1',
      });
      
      expect((signalingService as any).socket.emit).toHaveBeenCalledWith('offer', expect.any(Object));
    });

    it('should not emit offer when not connected', () => {
      signalingService.connect();
      (signalingService as any).socket = { ...mockSocket, connected: false };
      
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      signalingService.sendOffer({
        roomId: 'room-1',
        targetSocketId: 'socket-2',
        sdp: { type: 'offer', sdp: 'mock-sdp' },
        sender: 'user-1',
      });
      
      expect(consoleSpy).toHaveBeenCalledWith('Socket not connected, cannot send offer');
      consoleSpy.mockRestore();
    });
  });

  describe('sendAnswer', () => {
    it('should emit answer event when connected', () => {
      signalingService.connect();
      (signalingService as any).socket = { 
        ...mockSocket, 
        connected: true,
        emit: vi.fn(),
      };
      
      signalingService.sendAnswer({
        roomId: 'room-1',
        targetSocketId: 'socket-2',
        sdp: { type: 'answer', sdp: 'mock-sdp' },
        sender: 'user-1',
      });
      
      expect((signalingService as any).socket.emit).toHaveBeenCalledWith('answer', expect.any(Object));
    });

    it('should not emit answer when not connected', () => {
      signalingService.connect();
      (signalingService as any).socket = { ...mockSocket, connected: false };
      
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      signalingService.sendAnswer({
        roomId: 'room-1',
        targetSocketId: 'socket-2',
        sdp: { type: 'answer', sdp: 'mock-sdp' },
        sender: 'user-1',
      });
      
      expect(consoleSpy).toHaveBeenCalledWith('Socket not connected, cannot send answer');
      consoleSpy.mockRestore();
    });
  });

  describe('sendIceCandidate', () => {
    it('should emit ice-candidate event when connected', () => {
      signalingService.connect();
      (signalingService as any).socket = { 
        ...mockSocket, 
        connected: true,
        emit: vi.fn(),
      };
      
      signalingService.sendIceCandidate({
        roomId: 'room-1',
        targetSocketId: 'socket-2',
        candidate: { candidate: 'mock-candidate' },
        sender: 'user-1',
      });
      
      expect((signalingService as any).socket.emit).toHaveBeenCalledWith('ice-candidate', expect.any(Object));
    });

    it('should not emit ice-candidate when not connected', () => {
      signalingService.connect();
      (signalingService as any).socket = { ...mockSocket, connected: false };
      
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      signalingService.sendIceCandidate({
        roomId: 'room-1',
        targetSocketId: 'socket-2',
        candidate: { candidate: 'mock-candidate' },
        sender: 'user-1',
      });
      
      expect(consoleSpy).toHaveBeenCalledWith('Socket not connected, cannot send ice candidate');
      consoleSpy.mockRestore();
    });
  });

  describe('sendChatMessage', () => {
    it('should emit chat-message event when connected', () => {
      signalingService.connect();
      (signalingService as any).socket = { 
        ...mockSocket, 
        connected: true,
        emit: vi.fn(),
      };
      
      signalingService.sendChatMessage({
        roomId: 'room-1',
        userId: 'user-1',
        text: 'Hello',
      });
      
      expect((signalingService as any).socket.emit).toHaveBeenCalledWith('chat-message', expect.any(Object));
    });

    it('should not emit chat-message when not connected', () => {
      signalingService.connect();
      (signalingService as any).socket = { ...mockSocket, connected: false };
      
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      signalingService.sendChatMessage({
        roomId: 'room-1',
        userId: 'user-1',
        text: 'Hello',
      });
      
      expect(consoleSpy).toHaveBeenCalledWith('Socket not connected, cannot send chat message');
      consoleSpy.mockRestore();
    });
  });

  describe('emitVideoEvent', () => {
    it('should emit video event when connected', () => {
      signalingService.connect();
      (signalingService as any).socket = { 
        ...mockSocket, 
        connected: true,
        emit: vi.fn(),
      };
      
      signalingService.emitVideoEvent('video-play', { roomId: 'room-1', timestamp: 100 });
      
      expect((signalingService as any).socket.emit).toHaveBeenCalledWith('video-play', expect.any(Object));
    });

    it('should not emit video event when not connected', () => {
      signalingService.connect();
      (signalingService as any).socket = { ...mockSocket, connected: false };
      
      signalingService.emitVideoEvent('video-play', { roomId: 'room-1' });
      
      expect((signalingService as any).socket.emit).not.toHaveBeenCalled();
    });
  });

  describe('on/off event handlers', () => {
    it('should register event handlers', () => {
      signalingService.connect();
      (signalingService as any).socket = mockSocket;
      
      const callback = vi.fn();
      signalingService.on('connect', callback);
      
      expect(mockSocket.on).toHaveBeenCalledWith('connect', callback);
    });

    it('should remove event handlers', () => {
      signalingService.connect();
      (signalingService as any).socket = mockSocket;
      
      signalingService.off('connect');
      
      expect(mockSocket.off).toHaveBeenCalledWith('connect');
    });
  });

  describe('isConnected', () => {
    it('should return true when socket is connected', () => {
      signalingService.connect();
      (signalingService as any).socket = { connected: true };
      
      expect(signalingService.isConnected).toBe(true);
    });

    it('should return false when socket is not connected', () => {
      signalingService.connect();
      (signalingService as any).socket = { connected: false };
      
      expect(signalingService.isConnected).toBe(false);
    });

    it('should return false when socket is null', () => {
      (signalingService as any).socket = null;
      
      expect(signalingService.isConnected).toBe(false);
    });
  });
});
