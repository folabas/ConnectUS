'use client';

/**
 * Peer-to-peer video and audio for everyone in the room.
 *
 * Two properties matter and both were broken:
 *
 * 1. **A connection carries the tracks it had when it was created.** Local
 *    tracks are attached in `createConnection` and never afterwards, while
 *    `getUserMedia` is asynchronous. Negotiating before the camera resolved
 *    produced a connection with nothing on it — ICE succeeded, no error
 *    appeared, and both sides sat looking at a black tile. Signalling that
 *    arrives early is therefore queued and replayed once media settles.
 *
 * 2. **Exactly one side of a pair may offer.** Whoever arrives later offers to
 *    everyone already present; occupants wait and answer. Both sides offering
 *    produces glare — two offers crossing, leaving the connection in a
 *    signalling state neither can recover from.
 *
 * Also here: an ICE candidate queue for candidates that arrive before the
 * remote description, and graceful degradation when the camera is refused —
 * that user still receives everyone else's media.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocket } from '@/providers/SocketProvider';
import { webrtcApi } from '@/lib/api';

export interface Peer {
  userId: string;
  socketId: string;
  stream: MediaStream;
}

interface PeerAddress {
  socketId: string;
  userId: string;
}

interface PendingOffer {
  senderSocketId: string;
  senderUserId: string;
  sdp: RTCSessionDescriptionInit;
}

/**
 * Used until the server's ICE configuration arrives, and if that request fails.
 *
 * STUN alone cannot connect peers behind symmetric NAT, so this is a floor
 * rather than a working default — the server supplies TURN when it is
 * configured. See backend/src/controllers/webrtcController.ts.
 */
