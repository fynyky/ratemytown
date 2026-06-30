# RateMyTown.sg

TripAdvisor for Singapore town councils — a platform where Singpass-verified
residents leave honest, structured reviews of their town council's service,
cleanliness, maintenance, pest control, and estate environment. Scores are
published publicly to close the feedback loop and create accountability.

This is a server-side-rendered implementation of the
[design mock](https://claude.ai/design/p/d528842e-0995-46c1-bd10-ae157d36f2be)
built on a deliberately simple stack: **Express + EJS + PostgreSQL**, no
client-side framework.

## Screens

| Route | Screen |
|---|---|
| `/` | Leaderboard — town councils ranked by overall score, sortable by category |
| `/town/:slug` | Town page — score breakdown, per-category ranks, AI-style summary, resident reviews |
| `/rate` | Review form — overall + per-category star ratings, optional free text |
| `/rate/verify` → `/rate/submit` | Mock Singpass residency verification, then publish |
| `/guide` | Rating guide — what each star and category means |
| `/about` | Why the platform exists |

## Architecture

- **`src/server.js`** — Express app and routes.
- **`src/db/`** — `schema.sql`, connection `pool.js`, aggregation `queries.js`,
  and `init.js` / `seed.js` scripts.
- **`src/views/`** — EJS templates (server-side rendered).
- **`src/categories.js`** — the five service categories and rating scale.
- **`src/identity.js`** — NRIC hashing (see privacy note below).
- **`public/`** — `styles.css` (adapted from the mock) and a small `app.js`
  that enhances the star-rating inputs.

### Data model (PRD §9.1)

Three tables: `town_councils`, `residents`, `reviews`. A resident may submit
**one review per town council** (enforced by a unique constraint); re-submitting
updates the existing review.

### Privacy by design (PRD §10)

The raw NRIC is **never stored**. On verification it is hashed with a
server-side secret salt (`NRIC_HASH_SALT`) and only the hash is persisted.
Re-hashing on the next sign-in retrieves the same resident, which is how
one-review-per-resident is enforced without keeping any identity at rest.

> The Singpass step here is **mocked** — entering any syntactically valid
> NRIC/FIN simulates verification. A production integration would use
> Singpass/Myinfo, which also returns the registered address (and therefore the
> town council) directly.

## Getting started

Requires Node 18+ and a running PostgreSQL.

```bash
npm install
cp .env.example .env          # adjust DATABASE_URL / NRIC_HASH_SALT
npm run db:reset              # create schema + seed 19 town councils with reviews
npm start                     # http://localhost:3000
```

Scripts:

- `npm start` — run the server
- `npm run dev` — run with `--watch` auto-reload
- `npm run db:init` — (re)create the schema (drops existing tables)
- `npm run db:seed` — load seed data
- `npm run db:reset` — init + seed

## Notes & scope

This implements the mocked screens. Out of scope for this build (called out in
the PRD as later phases): real Singpass/Myinfo, photo uploads, town-council
response accounts, anomaly/coordination detection, and LLM-generated summaries
(the per-town summary is currently seeded copy).
