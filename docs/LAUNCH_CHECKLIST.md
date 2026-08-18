# Launch Checklist

State as of the `revamp/launch-readiness` branch. Items are grouped by whether
they block a launch.

## Done

**Security**
- [x] Socket connections authenticate via JWT in the handshake. Identity is no
      longer taken from client-supplied payloads.
- [x] `join-room` verifies room membership server-side before admitting a socket
      to a room channel.
- [x] `JWT_SECRET` is validated at boot. It previously fell back to
      `'default-secret-change-this'`, a value published in this repository.
- [x] `POST /api/movies/seed` no longer calls `deleteMany({})`. Any authenticated
      account could previously wipe the entire catalog.
- [x] Rate limits applied: 10/15min on credentials, 5/hour on password reset,
      30/min on writes, 1000/15min overall.
- [x] `helmet` mounted; CORS origins read from `ALLOWED_ORIGINS`.
- [x] Error responses omit internal messages in production.
- [x] `backend/dist` untracked.
- [x] Chat is length-limited and reactions are validated against an allowlist.

**Correctness**
- [x] Join-request approvals reach the requester (they are sent to the user's own
      channel, not the room channel the requester has not joined).
- [x] `moviesWatched` counted once per user per room.
- [x] No duplicate participants under a join race.
- [x] Host keeps their seat across a refresh.
- [x] Multi-tab presence: offline only when the last tab closes.
- [x] Scheduled and active public rooms are visible in browse.
- [x] Room invites emit the `room-invite` event the client listens for.

**Quality**
- [x] Frontend and backend typecheck clean; `next build` succeeds.
- [x] `npm run lint` clean.
- [x] 77 unit tests pass, covering the API client, playback sync, and formatting.
- [x] 45 backend tests pass (`cd backend && npm test`): socket handshake auth,
      room membership enforcement, chat delivery/ordering/limits/persistence,
      playback authority, the approval flow including the populate and race
      regressions, watch-stat idempotency, and seed safety.
- [x] Email and Mux are genuinely optional: the API boots and reports them as
      disabled instead of crashing on a missing key.
- [x] 41 realtime assertions pass against a live server and database
      (`cd backend && npm run verify:realtime`): socket auth, room membership,
      chat delivery and ordering, playback sync, WebRTC relay, reactions, the
      approval flow, and departure.
- [x] Manual walkthrough, sign-up through sign-out: landing -> auth -> library ->
      archive search -> import -> create room -> lobby -> start -> watch -> chat
      -> settings -> sign out. Route guards and `next` preservation verified.

## Blocking — needs a decision or an account

- [ ] **Confirm the video source strategy.** See `docs/VIDEO_SOURCES.md`. The
      Internet Archive integration is built and working; decide whether uploads
      stay on Mux or move to Bunny/Cloudflare, which are substantially cheaper
      for this workload.
- [ ] **Provision production secrets.** A real `JWT_SECRET`, a MongoDB Atlas URI,
      and `ALLOWED_ORIGINS` set to the production domains.
- [ ] **Configure email.** Password reset and invitations are no-ops without SMTP
      or a Resend key. Password reset in particular is a support burden if it
      silently does nothing.
- [ ] **TURN credentials.** The application side is done: ICE config is served
      from `GET /api/webrtc/ice`, time-limited credentials are implemented and
      verified against an independently computed HMAC, and the UI says so when
      no relay is available. What remains is buying or hosting one — Twilio,
      Metered, or self-hosted coturn — and setting `TURN_URLS` + `TURN_SECRET`.
      Until then roughly 10–20% of users cannot share camera or microphone.
      Chat and playback are unaffected.
- [ ] **If uploads open to the public:** a DMCA process and a designated agent
      registered with the Copyright Office. Users will upload ripped films.

## Non-blocking, but worth doing soon

- [ ] Socket scaling. Presence and room membership live in a per-process `Map`,
      so more than one backend instance will not share state. Add the Socket.io
      Redis adapter before scaling horizontally.
- [ ] Message retention. Chat is stored indefinitely; history returns the newest
      200. Add a TTL index if storage matters.
- [ ] E2E coverage of the two-user flow: host creates, guest requests, host
      approves, both watch in sync. This is the product's core promise and is
      currently only verified by hand.
- [ ] Archive metadata quality. Titles come in with `genre: 'Archive'` and no
      rating. A genre-mapping pass would make the library look less uniform.
- [ ] Observability. There is no error tracking; a Sentry DSN on both halves
      would pay for itself in the first week.
- [ ] Accessibility audit with a screen reader. Roles and labels were added
      throughout the redesign but have not been tested with assistive tech.

## Verified against real infrastructure

- The Internet Archive integration returns genuinely playable films. An imported
  title (`Nosferatu (1922)`) stored a URL that serves `HTTP 206 Partial Content`
  with `Accept-Ranges: bytes` on a 493MB MP4 whose `moov` atom sits at byte 36,
  so it is faststart-optimised and seekable.
- Archive search latency is ~6s (down from ~11s after capping per-item metadata
  lookups at 5s and trimming the candidate list to 12). It is a third-party
  dependency with no SLA; the UI shows a spinner throughout. If it needs to be
  faster, cache resolved identifiers in Mongo and serve repeat searches locally.

## Known limitations

- Room capacity is capped at 10, and WebRTC is full-mesh — every participant
  connects to every other. Beyond roughly 6 concurrent cameras this becomes
  bandwidth-bound on the client. An SFU is the fix, and it is a large change.
- Internet Archive delivery has no SLA and variable bitrate. Acceptable for
  launch; not a foundation for a paid tier.
- Browser playback of archive files was not confirmed end to end: the preview
  pane used for verification never issued the media requests. The URL itself is
  proven streamable and seekable by direct HTTP, and the player is wired to it,
  but it is worth opening a room in a real browser before launch.
- Playback sync tolerates 0.75s of drift by design. The PRD asks for 500ms;
  tightening the tolerance costs more visible micro-seeks and should be measured
  against real sessions before changing.
