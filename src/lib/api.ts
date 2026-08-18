/**
 * HTTP client for the ConnectUS API.
 *
 * Replaces the previous per-endpoint fetch boilerplate. Three things it fixes:
 *   - the token is read from storage here, not threaded through every call site
 *   - non-2xx and non-JSON responses raise `ApiError` instead of throwing an
 *     opaque SyntaxError when the server returns an HTML error page
 *   - a 401 clears the session once, centrally
 */

import type {
  Friend,
  Movie,
  Notification,
  Room,
  RoomTheme,
  RoomType,
  User,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const TOKEN_KEY = 'connectus_token';
const USER_KEY = 'connectus_user';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** The user was signed out or the token expired. */
  get isAuthError(): boolean {
    return this.status === 401;
  }
}

/* -------------------------------------------------------------------------- */
/* Session storage                                                            */
/* -------------------------------------------------------------------------- */

const isBrowser = () => typeof window !== 'undefined';

export const session = {
  getToken(): string | null {
    return isBrowser() ? localStorage.getItem(TOKEN_KEY) : null;
  },

  getUser(): User | null {
    if (!isBrowser()) return null;
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      // Corrupted payload from an older build — drop it rather than crash on boot.
      localStorage.removeItem(USER_KEY);
      return null;
    }
  },

  set(token: string, user: User) {
    if (!isBrowser()) return;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  setUser(user: User) {
    if (!isBrowser()) return;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  clear() {
    if (!isBrowser()) return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

/** Called when any request comes back 401, so the app can bounce to /auth. */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

/* -------------------------------------------------------------------------- */
/* Core request                                                               */
/* -------------------------------------------------------------------------- */

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Send the bearer token. Defaults to true. */
  auth?: boolean;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
}

/** What a well-formed API response looks like once parsed. */
interface Envelope {
  success?: boolean;
  data?: unknown;
  message?: string;
  error?: string;
  [key: string]: unknown;
}

/**
 * Read the body defensively.
 *
 * Proxies and crash handlers return HTML, and 204 has no body at all, so a bare
 * `response.json()` throws SyntaxError and hides the real status from the caller.
 */
async function parseBody(response: Response): Promise<Envelope | null> {
  const raw = await response.text();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Envelope) : null;
  } catch {
    return null;
  }
}

/**
 * The API wraps every payload as `{ success, data, message }`. This unwraps it
 * and returns `data`, raising `ApiError` on failure.
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, query, signal } = options;

  let url = `${API_URL}${path}`;
  if (query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') params.append(key, String(value));
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = session.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError(
      'Cannot reach the server. Check your connection and try again.',
      0,
      error,
    );
  }

  const payload = await parseBody(response);

  if (!response.ok) {
    if (response.status === 401) {
      session.clear();
      onUnauthorized?.();
    }
    throw new ApiError(
      payload?.message ??
        payload?.error ??
        `Request failed (${response.status} ${response.statusText})`,
      response.status,
      payload,
    );
  }

  if (payload && 'success' in payload) {
    if (payload.success === false) {
      throw new ApiError(payload.message ?? 'Request failed', response.status, payload);
    }
    return payload.data as T;
  }

  return payload as T;
}

/**
 * Same as `request`, but returns the full envelope. Needed by the few endpoints
 * that put meaningful flags alongside `data` (notably join, which returns
 * `requiresApproval`).
 */
async function requestEnvelope<T>(
  path: string,
  options: RequestOptions = {},
): Promise<{ data: T } & Record<string, unknown>> {
  const { method = 'GET', body, auth = true, query } = options;

  let url = `${API_URL}${path}`;
  if (query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') params.append(key, String(value));
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = session.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0, error);
  }

  const payload = await parseBody(response);

  if (!response.ok) {
    if (response.status === 401) {
      session.clear();
      onUnauthorized?.();
    }
    throw new ApiError(
      payload?.message ?? `Request failed (${response.status})`,
      response.status,
      payload,
    );
  }

  return (payload ?? {}) as { data: T } & Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/* Auth                                                                       */
/* -------------------------------------------------------------------------- */

export interface AuthResult extends User {
  token: string;
  expiresAt?: string;
}

export const authApi = {
  register: (data: { email: string; password: string; fullName?: string }) =>
    request<AuthResult>('/api/auth/register', { method: 'POST', body: data, auth: false }),

  login: (data: { email: string; password: string }) =>
    request<AuthResult>('/api/auth/login', { method: 'POST', body: data, auth: false }),

  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),

  me: () => request<User>('/api/auth/me'),

  updateMe: (data: { fullName?: string; avatarUrl?: string }) =>
    request<User>('/api/auth/me', { method: 'PATCH', body: data }),

  forgotPassword: (email: string) =>
    request<void>('/api/auth/forgot-password', { method: 'POST', body: { email }, auth: false }),

  resetPassword: (resetToken: string, newPassword: string) =>
    request<void>(`/api/auth/reset-password/${resetToken}`, {
      method: 'POST',
      body: { newPassword },
      auth: false,
    }),
};

/* -------------------------------------------------------------------------- */
/* Movies                                                                     */
/* -------------------------------------------------------------------------- */

