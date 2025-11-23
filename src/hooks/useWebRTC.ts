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



export const useWebRTC = (roomId: string | null, userId: string | null) => {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [peers, setPeers] = useState<Peer[]>([]);
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    const peersRef = useRef<{ [socketId: string]: RTCPeerConnection }>({});
    const localStreamRef = useRef<MediaStream | null>(null);

    const createPeerConnection = useCallback((peerSocketId: string, peerUserId: string) => {
        const pc = new RTCPeerConnection(ICE_SERVERS);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                signalingService.sendIceCandidate({
                    roomId: roomId!,
                    targetSocketId: peerSocketId,
                    candidate: event.candidate,
                    sender: userId!
                });
            }
        };

        pc.ontrack = (event) => {
            console.log('Received remote track from:', peerUserId);
            setPeers(prev => {
                if (prev.find(p => p.socketId === peerSocketId)) return prev;
                return [...prev, { userId: peerUserId, socketId: peerSocketId, stream: event.streams[0] }];
            });
        };

        pc.onconnectionstatechange = () => {
            console.log(`Connection state with ${peerUserId}:`, pc.connectionState);
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                console.warn(`Connection ${pc.connectionState} with peer ${peerUserId}`);
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
        return pc;
    }, [roomId, userId]);

    useEffect(() => {
        if (!roomId || !userId) return;

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
                signalingService.joinRoom(roomId, userId);

                socket.on('existing-participants', (users: { userId: string; socketId: string }[]) => {
                    console.log('Existing participants:', users);
                    users.forEach(async (user) => {
                        const pc = createPeerConnection(user.socketId, user.userId);
                        const offer = await pc.createOffer();
                        await pc.setLocalDescription(offer);
                        signalingService.sendOffer({
                            roomId,
                            targetSocketId: user.socketId,
                            sdp: offer,
                            sender: userId
                        });
                    });
                });

                socket.on('user-connected', async (data: { userId: string; socketId: string }) => {
                    console.log('User connected:', data.userId, 'Socket:', data.socketId);
                    const pc = createPeerConnection(data.socketId, data.userId);

                });

                socket.on('offer', async (payload: any) => {
                    console.log('Received offer from:', payload.sender);
                    const pc = createPeerConnection(payload.senderSocketId, payload.sender);
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
                    const pc = peersRef.current[data.socketId];
                    if (pc) {
                        pc.close();
                        delete peersRef.current[data.socketId];
                        setPeers(prev => prev.filter(p => p.socketId !== data.socketId)); // Fix: Filter by socketId
                    }
                });

                socket.on('chat-message', (message: ChatMessage) => {
                    setMessages(prev => [...prev, message]);
                });

            } catch (err) {
                console.error('Error accessing media devices:', err);
            }
        };

        init();

        return () => {
            isMounted = false;
            localStreamRef.current?.getTracks().forEach(track => track.stop());
            Object.values(peersRef.current).forEach(pc => pc.close());
            signalingService.disconnect();
        };
    }, [roomId, userId, createPeerConnection]);

    const toggleAudio = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                return audioTrack.enabled;
            }
        }
        return false;
    };

    const toggleVideo = () => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                return videoTrack.enabled;
            }
        }
        return false;
    };

    const sendChatMessage = (text: string) => {
        if (!userId || !roomId) return;
        const message: ChatMessage = {
            id: Date.now().toString(),
            userId,
            text,
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, message]);
        signalingService.sendChatMessage({ roomId, ...message });
    };


    return {
        localStream,
        peers,
        messages,
        toggleAudio,
        toggleVideo,
        sendChatMessage
    };
};
