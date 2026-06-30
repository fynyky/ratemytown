// Small view helpers shared across templates.

// Returns an array of 5 booleans for filled stars given a 1-5 score.
export function starArray(score) {
  const rounded = Math.round(Number(score) || 0);
  return [1, 2, 3, 4, 5].map((i) => i <= rounded);
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

// Thousands separator.
export function fmtCount(n) {
  return Number(n).toLocaleString('en-US');
}
