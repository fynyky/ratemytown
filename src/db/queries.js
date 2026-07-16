import { query } from './pool.js';
import { CATEGORY_KEYS, MIN_REVIEWS_FOR_SCORE } from '../categories.js';

// A category score only counts once enough residents have rated that specific
// category. `overall` is required of every review, so the row's review_count
// gates it (see `decorate`); the specifics are optional, so each needs its own
// count — otherwise one resident rating one category would produce a headline
// score and a podium rank off a single opinion (PRD §9.4).
// COUNT(col) ignores NULLs, and a CASE with no ELSE yields NULL, which every
// caller already renders as "not rated yet".
const scoreExpr = (key) =>
  key === 'overall'
    ? 'AVG(r.overall)'
    : `CASE WHEN COUNT(r.${key}) >= ${MIN_REVIEWS_FOR_SCORE} THEN AVG(r.${key}) END`;

// SQL fragment: average of each rating column + count, for a town council.
const AVG_COLUMNS = [
  'COUNT(r.id)::int AS review_count',
  `${scoreExpr('overall')}::numeric(10,4) AS overall`,
  ...CATEGORY_KEYS.map((k) => `${scoreExpr(k)}::numeric(10,4) AS ${k}`),
].join(', ');

// Sort key -> aggregate expression for the leaderboard (overall + each category).
// Same expression as the display, so a score can never sort above the rows it is
// not even shown against.
const SORT_EXPR = Object.fromEntries(
  ['overall', ...CATEGORY_KEYS].map((k) => [k, scoreExpr(k)])
);

export const SORT_KEYS = Object.keys(SORT_EXPR);

// Leaderboard: every TC with its aggregate scores, ordered by `sort`. Equal
// scores are broken by review count, so the better-evidenced TC ranks higher.
// TCs with too few reviews are returned but flagged `suppressed`.
export async function getLeaderboard(sort = 'overall') {
  const expr = SORT_EXPR[sort] || SORT_EXPR.overall;
  const { rows } = await query(
    `SELECT tc.id, tc.slug, tc.name, tc.area, ${AVG_COLUMNS}
       FROM town_councils tc
       LEFT JOIN reviews r ON r.town_council_id = tc.id
      GROUP BY tc.id
      ORDER BY (COUNT(r.id) >= ${MIN_REVIEWS_FOR_SCORE}) DESC,
               ${expr} DESC NULLS LAST,
               COUNT(r.id) DESC,
               tc.name ASC`
  );
  return rows.map(decorate);
}

// Rank of every town council (1 = best), overall and per category, as
// ranks[key][tcId] = rank. Window functions run after GROUP BY, so all six
// rankings come out of a single aggregate pass.
export async function getCategoryRanks() {
  const keys = ['overall', ...CATEGORY_KEYS];
  const rankColumns = keys
    .map((k) => `RANK() OVER (ORDER BY ${scoreExpr(k)} DESC NULLS LAST)::int AS ${k}`)
    .join(', ');
  const { rows } = await query(
    `SELECT tc.id, ${rankColumns}
       FROM town_councils tc
       LEFT JOIN reviews r ON r.town_council_id = tc.id
      GROUP BY tc.id`
  );
  const ranks = Object.fromEntries(keys.map((k) => [k, {}]));
  for (const row of rows) {
    for (const k of keys) ranks[k][row.id] = row[k];
  }
  return ranks;
}

export async function getTownCouncilBySlug(slug) {
  const { rows } = await query(
    `SELECT tc.id, tc.slug, tc.name, tc.area, tc.blurb, ${AVG_COLUMNS}
       FROM town_councils tc
       LEFT JOIN reviews r ON r.town_council_id = tc.id
      WHERE tc.slug = $1
      GROUP BY tc.id`,
    [slug]
  );
  if (!rows[0]) return null;
  return decorate(rows[0]);
}

export async function getRecentReviews(townCouncilId, limit = 8) {
  const { rows } = await query(
    `SELECT id, overall, service, cleanliness, maintenance, pest_control,
            environment, good_text, bad_text, created_at
       FROM reviews
      WHERE town_council_id = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [townCouncilId, limit]
  );
  // Attach photo object keys for these reviews.
  if (rows.length) {
    const ids = rows.map((r) => r.id);
    const { rows: photos } = await query(
      `SELECT review_id, object_key FROM review_photos
        WHERE review_id = ANY($1) ORDER BY id ASC`,
      [ids]
    );
    const byReview = new Map();
    for (const p of photos) {
      if (!byReview.has(p.review_id)) byReview.set(p.review_id, []);
      byReview.get(p.review_id).push(p.object_key);
    }
    for (const r of rows) r.photos = byReview.get(r.id) || [];
  }
  return rows;
}

// Replace a review's photos with a new set of object keys.
export async function setReviewPhotos(reviewId, keys) {
  await query(`DELETE FROM review_photos WHERE review_id = $1`, [reviewId]);
  await query(
    `INSERT INTO review_photos (review_id, object_key)
     SELECT $1, unnest($2::text[])`,
    [reviewId, keys]
  );
}

export async function listTownCouncils() {
  const { rows } = await query(
    `SELECT id, slug, name, area FROM town_councils ORDER BY name ASC`
  );
  return rows;
}

// Upsert a resident by NRIC hash; returns resident id.
export async function findOrCreateResident(nricHash) {
  const { rows } = await query(
    `INSERT INTO residents (nric_hash) VALUES ($1)
     ON CONFLICT (nric_hash) DO UPDATE SET nric_hash = EXCLUDED.nric_hash
     RETURNING id`,
    [nricHash]
  );
  return rows[0].id;
}

// One review per resident per TC: insert, or update an existing one.
export async function upsertReview(review) {
  const { townCouncilId, residentId, overall, cats, goodText, badText } = review;
  const { rows } = await query(
    `INSERT INTO reviews
       (town_council_id, resident_id, overall, service, cleanliness,
        maintenance, pest_control, environment, good_text, bad_text)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (town_council_id, resident_id) DO UPDATE SET
       overall = EXCLUDED.overall,
       service = EXCLUDED.service,
       cleanliness = EXCLUDED.cleanliness,
       maintenance = EXCLUDED.maintenance,
       pest_control = EXCLUDED.pest_control,
       environment = EXCLUDED.environment,
       good_text = EXCLUDED.good_text,
       bad_text = EXCLUDED.bad_text,
       updated_at = now()
     RETURNING id, (xmax = 0) AS inserted`,
    [
      townCouncilId,
      residentId,
      overall,
      cats.service ?? null,
      cats.cleanliness ?? null,
      cats.maintenance ?? null,
      cats.pest_control ?? null,
      cats.environment ?? null,
      goodText || null,
      badText || null,
    ]
  );
  return { id: rows[0].id, isNew: rows[0].inserted };
}

// Attach derived display fields (suppression flag, numeric scores).
function decorate(row) {
  const count = row.review_count || 0;
  const suppressed = count < MIN_REVIEWS_FOR_SCORE;
  const num = (v) => (v == null ? null : Number(v));
  return {
    ...row,
    review_count: count,
    suppressed,
    overall: num(row.overall),
    scores: Object.fromEntries(CATEGORY_KEYS.map((k) => [k, num(row[k])])),
  };
}
