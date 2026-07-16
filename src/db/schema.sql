-- RateMyTown.sg schema
-- Entity model is intentionally simple (PRD §9.1):
--   Town Council  — the unit being reviewed (19 of them)
--   Resident      — a Singpass-verified person, stored only as a salted hash
--   Review        — one per resident per town council

DROP TABLE IF EXISTS review_photos CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS residents CASCADE;
DROP TABLE IF EXISTS town_councils CASCADE;

CREATE TABLE town_councils (
  id            SERIAL PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  area          TEXT NOT NULL,          -- e.g. "Tampines GRC · 12 estates"
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
  -- Only the overall rating is required. The specific categories are nullable:
  -- residents rate only what they know, and NULL means "didn't say" rather than
  -- a low score. AVG() skips NULLs, so a category's average reflects exactly
  -- the people who rated it (PRD §9.1).
  overall         SMALLINT NOT NULL CHECK (overall BETWEEN 1 AND 5),
  service         SMALLINT CHECK (service BETWEEN 1 AND 5),
  cleanliness     SMALLINT CHECK (cleanliness BETWEEN 1 AND 5),
  maintenance     SMALLINT CHECK (maintenance BETWEEN 1 AND 5),
  pest_control    SMALLINT CHECK (pest_control BETWEEN 1 AND 5),
  environment     SMALLINT CHECK (environment BETWEEN 1 AND 5),
  good_text       TEXT,
  bad_text        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One resident, one voice per town council (PRD §9.1). Re-submitting updates.
  UNIQUE (town_council_id, resident_id)
);

CREATE INDEX idx_reviews_tc ON reviews(town_council_id);
CREATE INDEX idx_reviews_created ON reviews(created_at DESC);

-- Optional photo evidence attached to a review. Only the object key in the
-- blobstore (MinIO/S3) is stored here; the bytes live in the bucket.
CREATE TABLE review_photos (
  id          SERIAL PRIMARY KEY,
  review_id   INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  object_key  TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_review_photos_review ON review_photos(review_id);
