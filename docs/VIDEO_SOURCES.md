# Where ConnectUS Can Get Video

Research notes, August 2026. Written to support one decision: **what fills the movie
library at launch?**

## The constraint nobody can engineer around

There is no API — free or paid, at any startup-accessible price — that streams
licensed Hollywood films to a third-party app. Netflix, Disney, and Amazon do not
license catalog streaming to outside platforms. Anyone selling you "a movie
streaming API" is either serving public-domain content, serving metadata only, or
serving pirated streams.

That leaves exactly four legal architectures. ConnectUS can ship any of them, and
they are not mutually exclusive.

---

## Option A — Public-domain / open-licence catalog

Real films, streamable today, zero licensing risk and zero hosting cost.

### Internet Archive (primary recommendation)

The `feature_films` collection alone returns **28,417 items**. No API key, no
published rate limit, no cost.

**Search** — `GET https://archive.org/advancedsearch.php`

```
https://archive.org/advancedsearch.php
  ?q=collection:(feature_films) AND mediatype:(movies)
  &fl[]=identifier&fl[]=title&fl[]=year&fl[]=description
  &rows=50&page=1&output=json
```

**File listing** — `GET https://archive.org/metadata/{identifier}`

Returns a `files[]` array. Filter for `format: "512Kb MPEG4"` or `"h.264"`.

**Critical gotcha:** the video filename is *not* the identifier. Item
`ZEITGEIST-REMASTERED` contains `ZeitgeistTheMovieRem_512kb.mp4`. You must read the
metadata to construct a playback URL — you cannot guess it.

**Playback** — `https://archive.org/download/{identifier}/{filename}`

Verified against a live item:

| Property | Result | Why it matters for ConnectUS |
|---|---|---|
| `Access-Control-Allow-Origin` | `*` | Works cross-origin from the browser |
| `Accept-Ranges` | `bytes` | |
| Range request | `HTTP 206 Partial Content` | **Seeking works** — required for host-controlled sync |
| Redirect | 302 to a regional node | Follow it; `<video>` does this automatically |
| Cost | $0 | |

Range support is the one that decides it. Without HTTP 206 the host could not seek,
and seek-sync is a core PRD requirement.

**Caveats.** Quality is uneven — many items are old telecine transfers. Metadata is
user-contributed and messy (missing years, inconsistent genres). Delivery is
best-effort from a nonprofit's infrastructure; there is no SLA and no guaranteed
bitrate ladder. For a launch catalog this is acceptable; for a paid product it is
not a foundation.

### Blender Open Movies

*Big Buck Bunny*, *Sintel*, *Tears of Steel*, *Elephants Dream*, *Spring*, *Cosmos
Laundromat*. CC-BY, professionally produced, available up to 4K.

No API — roughly a dozen films, so hardcode them. **This is what the codebase already
uses** (`backend/src/controllers/movieController.ts` seeds Google's sample-bucket
copies). Worth keeping as a guaranteed-quality baseline regardless of what else ships.

### Wikimedia Commons

`GET https://commons.wikimedia.org/w/api.php` — free, CC/PD, but the video holdings
are documentary and archival rather than feature films. Secondary at best.

---

## Option B — Metadata-only APIs

These give you posters, synopses, cast, and ratings. **None of them give you a video
stream.** They make a library look professional; they do not fill it.

### TMDB

Excellent data, huge poster library, historically ~40–50 req/s.

**The catch, and it is a real one for ConnectUS:** the free key is licensed for
non-commercial use only. Commercial use requires a written agreement with TMDB.
Their terms also mandate the notice *"This product uses the TMDb API but is not
endorsed or certified by TMDb"* displayed prominently.

If ConnectUS ever charges for anything — subscriptions, tiers, ads — you need to
contact TMDB for a commercial licence before launch, not after. If it stays free,
the free key is fine with attribution.

### OMDb

Simpler, IMDb-derived. Free tier 1,000 req/day; ~$1/mo patron tier above that. Its
commercial terms are less restrictive than TMDB's but the data is thinner.

**Note the mismatch:** TMDB metadata describes films you cannot legally stream. It
only makes sense paired with content you *do* control — i.e. Option D.

