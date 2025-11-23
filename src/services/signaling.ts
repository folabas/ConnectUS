import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

class SignalingService {
    socket: Socket | null = null;
    private currentRoomId: string | null = null;
    private currentUserId: string | null = null;

    connect() {
        if (!this.socket) {
            this.socket = io(SOCKET_URL, {
                withCredentials: true,
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                reconnectionAttempts: 5
            });

            // Handle reconnection
            this.socket.on('reconnect', () => {
                console.log('Socket reconnected');
                // Rejoin room if we were in one
                if (this.currentRoomId && this.currentUserId) {
                    console.log('Rejoining room after reconnect:', this.currentRoomId);
                    this.socket?.emit('join-room', this.currentRoomId, this.currentUserId);
                    // Emit custom event for WebRTC to re-establish connections
                    this.socket?.emit('reconnected', { roomId: this.currentRoomId, userId: this.currentUserId });
                }
            });

            this.socket.on('disconnect', (reason) => {
                console.log('Socket disconnected:', reason);
                if (reason === 'io server disconnect') {
                    // Server forcibly disconnected, attempt manual reconnection
                    this.socket?.connect();
                }
            });

            this.socket.on('connect_error', (error) => {
                console.error('Socket connection error:', error);
            });
        }
        return this.socket;
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.currentRoomId = null;
            this.currentUserId = null;
        }
    }

    joinRoom(roomId: string, userId: string) {
        this.currentRoomId = roomId;
        this.currentUserId = userId;
        this.socket?.emit('join-room', roomId, userId);
    }

    sendOffer(payload: { roomId: string; targetSocketId: string; sdp: any; sender: string }) {
        this.socket?.emit('offer', payload);
    }

    sendAnswer(payload: { roomId: string; targetSocketId: string; sdp: any; sender: string }) {
        this.socket?.emit('answer', payload);
    }

    sendIceCandidate(payload: { roomId: string; targetSocketId: string; candidate: any; sender: string }) {
        this.socket?.emit('ice-candidate', payload);
    }

    sendChatMessage(payload: any) {
        this.socket?.emit('chat-message', payload);
    }

    on(event: string, callback: (...args: any[]) => void) {
        this.socket?.on(event, callback);
    }

    off(event: string) {
        this.socket?.off(event);
    }
}

export const signalingService = new SignalingService();