const FALLBACK_ICE: RTCConfiguration = {
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
  const [relayAvailable, setRelayAvailable] = useState(true);

  /**
   * True once getUserMedia has *settled* — granted, refused, or unavailable.
   *
   * Refusal counts as settled: that user contributes nothing but should still
   * receive everyone else, and holding the room open waiting for a permission
   * prompt nobody is going to answer helps no one.
   */
  const [mediaSettled, setMediaSettled] = useState(false);

  const connections = useRef<Record<string, RTCPeerConnection>>({});
  const candidateQueue = useRef<Record<string, RTCIceCandidateInit[]>>({});
  const localStreamRef = useRef<MediaStream | null>(null);

  // Signalling that arrived before media settled, replayed once it has.
  const mediaSettledRef = useRef(false);
  const pendingPeers = useRef<Map<string, PeerAddress>>(new Map());
  const pendingOffers = useRef<Map<string, PendingOffer>>(new Map());

  // Held in a ref so a late-arriving config is picked up by connections created
  // after it, without re-running the signalling effect and tearing down peers.
  const iceConfig = useRef<RTCConfiguration>(FALLBACK_ICE);

  /* ---------------------------------------------------------------------- */
  /* ICE configuration                                                      */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    webrtcApi
      .ice()
      .then((config) => {
        if (cancelled || !config?.iceServers?.length) return;
        iceConfig.current = { iceServers: config.iceServers };
        setRelayAvailable(config.turnConfigured);
      })
      .catch(() => {
        // Keep the STUN fallback: most peers still connect without TURN.
        setRelayAvailable(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  /* ---------------------------------------------------------------------- */
  /* Local media                                                            */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const settle = () => {
      if (cancelled) return;
      mediaSettledRef.current = true;
      setMediaSettled(true);
    };

    const acquire = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMediaError('unsupported');
        settle();
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
        // the film, chat, reactions, and everyone else's video.
        setMediaError(name === 'NotFoundError' ? 'not-found' : 'denied');
      } finally {
        settle();
      }
    };

    void acquire();

    return () => {
      cancelled = true;
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
      mediaSettledRef.current = false;
      setMediaSettled(false);
    };
  }, [enabled]);

  /* ---------------------------------------------------------------------- */
  /* Peer connections                                                       */
  /* ---------------------------------------------------------------------- */

  const closePeer = useCallback((socketId: string) => {
    connections.current[socketId]?.close();
    delete connections.current[socketId];
    delete candidateQueue.current[socketId];
    pendingPeers.current.delete(socketId);
    pendingOffers.current.delete(socketId);
    setPeers((current) => current.filter((peer) => peer.socketId !== socketId));
  }, []);

  const createConnection = useCallback(
    (socketId: string, userId: string) => {
      const existing = connections.current[socketId];
      if (existing) return existing;

      const pc = new RTCPeerConnection(iceConfig.current);
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

  /**
   * Which side of a pair opens the negotiation.
   *
   * Both ends now learn about each other from the same sources, so "the
   * newcomer offers" is no longer enough to keep offers from crossing. A
   * comparison of socket ids gives both sides the same answer without any
   * coordination: exactly one of them initiates.
   */
  const shouldInitiate = useCallback(
    (theirSocketId: string) => Boolean(socket?.id && socket.id > theirSocketId),
    [socket],
  );

  /** Offer to a peer, or queue them if we have nothing to offer yet. */
  const offerTo = useCallback(
    async (peer: PeerAddress) => {
      if (!socket || connections.current[peer.socketId]) return;

      if (!mediaSettledRef.current) {
        pendingPeers.current.set(peer.socketId, peer);
        return;
      }

      const pc = createConnection(peer.socketId, peer.userId);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('offer', { targetSocketId: peer.socketId, sdp: offer });
      } catch {
        closePeer(peer.socketId);
      }
    },
    [socket, createConnection, closePeer],
  );

  /** Answer an offer, or queue it if we have nothing to answer with yet. */
  const answerOffer = useCallback(
    async ({ senderSocketId, senderUserId, sdp }: PendingOffer) => {
      if (!socket) return;

      if (!mediaSettledRef.current) {
        // Answering now would attach no local tracks, so the offerer would see
        // and hear nothing from us for the life of the connection.
        pendingOffers.current.set(senderSocketId, { senderSocketId, senderUserId, sdp });
        return;
      }

      // senderUserId used to be the placeholder string 'peer'. ParticipantStrip
      // looks streams up by user id, so nothing matched and every remote peer
      // rendered as "camera off" on the receiving side.
      const pc = createConnection(senderSocketId, senderUserId);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await drainCandidates(senderSocketId, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', { targetSocketId: senderSocketId, sdp: answer });
      } catch {
        closePeer(senderSocketId);
      }
    },
    [socket, createConnection, closePeer, drainCandidates],
  );

  /* ---------------------------------------------------------------------- */
  /* Replay whatever arrived before the camera was ready                    */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!mediaSettled) return;

    const peersToOffer = Array.from(pendingPeers.current.values());
    pendingPeers.current.clear();
    peersToOffer.forEach((peer) => void offerTo(peer));

    const offersToAnswer = Array.from(pendingOffers.current.values());
    pendingOffers.current.clear();
    offersToAnswer.forEach((offer) => void answerOffer(offer));
  }, [mediaSettled, offerTo, answerOffer]);

  /**
   * Ask the server who is already in the room.
   *
   * This hook mounts on the watch screen, but the room layout joins the socket
   * room back on the lobby — so `existing-participants`, which the server emits
   * once in reply to join-room, had already fired and gone before anything here
   * was listening. Nobody offered, no connection was ever negotiated, and the
   * call was silent while chat and playback worked normally.
   */
  useEffect(() => {
    if (!socket || !connected || !enabled || !roomId || !mediaSettled) return;

    let cancelled = false;
    socket.emit('list-peers', roomId, (existing) => {
      if (cancelled) return;
      existing.forEach((peer) => {
        if (shouldInitiate(peer.socketId)) void offerTo(peer);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [socket, connected, enabled, roomId, mediaSettled, offerTo, shouldInitiate]);

  /* ---------------------------------------------------------------------- */
  /* Signalling                                                             */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!socket || !connected || !enabled || !roomId) return;

    const handleExisting = (existing: PeerAddress[]) => {
      existing.forEach((peer) => {
        if (shouldInitiate(peer.socketId)) void offerTo(peer);
      });
    };

    // Someone arrived while we were already here. The socket-id comparison
    // decides which of us opens the negotiation.
    const handleUserConnected = (peer: PeerAddress) => {
      if (shouldInitiate(peer.socketId)) void offerTo(peer);
    };

    const handleOffer = (payload: PendingOffer) => void answerOffer(payload);

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
  }, [
    socket,
    connected,
    enabled,
    roomId,
    offerTo,
    answerOffer,
    closePeer,
    drainCandidates,
    shouldInitiate,
  ]);

  // Tear every connection down when the room or the feature is switched off.
  useEffect(() => {
    // Captured now so the cleanup closes the connections this run opened,
    // rather than whatever happens to be current when it fires.
    const open = connections.current;
    const queuedPeers = pendingPeers.current;
    const queuedOffers = pendingOffers.current;

    return () => {
      Object.keys(open).forEach((socketId) => open[socketId]?.close());
      connections.current = {};
      candidateQueue.current = {};
      queuedPeers.clear();
      queuedOffers.clear();
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
    /** False when no TURN relay is available, so some peers may not connect. */
    relayAvailable,
    /** False while the camera permission prompt is still outstanding. */
    mediaSettled,
  };
}
