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

### Recommended: the dev container

Open the repo in the dev container (VS Code "Reopen in Container", or the
devcontainer CLI). The backing services come up automatically as part of the
container — nothing to install. After it builds:

```bash
npm start         # http://localhost:3000
```

The container's `postCreate` already ran `npm install` and `npm run db:reset`
(creating the schema and seeding 19 town councils). Service connection settings
are injected by Compose, so you don't even need a `.env`.

### Without the dev container

The same Compose stack can be run on its own; the app then talks to the
services on `localhost`:

```bash
docker compose -f .devcontainer/docker-compose.yml up -d   # postgres, redis, minio
npm install
cp .env.example .env
npm run db:reset
npm start
```

## Backing services

Defined declaratively in [`.devcontainer/docker-compose.yml`](.devcontainer/docker-compose.yml)
as sibling containers from official images (no binaries installed into the
workspace). In the dev container the app reaches them by service name; on bare
metal, by `localhost`.

| Service | Image | Purpose | Address (host) |
|---|---|---|---|
| PostgreSQL | `postgres:17` | Relational data | `localhost:5432` |
| Redis | `redis:7-alpine` | Sessions + leaderboard cache | `localhost:6379` |
| MinIO | `minio/minio` | S3-compatible blobstore for review photos | API `:9000`, console `:9001` |

Data persists in named Docker volumes (`pgdata`, `redisdata`, `miniodata`). The
MinIO console (login `ratemytown` / `ratemytown-dev-secret`) is handy for
browsing uploaded photos. Manage the stack with the usual Compose commands
(`up -d`, `down`, `ps`, `logs`).

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
- **`.devcontainer/`** — `docker-compose.yml` (the backing services) and
  `devcontainer.json`.

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
| `npm start` / `npm run dev` | run the server (`dev` watches for changes) |
| `npm run db:init` / `db:seed` / `db:reset` | schema / seed / both |

The backing services are managed with Docker Compose (see above), not npm.

## Scope

This implements the mocked screens with real backing services. Out of scope for
this build (later phases per the PRD): real Singpass/Myinfo, town-council
response accounts, anomaly/coordination detection, and LLM-generated summaries
(the per-town summary is currently seeded copy).
