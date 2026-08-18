'use client';

/**
 * Peer-to-peer video/audio for everyone in the room.
 *
 * Rewritten against the authenticated socket. Behaviour preserved from the
 * previous implementation: perfect-negotiation-lite (the existing occupant
 * initiates toward each new arrival), an ICE candidate queue for candidates that
 * land before the remote description, and graceful degradation when the user
 * denies camera access.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocket } from '@/providers/SocketProvider';

export interface Peer {
  userId: string;
  socketId: string;
  stream: MediaStream;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ],
};

export type MediaError = 'denied' | 'not-found' | 'unsupported' | null;

export function useWebRTC(roomId: string | null, enabled: boolean) {
  const { socket, connected } = useSocket();

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [mediaError, setMediaError] = useState<MediaError>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);

  const connections = useRef<Record<string, RTCPeerConnection>>({});
  const candidateQueue = useRef<Record<string, RTCIceCandidateInit[]>>({});
  const localStreamRef = useRef<MediaStream | null>(null);

  /* ---------------------------------------------------------------------- */
  /* Local media                                                            */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const acquire = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMediaError('unsupported');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);
        setMediaError(null);
      } catch (error) {
        if (cancelled) return;
        const name = (error as DOMException)?.name;
        // A refused camera must not break the watch party — the user still gets
        // the film, chat and reactions.
        setMediaError(name === 'NotFoundError' ? 'not-found' : 'denied');
      }
    };

    void acquire();

    return () => {
      cancelled = true;
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    };
  }, [enabled]);

  /* ---------------------------------------------------------------------- */
  /* Peer connections                                                       */
  /* ---------------------------------------------------------------------- */

  const closePeer = useCallback((socketId: string) => {
    connections.current[socketId]?.close();
    delete connections.current[socketId];
    delete candidateQueue.current[socketId];
    setPeers((current) => current.filter((peer) => peer.socketId !== socketId));
  }, []);

  const createConnection = useCallback(
    (socketId: string, userId: string) => {
      const existing = connections.current[socketId];
      if (existing) return existing;

      const pc = new RTCPeerConnection(ICE_SERVERS);
      connections.current[socketId] = pc;

      localStreamRef.current
        ?.getTracks()
        .forEach((track) => pc.addTrack(track, localStreamRef.current!));

      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('ice-candidate', {
            targetSocketId: socketId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.ontrack = (event) => {
        const [stream] = event.streams;
        if (!stream) return;
        setPeers((current) => {
          const without = current.filter((peer) => peer.socketId !== socketId);
          return [...without, { socketId, userId, stream }];
        });
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          closePeer(socketId);
        }
      };

      return pc;
    },
    [socket, closePeer],
  );

  /** Apply any candidates that arrived before the remote description existed. */
  const drainCandidates = useCallback(async (socketId: string, pc: RTCPeerConnection) => {
    const queued = candidateQueue.current[socketId];
    if (!queued?.length) return;
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // A rejected candidate is not fatal; others may still connect.
      }
    }
    delete candidateQueue.current[socketId];
  }, []);

  useEffect(() => {
    if (!socket || !connected || !enabled || !roomId) return;

    const handleExisting = async (existing: { userId: string; socketId: string }[]) => {
      // We are the newcomer: wait to be offered to, so both sides do not offer
      // simultaneously. Peers are created lazily when their offer arrives.
      void existing;
    };

    const handleUserConnected = async ({
      socketId,
      userId,
    }: {
      socketId: string;
      userId: string;
    }) => {
      const pc = createConnection(socketId, userId);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('offer', { targetSocketId: socketId, sdp: offer });
      } catch {
        closePeer(socketId);
      }
    };

    const handleOffer = async ({
      senderSocketId,
      sdp,
    }: {
      senderSocketId: string;
      sdp: RTCSessionDescriptionInit;
    }) => {
      const pc = createConnection(senderSocketId, 'peer');
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await drainCandidates(senderSocketId, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', { targetSocketId: senderSocketId, sdp: answer });
      } catch {
        closePeer(senderSocketId);
      }
    };

    const handleAnswer = async ({
      senderSocketId,
      sdp,
    }: {
      senderSocketId: string;
      sdp: RTCSessionDescriptionInit;
    }) => {
      const pc = connections.current[senderSocketId];
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await drainCandidates(senderSocketId, pc);
      } catch {
        closePeer(senderSocketId);
      }
    };

    const handleCandidate = async ({
      senderSocketId,
      candidate,
    }: {
      senderSocketId: string;
      candidate: RTCIceCandidateInit;
    }) => {
      const pc = connections.current[senderSocketId];
      if (!pc?.remoteDescription) {
        (candidateQueue.current[senderSocketId] ??= []).push(candidate);
        return;
      }
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // Ignore: a single bad candidate does not doom the connection.
      }
    };

    const handleDisconnected = ({ socketId }: { socketId: string }) => closePeer(socketId);

    socket.on('existing-participants', handleExisting);
    socket.on('user-connected', handleUserConnected);
    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleCandidate);
    socket.on('user-disconnected', handleDisconnected);

    return () => {
      socket.off('existing-participants', handleExisting);
      socket.off('user-connected', handleUserConnected);
      socket.off('offer', handleOffer);
      socket.off('answer', handleAnswer);
      socket.off('ice-candidate', handleCandidate);
      socket.off('user-disconnected', handleDisconnected);
    };
  }, [socket, connected, enabled, roomId, createConnection, closePeer, drainCandidates]);

  // Tear every connection down when the room or the feature is switched off.
  useEffect(() => {
    return () => {
      Object.keys(connections.current).forEach((socketId) => {
        connections.current[socketId]?.close();
      });
      connections.current = {};
      candidateQueue.current = {};
      setPeers([]);
    };
  }, [roomId, enabled]);

  /* ---------------------------------------------------------------------- */
  /* Controls                                                               */
  /* ---------------------------------------------------------------------- */

  const toggleAudio = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setAudioEnabled(track.enabled);
  }, []);

  const toggleVideo = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setVideoEnabled(track.enabled);
  }, []);

  return {
    localStream,
    peers,
    mediaError,
    audioEnabled,
    videoEnabled,
    toggleAudio,
    toggleVideo,
  };
}
