-- RateMyTown.sg schema
-- Entity model is intentionally simple (PRD §9.1):
--   Town Council  — the unit being reviewed (19 of them)
--   Resident      — a Singpass-verified person, stored only as a salted hash
--   Review        — one per resident per town council

DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS residents CASCADE;
DROP TABLE IF EXISTS town_councils CASCADE;

CREATE TABLE town_councils (
  id            SERIAL PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  area          TEXT NOT NULL,          -- e.g. "Tampines GRC · 12 estates"
  estates_count INTEGER NOT NULL DEFAULT 0,
  tile_gradient TEXT NOT NULL,          -- leaderboard tile background
  blurb         TEXT,                   -- AI-style "in residents' words" summary
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Privacy by design (PRD §10): we never store the raw NRIC, only a hash
-- computed with a server-side secret salt. Re-hashing on the next sign-in
-- retrieves the same resident, enforcing one-review-per-resident.
CREATE TABLE residents (
  id          SERIAL PRIMARY KEY,
  nric_hash   TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE reviews (
  id              SERIAL PRIMARY KEY,
  town_council_id INTEGER NOT NULL REFERENCES town_councils(id) ON DELETE CASCADE,
  resident_id     INTEGER NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  overall         SMALLINT NOT NULL CHECK (overall BETWEEN 1 AND 5),
  service         SMALLINT NOT NULL CHECK (service BETWEEN 1 AND 5),
  cleanliness     SMALLINT NOT NULL CHECK (cleanliness BETWEEN 1 AND 5),
  maintenance     SMALLINT NOT NULL CHECK (maintenance BETWEEN 1 AND 5),
  pest_control    SMALLINT NOT NULL CHECK (pest_control BETWEEN 1 AND 5),
  environment     SMALLINT NOT NULL CHECK (environment BETWEEN 1 AND 5),
  good_text       TEXT,
  bad_text        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One resident, one voice per town council (PRD §9.1). Re-submitting updates.
  UNIQUE (town_council_id, resident_id)
);

CREATE INDEX idx_reviews_tc ON reviews(town_council_id);
CREATE INDEX idx_reviews_created ON reviews(created_at DESC);
