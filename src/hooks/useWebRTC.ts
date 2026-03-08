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
    const candidateQueuesRef = useRef<{ [socketId: string]: RTCIceCandidate[] }>({});
    const localStreamRef = useRef<MediaStream | null>(null);
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
        candidateQueuesRef.current[peerSocketId] = [];

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

    const [permissionError, setPermissionError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);

    // Track initialization to prevent multiple calls to getUserMedia
    const initializationStatus = useRef<'idle' | 'initializing' | 'completed' | 'failed'>('idle');

    useEffect(() => {
        if (!roomId || !userId || initializationStatus.current === 'initializing' || initializationStatus.current === 'completed') return;

        initializationStatus.current = 'initializing';
        let isMounted = true;

        const init = async () => {
            try {
                let stream: MediaStream;
                try {
                    // Try full media access first
                    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                } catch (firstErr: any) {
                    console.warn('Initial media access failed, trying audio only:', firstErr.name);

                    if (firstErr.name === 'NotAllowedError' || firstErr.name === 'NotFoundError') {
                        // Try audio-only if full access was denied or video device missing
                        try {
                            stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
                        } catch (secondErr: any) {
                            console.error('Final media access failed:', secondErr);
                            if (isMounted) {
                                setPermissionError(secondErr.name === 'NotAllowedError' ? 'Permission denied' : 'Device error');
                            }
                            throw secondErr;
                        }
                    } else {
                        throw firstErr;
                    }
                }

                if (!isMounted) {
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }

                setLocalStream(stream);
                localStreamRef.current = stream;
                setPermissionError(null);
                initializationStatus.current = 'completed';

                const socket = signalingService.connect();

                // Use signalingService.joinRoom to benefit from its auto-rejoin logic
                console.log('Joining room via signalingService:', roomId);
                await signalingService.joinRoom(roomId, userId);

                socket.on('existing-participants', (users: { userId: string; socketId: string }[]) => {
                    console.log('Existing participants:', users);
                    users.forEach((user) => {
                        if (user.userId !== userId && !peersRef.current[user.socketId]) {
                            // Newcomer initiates to all existing members
                            createPeerConnection(user.socketId, user.userId, true);
                        }
                    });
                    setIsConnected(true);
                });

                socket.on('user-connected', async (data: { userId: string; socketId: string }) => {
                    console.log('User connected:', data.userId, 'Socket:', data.socketId);
                    if (data.userId !== userId && !peersRef.current[data.socketId]) {
                        // Existing members wait for the newcomer to initiate
                        createPeerConnection(data.socketId, data.userId, false);
                    }
                });

                socket.on('offer', async (payload: any) => {
                    console.log('Received offer from:', payload.sender, 'Socket:', payload.senderSocketId);
                    const pc = createPeerConnection(payload.senderSocketId, payload.sender, false);
                    if (pc) {
                        try {
                            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));

                            // Process queued candidates
                            const queue = candidateQueuesRef.current[payload.senderSocketId] || [];
                            while (queue.length > 0) {
                                const candidate = queue.shift();
                                if (candidate) await pc.addIceCandidate(candidate);
                            }

                            const answer = await pc.createAnswer();
                            await pc.setLocalDescription(answer);
                            signalingService.sendAnswer({
                                roomId,
                                targetSocketId: payload.senderSocketId,
                                sdp: answer,
                                sender: userId
                            });
                        } catch (err) {
                            console.error('Error handling offer:', err);
                        }
                    }
                });

                socket.on('answer', async (payload: any) => {
                    console.log('Received answer from:', payload.sender);
                    const pc = peersRef.current[payload.senderSocketId];
                    if (pc && pc.signalingState !== 'stable') {
                        try {
                            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));

                            // Process queued candidates
                            const queue = candidateQueuesRef.current[payload.senderSocketId] || [];
                            while (queue.length > 0) {
                                const candidate = queue.shift();
                                if (candidate) await pc.addIceCandidate(candidate);
                            }
                        } catch (err) {
                            console.error('Error handling answer:', err);
                        }
                    }
                });

                socket.on('ice-candidate', async (payload: any) => {
                    const pc = peersRef.current[payload.senderSocketId];
                    if (pc && payload.candidate) {
                        try {
                            const iceCandidate = new RTCIceCandidate(payload.candidate);
                            if (pc.remoteDescription && pc.remoteDescription.type) {
                                await pc.addIceCandidate(iceCandidate);
                            } else {
                                // Queue the candidate
                                if (!candidateQueuesRef.current[payload.senderSocketId]) {
                                    candidateQueuesRef.current[payload.senderSocketId] = [];
                                }
                                candidateQueuesRef.current[payload.senderSocketId].push(iceCandidate);
                                console.log('Queued candidate as remote description is not set yet');
                            }
                        } catch (e) {
                            console.error('Error adding ice candidate:', e);
                        }
                    }
                });

                socket.on('user-disconnected', (data: { userId: string; socketId: string }) => {
                    console.log('User disconnected:', data);
                    const pc = peersRef.current[data.socketId];
                    if (pc) {
                        pc.close();
                        delete peersRef.current[data.socketId];
                    }
                    delete candidateQueuesRef.current[data.socketId];
                    setPeers(prev => prev.filter(p => p.socketId !== data.socketId));
                });

                socket.on('chat-message', (message: ChatMessage) => {
                    setMessages(prev => {
                        if (prev.find(m => m.id === message.id)) return prev;
                        return [...prev, message];
                    });
                });

                socket.on('disconnect', () => {
                    console.log('Socket disconnected in useWebRTC');
                    setIsConnected(false);
                });

            } catch (err) {
                console.error('Final capture error in useWebRTC:', err);
                initializationStatus.current = 'failed';
            }
        };

        init();

        return () => {
            isMounted = false;
            initializationStatus.current = 'idle';

            const socket = signalingService.socket;
            if (socket) {
                socket.off('existing-participants');
                socket.off('user-connected');
                socket.off('offer');
                socket.off('answer');
                socket.off('ice-candidate');
                socket.off('user-disconnected');
                socket.off('chat-message');
                socket.off('disconnect');
                socket.off('reconnect');
            }

            localStreamRef.current?.getTracks().forEach(track => track.stop());
            Object.values(peersRef.current).forEach(pc => pc.close());
            peersRef.current = {};
            candidateQueuesRef.current = {};
            setPeers([]);
            setLocalStream(null);
            setIsConnected(false);
        };
    }, [roomId, userId, createPeerConnection, retryCount]);

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

    const retry = useCallback(() => {
        initializationStatus.current = 'idle';
        setPermissionError(null);
        setRetryCount(prev => prev + 1);
    }, []);

    return {
        localStream,
        peers,
        messages,
        isConnected,
        permissionError,
        retry,
        toggleAudio,
        toggleVideo,
        sendChatMessage
    };
};
