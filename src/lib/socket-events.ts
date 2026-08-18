/**
 * The socket contract, shared in spirit with `backend/src/sockets/events.ts`.
 *
 * Note what is *absent* from every client-to-server payload: `userId`. The server
 * derives identity from the JWT supplied in the connection handshake. Anything a
 * client claims about who it is gets ignored.
 */

import type { ChatMessage, Room, RoomMember, RoomStatus } from '@/types';

export interface RoomUpdatedPayload {
  roomId: string;
  participantCount: number;
  participants: RoomMember[];
  host: RoomMember;
  movie: Room['movie'];
  status: RoomStatus;
}

export interface PeerPayload {
  userId: string;
  socketId: string;
}

export interface VideoStatePayload {
  roomId: string;
  currentTime: number;
  /** Server clock at emit, used to compensate for network delay. */
  emittedAt: number;
}

export interface JoinRequestPayload {
  roomId: string;
  user: RoomMember;
  requestedAt: string;
}

/** Server -> client. */
export interface ServerEvents {
  'room-updated': (payload: RoomUpdatedPayload) => void;
  'room-started': (payload: { roomId: string; room: Room }) => void;
  'room-ended': (payload: { roomId: string; message: string }) => void;

  'existing-participants': (peers: PeerPayload[]) => void;
  'user-connected': (peer: PeerPayload) => void;
  'user-disconnected': (peer: PeerPayload) => void;
  'user-left': (payload: { userId: string; userName: string }) => void;

  offer: (payload: { senderSocketId: string; sdp: RTCSessionDescriptionInit }) => void;
  answer: (payload: { senderSocketId: string; sdp: RTCSessionDescriptionInit }) => void;
  'ice-candidate': (payload: {
    senderSocketId: string;
    candidate: RTCIceCandidateInit;
  }) => void;

  'chat-message': (message: ChatMessage) => void;
  reaction: (payload: { roomId: string; userId: string; emoji: string }) => void;

  'video-play': (payload: VideoStatePayload) => void;
  'video-pause': (payload: VideoStatePayload) => void;
  'video-seek': (payload: VideoStatePayload) => void;
  'video-sync-request': (payload: { roomId: string; requesterSocketId: string }) => void;
  'video-sync-response': (payload: VideoStatePayload & { targetSocketId: string }) => void;

  'join-request-received': (payload: JoinRequestPayload) => void;
  'join-request-approved': (payload: { roomId: string; room: Room }) => void;
  'join-request-rejected': (payload: { roomId: string; message: string }) => void;

  'friend-online': (payload: { userId: string }) => void;
  'friend-offline': (payload: { userId: string }) => void;
  'room-invite': (payload: {
    roomId: string;
    roomName: string;
    fromUserName: string;
    movieTitle: string;
  }) => void;

  'server-error': (payload: { event?: string; message: string }) => void;
}

/** Client -> server. */
export interface ClientEvents {
  'join-room': (roomId: string, ack?: (result: { ok: boolean; error?: string }) => void) => void;
  'leave-room': (roomId: string) => void;

  offer: (payload: { targetSocketId: string; sdp: RTCSessionDescriptionInit }) => void;
  answer: (payload: { targetSocketId: string; sdp: RTCSessionDescriptionInit }) => void;
  'ice-candidate': (payload: {
    targetSocketId: string;
    candidate: RTCIceCandidateInit;
  }) => void;

  'chat-message': (payload: { roomId: string; text: string }) => void;
  reaction: (payload: { roomId: string; emoji: string }) => void;

  'video-play': (payload: { roomId: string; currentTime: number }) => void;
  'video-pause': (payload: { roomId: string; currentTime: number }) => void;
  'video-seek': (payload: { roomId: string; currentTime: number }) => void;
  'video-sync-request': (payload: { roomId: string }) => void;
  'video-sync-response': (payload: {
    roomId: string;
    targetSocketId: string;
    currentTime: number;
  }) => void;
}

/** Longest chat message the server will accept. Enforced on both sides. */
export const MAX_CHAT_LENGTH = 500;

/** Reactions clients may send. The server rejects anything outside this set. */
export const ALLOWED_REACTIONS = ['❤️', '😂', '😮', '😢', '🔥', '👏', '🍿', '👍'] as const;
export type Reaction = (typeof ALLOWED_REACTIONS)[number];
