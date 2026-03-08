# ConnectUS - Product Requirements Document

## Project Overview
**ConnectUS** is a real-time synchronized movie watching platform that enables users to host and join watch parties with friends. Users can create rooms, invite friends, watch movies together with synchronized playback, video chat, and live chat.

## Tech Stack
- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS 4
- **Backend**: Express.js, MongoDB, Socket.io
- **Video**: Mux (streaming), WebRTC (video chat)
- **Auth**: JWT with bcrypt

## Core Features

### 1. Authentication
- Email/password registration & login
- JWT-based session management
- User profile with stats (sessions hosted, movies watched)

### 2. Movie Library
- Browse movies (mock data for demo)
- Search & category filtering
- Add/upload movies (admin)

### 3. Room Management
- Create room (name, privacy, theme, max participants)
- Generate unique room codes
- Join via code or invite link
- Host controls playback (play/pause/seek)

### 4. Watch Experience
- Synchronized video playback across all participants
- Host-controlled playback (admin mode)
- Live chat with message history
- Real-time emoji reactions

### 5. Video Chat
- WebRTC peer-to-peer video/audio
- Mic and camera toggle
- Multiple participant grid

### 6. Social
- Friend system (request/accept/reject)
- Online status indicators
- Room invite to friends

## API Endpoints

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

### Movies
- `GET /api/movies` (list with search/filter)
- `GET /api/movies/:id`
- `POST /api/movies` (admin)
- `POST /api/movies/upload-url` (Mux direct upload)

### Rooms
- `POST /api/rooms` (create)
- `GET /api/rooms/:code` (join)
- `PATCH /api/rooms/:id`
- `DELETE /api/rooms/:id`

### Friends
- `POST /api/friends/request`
- `POST /api/friends/accept/:id`
- `GET /api/friends`

## Socket Events
- `join-room` / `leave-room`
- `video-play` / `video-pause` / `video-seek`
- `offer` / `answer` / `ice-candidate` (WebRTC)
- `chat-message`
- `reaction`

## Room States
`waiting` → `scheduled` → `active` → `playing` → `finished`

## Acceptance Criteria
1. Users can register, login, and manage profile
2. Users can create public/private rooms with themes
3. Room code enables instant joining
4. Video playback syncs within 500ms across participants
5. Only host can control playback when admin mode enabled
6. WebRTC establishes peer connections between participants
7. Chat messages persist and sync in real-time
8. Friends can see online status and invite to rooms

## Future Scope
- Screen sharing
- Watch party scheduling
- Mobile app (React Native)
- Payment/subscription tiers
