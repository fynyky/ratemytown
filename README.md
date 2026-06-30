# RateMyTown.sg

TripAdvisor for Singapore town councils — a platform where Singpass-verified
residents leave honest, structured reviews of their town council's service,
cleanliness, maintenance, pest control, and estate environment. Scores are
published publicly to close the feedback loop and create accountability.

This is a server-side-rendered implementation of the
[design mock](https://claude.ai/design/p/d528842e-0995-46c1-bd10-ae157d36f2be)
built on a deliberately simple stack: **Express + EJS + PostgreSQL**, with
**Redis** for sessions/caching and **MinIO** (S3-compatible) for photo storage.
No client-side framework.

## Quick start

From a fresh clone (Node 18+ and a Debian/Ubuntu-like environment with `sudo`):

```bash
npm install
cp .env.example .env
npm run setup     # provision Postgres + Redis + MinIO, then create schema + seed
npm start         # http://localhost:3000
```

That's it. `npm run setup` installs any missing service binaries, creates the
database role/database and the storage bucket, starts all three services, and
loads seed data (19 town councils with reviews).

> **In the dev container** this is automatic: the container's `postCreate` runs
> `npm run setup` for you, and `postStart` restarts the services, so the app is
> ready after the container builds.

## Local services

All three run **natively** (no Docker required) and are managed by `scripts/dev`:

| Service | Purpose | Address | Managed data |
|---|---|---|---|
| PostgreSQL | Relational data (town councils, residents, reviews) | `localhost:5432` | system cluster |
| Redis | Sessions + leaderboard cache | `localhost:6379` | `.devdata/redis/` |
| MinIO | S3-compatible blobstore for review photos | API `localhost:9000`, console `localhost:9001` | `.devdata/minio/` |

`.devdata/` is gitignored. The MinIO console (login `ratemytown` /
`ratemytown-dev-secret`) is handy for browsing uploaded photos.

```bash
npm run services:setup    # install + provision + start (idempotent)
npm run services:start    # start anything not running
npm run services:status   # show what's up
npm run services:stop     # stop Redis + MinIO
```

## Screens

| Route | Screen |
|---|---|
| `/` | Leaderboard — town councils ranked by overall score, sortable by category |
| `/town/:slug` | Town page — score breakdown, per-category ranks, AI-style summary, resident reviews + photos |
| `/rate` | Review form — overall + per-category star ratings, free text, photo upload |
| `/rate/verify` → `/rate/submit` | Mock Singpass residency verification, then publish |
| `/uploads/:key` | Streams a review photo from the blobstore |
| `/guide` | Rating guide — what each star and category means |
| `/about` | Why the platform exists |

## Architecture

- **`src/server.js`** — Express app and routes.
- **`src/config.js`** — single source of truth for env configuration.
- **`src/db/`** — `schema.sql`, connection `pool.js`, aggregation `queries.js`,
  and `init.js` / `seed.js` scripts.
- **`src/services/`** — `redis.js` (client + cache helpers) and `storage.js`
  (MinIO/S3 client + image upload).
- **`src/session.js`** — Redis-backed `express-session`.
- **`src/views/`** — EJS templates (server-side rendered).
- **`src/categories.js`** — the five service categories and rating scale.
- **`src/identity.js`** — NRIC hashing (see privacy note below).
- **`public/`** — `styles.css` (adapted from the mock) and `app.js` (star-input
  and file-input enhancements).
- **`scripts/dev`** — provisions and runs the local services.

### How the services are used

- **Redis sessions** carry the in-progress review across the Singpass step:
  `/rate/verify` stores a draft (ratings + uploaded photo keys) in the session,
  and `/rate/submit` reads it back — so review data never round-trips through
  hidden form fields.
- **Redis cache** memoises each leaderboard variant (`lb:<sort>`, 30s TTL) and
  is invalidated whenever a review is published.
- **MinIO blobstore** holds review photos. On submit the form's images are
  streamed into the bucket; only the object key is stored in Postgres
  (`review_photos`), and photos are served back through `/uploads/:key`.

### Data model (PRD §9.1)

Tables: `town_councils`, `residents`, `reviews`, `review_photos`. A resident may
submit **one review per town council** (enforced by a unique constraint);
re-submitting updates the existing review.

### Privacy by design (PRD §10)

The raw NRIC is **never stored**. On verification it is hashed with a
server-side secret salt (`NRIC_HASH_SALT`) and only the hash is persisted.
Re-hashing on the next sign-in retrieves the same resident, which is how
one-review-per-resident is enforced without keeping any identity at rest.

> The Singpass step here is **mocked** — entering any syntactically valid
> NRIC/FIN simulates verification. A production integration would use
> Singpass/Myinfo, which also returns the registered address (and therefore the
> town council) directly.

## Environment variables

See `.env.example`. Notable ones:

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql://node:node@localhost:5432/ratemytown` | Postgres connection |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection |
| `SESSION_SECRET` | dev placeholder | session cookie signing secret |
| `S3_ENDPOINT` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` / `S3_BUCKET` | MinIO dev values | blobstore |
| `NRIC_HASH_SALT` | dev placeholder | salt for hashing NRICs |

In production, point `S3_*` at any S3-compatible store and replace every dev
placeholder secret.

## npm scripts

| Script | Does |
|---|---|
| `npm run setup` | provision services + `db:reset` (one-shot first-run) |
| `npm start` / `npm run dev` | run the server (`dev` watches for changes) |
| `npm run db:init` / `db:seed` / `db:reset` | schema / seed / both |
| `npm run services:{setup,start,stop,status}` | manage the local services |

## Scope

This implements the mocked screens with real backing services. Out of scope for
this build (later phases per the PRD): real Singpass/Myinfo, town-council
response accounts, anomaly/coordination detection, and LLM-generated summaries
(the per-town summary is currently seeded copy).
