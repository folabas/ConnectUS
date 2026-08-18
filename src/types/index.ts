/**
 * Shared domain types.
 *
 * These used to live in `src/App.tsx` alongside a client-side router, which meant
 * every page imported types from a component module. The router is gone; the types
 * live here.
 */

export type RoomStatus = 'waiting' | 'scheduled' | 'active' | 'playing' | 'finished';
export type RoomType = 'public' | 'private';
export type JoinRequestStatus = 'pending' | 'approved' | 'rejected' | 'left';

/** Where a movie's video stream comes from. See docs/VIDEO_SOURCES.md. */
export type MovieSource = 'archive' | 'blender' | 'upload';

export interface RoomTheme {
  primary: string;
  secondary: string;
  name: string;
}

export interface User {
  userId: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
  onlineStatus?: 'online' | 'offline';
  sessionsHosted?: number;
  moviesWatched?: number;
  createdAt?: string;
}

/**
 * A user as embedded in a populated room document. The backend populates only
 * `_id`, `fullName` and `avatarUrl`, so this is deliberately narrower than `User`
 * and uses `_id` rather than `userId`.
 */
export interface RoomMember {
  _id: string;
  fullName?: string;
  avatarUrl?: string;
}

export interface Movie {
  _id: string;
  title: string;
  image: string;
  duration: string;
  rating: string;
  genre: string;
  description?: string;
  year?: number;
  source?: MovieSource;
  /** Direct progressive or HLS URL. Always present for archive/blender sources. */
  videoUrl?: string;
  muxPlaybackId?: string;
  muxAssetId?: string;
}

export interface JoinRequest {
  user: RoomMember;
  requestedAt: string;
  status: JoinRequestStatus;
}

export interface Room {
  _id: string;
  name: string;
  host: RoomMember;
  movie: Movie;
  type: RoomType;
  code?: string;
  theme: RoomTheme;
  startTime?: string;
  scheduledStartTime?: string;
  maxParticipants: number;
  adminEnabled: boolean;
  approvalRequired: boolean;
  participants: RoomMember[];
  joinRequests?: JoinRequest[];
  status: RoomStatus;
  createdAt?: string;
}

/** One past session, as returned by the history endpoint. */
export interface WatchHistoryEntry {
  roomId: string;
  name: string;
  status: RoomStatus;
  type: RoomType;
  theme: RoomTheme;
  watchedAt: string;
  createdAt: string;
  movie: Movie | null;
  host: RoomMember | null;
  youHosted: boolean;
  /** Everyone else who was in the room. */
  companions: Array<RoomMember & { isHost: boolean }>;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  userName?: string;
  text: string;
  timestamp: string;
}

export interface Friend {
  _id: string;
  user: User;
  status: 'pending' | 'accepted';
  direction?: 'incoming' | 'outgoing';
}

export interface Notification {
  _id: string;
  type: 'room_invite' | 'friend_request' | 'room_starting';
  read: boolean;
  createdAt: string;
  data: {
    fromUserId?: string;
    fromUserName?: string;
    roomId?: string;
    roomName?: string;
    movieTitle?: string;
  };
}

export const DEFAULT_THEME: RoomTheme = {
  primary: '#E39A2E',
  secondary: '#F5C77A',
  name: 'Projector',
};

/** Themes offered when creating a room. */
export const ROOM_THEMES: RoomTheme[] = [
  { name: 'Projector', primary: '#E39A2E', secondary: '#F5C77A' },
  { name: 'Velvet', primary: '#C2352F', secondary: '#E8635C' },
  { name: 'Nitrate', primary: '#D9C9A3', secondary: '#F0E6CE' },
  { name: 'Neon Marquee', primary: '#E0518A', secondary: '#F58CB4' },
  { name: 'Green Room', primary: '#3F8F6B', secondary: '#68BE96' },
  { name: 'Midnight Screening', primary: '#4A6FA5', secondary: '#7FA0CE' },
];

/** True when the room is in a state a participant can actually watch in. */
export function isRoomLive(status: RoomStatus): boolean {
  return status === 'playing' || status === 'active';
}

/** True when the host of `room` is `userId`. Tolerates unpopulated host refs. */
export function isHost(room: Pick<Room, 'host'> | null, userId: string | undefined): boolean {
  if (!room || !userId) return false;
  const host = room.host as RoomMember | string;
  const hostId = typeof host === 'string' ? host : host?._id;
  return hostId === userId;
}
