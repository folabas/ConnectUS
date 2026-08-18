# ConnectUs

Watch films together, in sync, from anywhere. The host drives playback; everyone
else follows within a fraction of a second, alongside live chat, floating
reactions, and peer-to-peer video.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind 4 |
| Backend | Express 5, MongoDB (Mongoose), Socket.io |
| Realtime | Socket.io for state, WebRTC for video chat |
| Auth | JWT, bcrypt |
| Video | Internet Archive (public domain) + optional Mux uploads |

## Running locally

You need Node 20+ and a MongoDB instance (local or Atlas).

**1. Backend**

```bash
cd backend && cp env.example .env && npm install && npm run dev
```

Fill in `.env` before starting — the server validates its configuration at boot
and refuses to run with a missing or placeholder `JWT_SECRET`. Generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

**2. Frontend**

```bash
cp env.local.example .env.local && npm install && npm run dev
```

**3. Seed the starter catalog**

With the backend running and a user registered, sign in and call:

```bash
curl -X POST http://localhost:5000/api/movies/seed -H "Authorization: Bearer <your-token>"
```

This adds the Blender open movies. Everything else comes from the in-app archive
search on the Library page.

The app is at http://localhost:3000, the API at http://localhost:5000.

## Architecture

### Routing

Rooms are addressed by URL, not by session state:

```
/                       landing (redirects signed-in users to /library)
/auth                   sign in / sign up / reset       ?next= preserves the destination
/join/[code]            invite-link entry, resolves a code to a room
/library                browse and add films            ─┐
/rooms                  browse public rooms, enter code  │ (app) group:
/rooms/new              host a room                      │ auth-guarded, shared chrome
/profile  /settings                                     ─┘
/room/[roomId]          lobby: participants, invites, approvals
/room/[roomId]/watch    the session itself
```

`AuthProvider` resolves the session once on boot; `AuthGuard` waits for that to
settle before redirecting, so a hard refresh does not bounce a signed-in user to
`/auth`. `RoomProvider` owns all state for a room subtree.

### Identity on the socket

The client presents its JWT in the connection handshake. The server derives the
user from that token and ignores any identity a payload claims. `join-room`
additionally verifies room membership in the database before admitting a socket
to a room channel, so knowing a room id is not enough to listen in.

Each user also has a private channel (`user:<id>`). It is how the server reaches
someone who is *not* in a room channel — in particular a person waiting for their
join request to be approved.

### Playback sync

Payloads carry `emittedAt`, so a follower adds the message's flight time before
seeking. Applying a remote change suppresses outbound emits for a short window,
otherwise the element's own `seeking` event would be broadcast straight back and
the room would oscillate. Drift under 0.75s is left alone — a micro-seek is more
noticeable than the drift it corrects.

### Where the films come from

The library is backed by the Internet Archive's public-domain collections
(searchable and importable from the Library page) plus the Blender open movies.
Uploads via Mux are supported but optional.

`docs/VIDEO_SOURCES.md` explains the alternatives and the licensing constraints
in detail. The short version: no legal API streams licensed Hollywood films, so
the catalog is public-domain content and whatever users host themselves.

## Testing

```bash
npm run test:run      # unit and integration (vitest)
npm run test:e2e      # browser tests (playwright)
npx tsc --noEmit      # frontend types
cd backend && npx tsc --noEmit
```

## Before deploying

See `docs/LAUNCH_CHECKLIST.md`.
