import { query } from './pool.js';
import { CATEGORY_KEYS, MIN_REVIEWS_FOR_SCORE } from '../categories.js';

// SQL fragment: average of each rating column + count, for a town council.
const AVG_COLUMNS = [
  'COUNT(r.id)::int AS review_count',
  'AVG(r.overall)::numeric(10,4) AS overall',
  ...CATEGORY_KEYS.map((k) => `AVG(r.${k})::numeric(10,4) AS ${k}`),
].join(', ');

// Sort key -> aggregate expression for the leaderboard.
const SORT_EXPR = {
  overall: 'AVG(r.overall)',
  service: 'AVG(r.service)',
  cleanliness: 'AVG(r.cleanliness)',
  maintenance: 'AVG(r.maintenance)',
  pest_control: 'AVG(r.pest_control)',
  environment: 'AVG(r.environment)',
};

export const SORT_KEYS = Object.keys(SORT_EXPR);

// Leaderboard: every TC with its aggregate scores, ordered by `sort`.
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
               tc.name ASC`
  );
  return rows.map(decorate);
}

// Per-category rank of a town council among all TCs (1 = best).
export async function getCategoryRanks() {
  const ranks = {};
  for (const key of ['overall', ...CATEGORY_KEYS]) {
    const col = key === 'overall' ? 'overall' : key;
    const { rows } = await query(
      `SELECT tc.id,
              RANK() OVER (ORDER BY AVG(r.${col}) DESC NULLS LAST) AS rnk,
              COUNT(r.id)::int AS n
         FROM town_councils tc
         LEFT JOIN reviews r ON r.town_council_id = tc.id
        GROUP BY tc.id`
    );
    ranks[key] = {};
    for (const row of rows) ranks[key][row.id] = { rank: row.rnk, n: row.n };
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
  for (const key of keys) {
    await query(
      `INSERT INTO review_photos (review_id, object_key) VALUES ($1, $2)`,
      [reviewId, key]
    );
  }
}

export async function listTownCouncils() {
  const { rows } = await query(
    `SELECT id, slug, name, area FROM town_councils ORDER BY name ASC`
  );
  return rows;
}

export async function getTownCouncilById(id) {
  const { rows } = await query(`SELECT * FROM town_councils WHERE id = $1`, [id]);
  return rows[0] || null;
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
      cats.service,
      cats.cleanliness,
      cats.maintenance,
      cats.pest_control,
      cats.environment,
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
