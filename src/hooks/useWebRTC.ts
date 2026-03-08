import { useState, useEffect, useRef, useCallback } from 'react';
import { signalingService } from '../services/signaling';

export interface Peer {
    userId: string;
    socketId: string;
    stream: MediaStream;
}

export interface ChatMessage {
    id: string;
    userId: string;
    text: string;
    timestamp: number;
}

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
    ]
};

interface UseWebRTCOptions {
    roomId: string | null;
    userId: string | null;
}

export const useWebRTC = (roomId: string | null, userId: string | null) => {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [peers, setPeers] = useState<Peer[]>([]);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isConnected, setIsConnected] = useState(false);

    const peersRef = useRef<{ [socketId: string]: RTCPeerConnection }>({});
    const localStreamRef = useRef<MediaStream | null>(null);
    const initializedRef = useRef(false);
    const userIdRef = useRef(userId);
    const roomIdRef = useRef(roomId);

    useEffect(() => {
        userIdRef.current = userId;
    }, [userId]);

    useEffect(() => {
        roomIdRef.current = roomId;
    }, [roomId]);

    const createPeerConnection = useCallback((peerSocketId: string, peerUserId: string, isInitiator: boolean) => {
        if (peersRef.current[peerSocketId]) {
            console.log('Peer connection already exists for:', peerSocketId);
            return peersRef.current[peerSocketId];
        }

        const pc = new RTCPeerConnection(ICE_SERVERS);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                signalingService.sendIceCandidate({
                    roomId: roomIdRef.current!,
                    targetSocketId: peerSocketId,
                    candidate: event.candidate,
                    sender: userIdRef.current!
                });
            }
        };

        pc.ontrack = (event) => {
            console.log('Received remote track from:', peerUserId, 'streams:', event.streams.length);
            setPeers(prev => {
                const existing = prev.find(p => p.socketId === peerSocketId);
                if (existing) {
                    return prev.map(p => p.socketId === peerSocketId ? { ...p, stream: event.streams[0] } : p);
                }
                return [...prev, { userId: peerUserId, socketId: peerSocketId, stream: event.streams[0] }];
            });
        };

        pc.onconnectionstatechange = () => {
            console.log(`Connection state with ${peerUserId}:`, pc.connectionState);
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                console.warn(`Connection ${pc.connectionState} with peer ${peerUserId}`);
            }
            if (pc.connectionState === 'closed') {
                delete peersRef.current[peerSocketId];
                setPeers(prev => prev.filter(p => p.socketId !== peerSocketId));
            }
        };

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                if (localStreamRef.current) {
                    pc.addTrack(track, localStreamRef.current);
                }
            });
        }

        peersRef.current[peerSocketId] = pc;

        if (isInitiator) {
            pc.createOffer().then(offer => {
                pc.setLocalDescription(offer).then(() => {
                    signalingService.sendOffer({
                        roomId: roomIdRef.current!,
                        targetSocketId: peerSocketId,
                        sdp: offer,
                        sender: userIdRef.current!
                    });
                });
            });
        }

        return pc;
    }, []);

    useEffect(() => {
        if (!roomId || !userId || initializedRef.current) return;
        initializedRef.current = true;

        let isMounted = true;

        const init = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

                if (!isMounted) {
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }

                setLocalStream(stream);
                localStreamRef.current = stream;

                const socket = signalingService.connect();

                socket.on('connect', () => {
                    console.log('Socket connected, emitting user-online');
                    socket.emit('user-online', userId);
                    socket.emit('join-room', roomId, userId);
                });

                socket.on('existing-participants', (users: { userId: string; socketId: string }[]) => {
                    console.log('Existing participants:', users);
                    users.forEach((user) => {
                        if (user.userId !== userId) {
                            createPeerConnection(user.socketId, user.userId, true);
                        }
                    });
                    setIsConnected(true);
                });

                socket.on('user-connected', async (data: { userId: string; socketId: string }) => {
                    console.log('User connected:', data.userId, 'Socket:', data.socketId);
                    if (data.userId !== userId) {
                        createPeerConnection(data.socketId, data.userId, true);
                    }
                });

                socket.on('offer', async (payload: any) => {
                    console.log('Received offer from:', payload.sender);
                    const pc = createPeerConnection(payload.senderSocketId, payload.sender, false);
                    await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    signalingService.sendAnswer({
                        roomId,
                        targetSocketId: payload.senderSocketId,
                        sdp: answer,
                        sender: userId
                    });
                });

                socket.on('answer', async (payload: any) => {
                    console.log('Received answer from:', payload.sender);
                    const pc = peersRef.current[payload.senderSocketId];
                    if (pc) {
                        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
                    }
                });

                socket.on('ice-candidate', async (payload: any) => {
                    const pc = peersRef.current[payload.senderSocketId];
                    if (pc && payload.candidate) {
                        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
                    }
                });

                socket.on('user-disconnected', (data: { userId: string; socketId: string }) => {
                    console.log('User disconnected:', data);
                    const pc = peersRef.current[data.socketId];
                    if (pc) {
                        pc.close();
                        delete peersRef.current[data.socketId];
                    }
                    setPeers(prev => prev.filter(p => p.socketId !== data.socketId));
                });

                socket.on('chat-message', (message: ChatMessage) => {
                    setMessages(prev => [...prev, message]);
                });

                socket.on('disconnect', () => {
                    console.log('Socket disconnected in useWebRTC');
                    setIsConnected(false);
                });

                socket.on('reconnect', () => {
                    console.log('Reconnected in useWebRTC');
                    socket.emit('user-online', userId);
                    socket.emit('join-room', roomId, userId);
                });

            } catch (err) {
                console.error('Error accessing media devices:', err);
            }
        };

        init();

        return () => {
            isMounted = false;
            initializedRef.current = false;
            localStreamRef.current?.getTracks().forEach(track => track.stop());
            Object.values(peersRef.current).forEach(pc => pc.close());
            peersRef.current = {};
            setPeers([]);
            setMessages([]);
            setIsConnected(false);
        };
    }, [roomId, userId, createPeerConnection]);

    const toggleAudio = useCallback(() => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                return audioTrack.enabled;
            }
        }
        return false;
    }, []);

    const toggleVideo = useCallback(() => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                return videoTrack.enabled;
            }
        }
        return false;
    }, []);

    const sendChatMessage = useCallback((text: string) => {
        if (!userId || !roomId) return;
        const message: ChatMessage = {
            id: Date.now().toString(),
            userId,
            text,
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, message]);
        signalingService.sendChatMessage({ roomId, ...message });
    }, [userId, roomId]);

    return {
        localStream,
        peers,
        messages,
        isConnected,
        toggleAudio,
        toggleVideo,
        sendChatMessage
    };
};
