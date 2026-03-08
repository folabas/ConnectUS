import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface SignalingEvents {
    connect: () => void;
    disconnect: (reason: string) => void;
    reconnect: () => void;
    'user-online': (userId: string) => void;
    'existing-participants': (users: { userId: string; socketId: string }[]) => void;
    'user-connected': (data: { userId: string; socketId: string }) => void;
    'offer': (payload: any) => void;
    'answer': (payload: any) => void;
    'ice-candidate': (payload: any) => void;
    'user-disconnected': (data: { userId: string; socketId: string }) => void;
    'chat-message': (payload: any) => void;
    'room-updated': (payload: any) => void;
    'video-play': (payload: any) => void;
    'video-pause': (payload: any) => void;
    'video-seek': (payload: any) => void;
    'video-sync-request': (payload: any) => void;
    'video-sync-response': (payload: any) => void;
    'reaction': (payload: any) => void;
    'friend-online': (userId: string) => void;
    'friend-offline': (userId: string) => void;
}

class SignalingService {
    socket: Socket | null = null;
    private currentRoomId: string | null = null;
    private currentUserId: string | null = null;
    private connectionReadyResolve: (() => void) | null = null;
    private connectionReadyPromise: Promise<void> | null = null;

    connect(): Socket {
        if (!this.socket || !this.socket.connected) {
            this.socket = io(SOCKET_URL, {
                withCredentials: true,
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                reconnectionAttempts: 10,
                autoConnect: true
            });

            this.socket.on('connect', () => {
                console.log('Socket connected:', this.socket?.id);
                if (this.connectionReadyResolve) {
                    this.connectionReadyResolve();
                    this.connectionReadyPromise = null;
                    this.connectionReadyResolve = null;
                }
                if (this.currentRoomId && this.currentUserId) {
                    this.rejoinRoom();
                }
            });

            this.socket.on('disconnect', (reason) => {
                console.log('Socket disconnected:', reason);
                if (reason === 'io server disconnect') {
                    this.socket?.connect();
                }
            });

            this.socket.on('connect_error', (error) => {
                console.error('Socket connection error:', error);
            });

            this.socket.io.on('reconnect', () => {
                console.log('Socket reconnected');
                if (this.currentRoomId && this.currentUserId) {
                    this.rejoinRoom();
                }
            });
        }
        return this.socket;
    }

    private rejoinRoom() {
        if (!this.socket || !this.currentRoomId || !this.currentUserId) return;
        
        console.log('Rejoining room:', this.currentRoomId);
        this.socket.emit('user-online', this.currentUserId);
        
        setTimeout(() => {
            this.socket?.emit('join-room', this.currentRoomId, this.currentUserId);
        }, 500);
    }

    async waitForConnection(): Promise<void> {
        if (this.socket?.connected) return;
        
        if (!this.connectionReadyPromise) {
            this.connectionReadyPromise = new Promise((resolve) => {
                this.connectionReadyResolve = resolve;
            });
        }
        
        return this.connectionReadyPromise;
    }

    disconnect() {
        if (this.socket) {
            if (this.currentRoomId && this.currentUserId) {
                this.socket.emit('leave-room', this.currentRoomId, this.currentUserId);
            }
            this.socket.disconnect();
            this.socket = null;
            this.currentRoomId = null;
            this.currentUserId = null;
            this.connectionReadyPromise = null;
        }
    }

    async joinRoom(roomId: string, userId: string) {
        this.currentRoomId = roomId;
        this.currentUserId = userId;
        
        await this.waitForConnection();
        
        if (this.socket?.connected) {
            console.log('Emitting join-room events:', { roomId, userId });
            this.socket.emit('user-online', userId);
            setTimeout(() => {
                this.socket?.emit('join-room', roomId, userId);
            }, 100);
        }
    }

    sendOffer(payload: { roomId: string; targetSocketId: string; sdp: RTCSessionDescriptionInit; sender: string }) {
        if (!this.socket?.connected) {
            console.warn('Socket not connected, cannot send offer');
            return;
        }
        this.socket.emit('offer', payload);
    }

    sendAnswer(payload: { roomId: string; targetSocketId: string; sdp: RTCSessionDescriptionInit; sender: string }) {
        if (!this.socket?.connected) {
            console.warn('Socket not connected, cannot send answer');
            return;
        }
        this.socket.emit('answer', payload);
    }

    sendIceCandidate(payload: { roomId: string; targetSocketId: string; candidate: RTCIceCandidateInit; sender: string }) {
        if (!this.socket?.connected) {
            console.warn('Socket not connected, cannot send ice candidate');
            return;
        }
        this.socket.emit('ice-candidate', payload);
    }

    sendChatMessage(payload: any) {
        if (!this.socket?.connected) {
            console.warn('Socket not connected, cannot send chat message');
            return;
        }
        this.socket.emit('chat-message', payload);
    }

    emitVideoEvent(event: string, payload: any) {
        if (!this.socket?.connected) return;
        this.socket.emit(event, payload);
    }

    on<K extends keyof SignalingEvents>(event: K, callback: SignalingEvents[K]) {
        this.socket?.on(event, callback as any);
    }

    off<K extends keyof SignalingEvents>(event: K) {
        this.socket?.off(event);
    }

    get isConnected(): boolean {
        return this.socket?.connected ?? false;
    }
}

export const signalingService = new SignalingService();