---

## Option C — Stock footage APIs

**Pexels** — free, commercial use permitted, no attribution required. 200 req/hr and
20,000 req/mo by default; unlimited on request if you meet their terms.

**Pixabay** — free, commercial use, no attribution. 100 req/60s, with a mandatory
24-hour response-caching requirement.

Both are genuinely free for commercial use, which makes them tempting. But they serve
30-second B-roll clips, not films. **Useful for landing-page backgrounds and
empty-state visuals. Useless as watch-party content** — nobody hosts a movie night
for a drone shot of a beach.

---

## Option D — Host your own (user uploads)

The only path to arbitrary content, and the only one with real recurring cost. The
codebase already has partial Mux plumbing (`backend/src/utils/mux.ts`,
`UploadMovieModal.tsx`, `@mux/mux-player-react`).

| Provider | Encoding | Storage | Delivery | Notes |
|---|---|---|---|---|
| **Cloudflare Stream** | included | $1 / 1,000 min | $5 / 1,000 min | Simplest pricing; bundles encode + player |
| **Bunny Stream** | included | ~$0.01/GB | ~$0.005–0.01/GB | Cheapest; roughly half Cloudflare for basic use |
| **Mux** | $0.07/min | — | $0.025/min | Best analytics and live; priciest for plain VOD |

Reported multiples vary by workload, but the ordering is consistent: Bunny cheapest,
Cloudflare close behind, Mux a premium for features ConnectUS does not currently use.

**The problem is not cost, it is liability.** The moment users upload arbitrary video,
ConnectUS is a UGC platform: you need DMCA takedown handling, a designated agent
registered with the Copyright Office, and moderation. Users *will* upload ripped
films. Budget for that as a legal and operational cost, not just a bandwidth line
item.

---

## Option E — The Teleparty model (worth knowing about)

Teleparty, Scener, and Hulu Watch Party never touch the video. Each viewer streams
from **their own** subscription; the product synchronises playback state only.

Zero content cost, zero licensing risk, zero bandwidth. The price is that it requires
a browser extension and every participant must already subscribe to the same service.
That is a fundamentally different product from what the PRD describes and would mean
abandoning the in-app player, so I raise it for completeness rather than recommend it.

---

## Recommendation

**Ship A + D, add B only if ConnectUS stays free.**

1. **Internet Archive as the launch catalog.** Real films, verified streamable with
   working seek, $0, no licensing exposure. Fixes the current state where the library
   is six fictional titles all pointing at Big Buck Bunny.
2. **Blender open movies hardcoded** as a quality-guaranteed shelf, so the library
   never looks like it is entirely 1940s public domain.
3. **Finish the upload path on Bunny or Cloudflare rather than Mux** — same
   capability at a fraction of the cost, given ConnectUS uses none of Mux's analytics
   or live features. Gate uploads behind moderation before opening them publicly.
4. **Hold TMDB** until the commercial question is settled. Archive.org metadata is
   worse but carries no licensing condition, and swapping in TMDB later is a
   contained change if the movie schema is kept source-agnostic.

The implementation consequence: `Movie` should carry a `source` discriminator
(`archive` | `blender` | `upload`) rather than assuming every record has a Mux
playback ID, which is what the current schema does.

## Sources

- [Internet Archive Metadata API](https://archive.org/developers/metadata.html)
- [Internet Archive Developer Portal](https://archive.org/developers/)
- [TMDB API Terms of Use](https://www.themoviedb.org/api-terms-of-use)
- [TMDB API for Business](https://www.themoviedb.org/api-for-business)
- [Pexels API documentation](https://www.pexels.com/api/documentation/)
- [Pexels licence](https://www.pexels.com/license/)
- [Pixabay API documentation](https://pixabay.com/api/docs/)
- [Mux vs Cloudflare Stream vs Bunny Stream 2026](https://www.pkgpulse.com/guides/mux-vs-cloudflare-stream-vs-bunny-stream-video-cdn-2026)
- [Video streaming pricing comparison](https://www.buildmvpfast.com/api-costs/video)
