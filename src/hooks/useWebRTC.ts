import { useState, useEffect, useRef, useCallback } from 'react';
import { signalingService } from '../services/signaling';

export interface Peer {
    userId: string;
    stream: MediaStream;
}

export interface ChatMessage {
    id: string;
    userId: string;
    text: string;
    timestamp: number;
}

const STUN_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
    ]
};

export const useWebRTC = (roomId: string | null, userId: string | null) => {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [peers, setPeers] = useState<Peer[]>([]);
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    const peersRef = useRef<{ [key: string]: RTCPeerConnection }>({});
    const localStreamRef = useRef<MediaStream | null>(null);

    const createPeerConnection = useCallback((targetUserId: string, currentUserId: string) => {
        const pc = new RTCPeerConnection(STUN_SERVERS);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                signalingService.sendIceCandidate({
                    target: targetUserId,
                    candidate: event.candidate,
                    sender: currentUserId
                });
            }
        };

        pc.ontrack = (event) => {
            setPeers(prev => {
                if (prev.find(p => p.userId === targetUserId)) return prev;
                return [...prev, { userId: targetUserId, stream: event.streams[0] }];
            });
        };

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                if (localStreamRef.current) {
                    pc.addTrack(track, localStreamRef.current);
                }
            });
        }

        peersRef.current[targetUserId] = pc;
        return pc;
    }, []);

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

                socket.on('user-connected', async (newUserId: string) => {
                    console.log('User connected:', newUserId);
                    const pc = createPeerConnection(newUserId, userId);
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    signalingService.sendOffer({
                        target: newUserId,
                        sdp: offer,
                        sender: userId
                    });
                });

                socket.on('offer', async (payload: any) => {
                    const pc = createPeerConnection(payload.sender, userId);
                    await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    signalingService.sendAnswer({
                        target: payload.sender,
                        sdp: answer,
                        sender: userId
                    });
                });

                socket.on('answer', async (payload: any) => {
                    const pc = peersRef.current[payload.sender];
                    if (pc) {
                        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
                    }
                });

                socket.on('ice-candidate', async (payload: any) => {
                    const pc = peersRef.current[payload.sender];
                    if (pc && payload.candidate) {
                        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
                    }
                });

                socket.on('user-disconnected', (disconnectedUserId: string) => {
                    if (peersRef.current[disconnectedUserId]) {
                        peersRef.current[disconnectedUserId].close();
                        delete peersRef.current[disconnectedUserId];
                        setPeers(prev => prev.filter(p => p.userId !== disconnectedUserId));
                    }
                });

                socket.on('chat-message', (message: ChatMessage) => {
                    setMessages(prev => {
                        if (prev.some(m => m.id === message.id)) return prev;
                        return [...prev, message];
                    });
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