export const movieApi = {
  list: (params?: { genre?: string; search?: string; source?: string }) =>
    request<Movie[]>('/api/movies', { auth: false, query: params }),

  get: (id: string) => request<Movie>(`/api/movies/${id}`, { auth: false }),

  /** Search the Internet Archive catalog. Results are importable but not yet stored. */
  searchCatalog: (query: string, page = 1) =>
    request<Movie[]>('/api/movies/catalog/search', { query: { q: query, page } }),

  /** Import a catalog result into the library so it can be used in a room. */
  importFromCatalog: (identifier: string) =>
    request<Movie>('/api/movies/catalog/import', { method: 'POST', body: { identifier } }),

  createUploadUrl: () =>
    request<{ uploadUrl: string; assetId: string; uploadId: string }>(
      '/api/movies/upload-url',
      { method: 'POST' },
    ),

  getUpload: (uploadId: string) =>
    request<{ id: string; status: string; assetId: string }>(`/api/movies/upload/${uploadId}`),

  getAsset: (assetId: string) =>
    request<{
      assetId: string;
      playbackId: string;
      duration: string;
      status: string;
      thumbnailUrl: string | null;
    }>(`/api/movies/asset/${assetId}`),

  create: (data: Partial<Movie> & { muxPlaybackId: string }) =>
    request<Movie>('/api/movies', { method: 'POST', body: data }),

  /** Upload a file straight to the storage provider with progress reporting. */
  uploadFile: (uploadUrl: string, file: File, onProgress?: (pct: number) => void) =>
    new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) onProgress((e.loaded / e.total) * 100);
      });
      xhr.addEventListener('load', () =>
        xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new ApiError(`Upload failed (${xhr.status})`, xhr.status)),
      );
      xhr.addEventListener('error', () => reject(new ApiError('Upload failed', 0)));
      xhr.addEventListener('abort', () => reject(new ApiError('Upload cancelled', 0)));
      xhr.open('PUT', uploadUrl);
      xhr.send(file);
    }),
};

/* -------------------------------------------------------------------------- */
/* Rooms                                                                      */
/* -------------------------------------------------------------------------- */

export interface CreateRoomInput {
  name: string;
  movieId: string;
  type: RoomType;
  theme: RoomTheme;
  startTime?: string;
  maxParticipants: number;
  adminEnabled: boolean;
  approvalRequired: boolean;
}

export interface JoinResult {
  room: Room;
  /** The host must approve before this user can enter. */
  requiresApproval: boolean;
}

export const roomApi = {
  create: (data: CreateRoomInput) => request<Room>('/api/rooms', { method: 'POST', body: data }),

  listPublic: () => request<Room[]>('/api/rooms'),

  get: (id: string) => request<Room>(`/api/rooms/${id}`),

  async join(data: { roomId?: string; code?: string }): Promise<JoinResult> {
    const envelope = await requestEnvelope<Room>('/api/rooms/join', {
      method: 'POST',
      body: data,
    });
    return {
      room: envelope.data,
      requiresApproval: Boolean(envelope.requiresApproval),
    };
  },

  requestToJoin: (roomId: string) =>
    request<void>(`/api/rooms/${roomId}/request-join`, { method: 'POST' }),

  approveRequest: (roomId: string, userId: string) =>
    request<Room>(`/api/rooms/${roomId}/approve-request/${userId}`, { method: 'POST' }),

  rejectRequest: (roomId: string, userId: string) =>
    request<void>(`/api/rooms/${roomId}/reject-request/${userId}`, { method: 'POST' }),

  start: (roomId: string) => request<Room>(`/api/rooms/${roomId}/start`, { method: 'POST' }),

  end: (roomId: string) => request<void>(`/api/rooms/${roomId}/end`, { method: 'POST' }),

  /** Leave a room without ending it. Hosts keep their seat; others are removed. */
  leave: (roomId: string) => request<void>(`/api/rooms/${roomId}/leave`, { method: 'POST' }),

  inviteByEmail: (roomId: string, emails: string[]) =>
    request<void>('/api/rooms/invite', { method: 'POST', body: { roomId, emails } }),

  messages: (roomId: string) => request<import('@/types').ChatMessage[]>(`/api/rooms/${roomId}/messages`),

  /** Past sessions this user attended or hosted, newest first. */
  history: () => request<import('@/types').WatchHistoryEntry[]>('/api/rooms/history'),
};

/* -------------------------------------------------------------------------- */
/* Friends                                                                    */
/* -------------------------------------------------------------------------- */

export const friendApi = {
  list: () => request<Friend[]>('/api/friends'),
  pending: () => request<Friend[]>('/api/friends/pending'),
  search: (query: string) => request<User[]>('/api/friends/search', { query: { query } }),
  sendRequest: (recipientId: string) =>
    request<void>('/api/friends/request', { method: 'POST', body: { recipientId } }),
  accept: (friendshipId: string) =>
    request<void>(`/api/friends/accept/${friendshipId}`, { method: 'POST' }),
  reject: (friendshipId: string) =>
    request<void>(`/api/friends/reject/${friendshipId}`, { method: 'POST' }),
  remove: (friendshipId: string) =>
    request<void>(`/api/friends/${friendshipId}`, { method: 'DELETE' }),
  inviteToRoom: (friendId: string, roomId: string) =>
    request<void>(`/api/friends/invite/${friendId}`, { method: 'POST', body: { roomId } }),
};

/* -------------------------------------------------------------------------- */
/* WebRTC                                                                     */
/* -------------------------------------------------------------------------- */

export interface IceConfig {
  iceServers: RTCIceServer[];
  ttl: number;
  /** False means relay-only peers (symmetric NAT) will not connect. */
  turnConfigured: boolean;
}

export const webrtcApi = {
  /** ICE servers, including any time-limited TURN credentials. */
  ice: () => request<IceConfig>('/api/webrtc/ice'),
};

/* -------------------------------------------------------------------------- */
/* Notifications                                                              */
/* -------------------------------------------------------------------------- */

export const notificationApi = {
  list: () => request<Notification[]>('/api/notifications'),
  markRead: (id: string) => request<void>(`/api/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => request<void>('/api/notifications/read-all', { method: 'PATCH' }),
};

/** Human-readable message for any thrown value. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}
