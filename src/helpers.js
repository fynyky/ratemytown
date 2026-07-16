// Small view helpers shared across templates.

// How much of the five-star row to fill for a 1-5 score, as a CSS width.
// Fractional rather than rounded: 4.6 and 4.4 should not both read as "4".
export function starPct(score) {
  const n = Number(score) || 0;
  return `${((Math.min(Math.max(n, 0), 5) / 5) * 100).toFixed(1)}%`;
}

// Format an average score to one decimal, or null-safe dash.
export function fmtScore(v) {
  return v == null ? '—' : Number(v).toFixed(1);
}

// Human "x days/weeks ago" from a timestamp.
export function timeAgo(date) {
  const then = new Date(date).getTime();
  const days = Math.floor((Date.now() - then) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return '1 week ago';
  if (weeks < 5) return `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  return months <= 1 ? '1 month ago' : `${months} months ago`;
}

// Which categories a review rated highly (>=4), used for the little tags.
export function reviewTags(review, categories) {
  return categories
    .filter((c) => review[c.key] >= 4)
    .slice(0, 2)
    .map((c) => c.label);
}

// Rank the leaderboard rows by `key` ('overall' or a category key) and return a
// Map of town council id -> rank for the top `limit` only. Rows without a score
// (suppressed, or never rated) are excluded so they cannot occupy a podium slot.
// Ties share a rank, competition-style: 4.5, 4.5, 4.2 -> 1, 1, 3.
export function topRanks(rows, key, limit = 3) {
  const scoreOf = (r) => (key === 'overall' ? r.overall : r.scores[key]);
  const ranked = rows
    .filter((r) => !r.suppressed && scoreOf(r) != null)
    .sort((a, b) => scoreOf(b) - scoreOf(a));
  const out = new Map();
  ranked.forEach((r, i) => {
    const prev = ranked[i - 1];
    const rank = prev && scoreOf(prev) === scoreOf(r) ? out.get(prev.id) : i + 1;
    if (rank <= limit) out.set(r.id, rank);
  });
  return out;
}

// Thousands separator.
export function fmtCount(n) {
  return Number(n).toLocaleString('en-US');
}
