import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

class SignalingService {
    socket: Socket | null = null;

    connect() {
        if (!this.socket) {
            this.socket = io(SOCKET_URL, {
                withCredentials: true,
                transports: ['websocket', 'polling']
            });
        }
        return this.socket;
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    joinRoom(roomId: string, userId: string) {
        this.socket?.emit('join-room', roomId, userId);
    }

    sendOffer(payload: any) {
        this.socket?.emit('offer', payload);
    }

    sendAnswer(payload: any) {
        this.socket?.emit('answer', payload);
    }

    sendIceCandidate(payload: any) {
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
