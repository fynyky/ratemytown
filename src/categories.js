// Service categories, framed around what residents experience (PRD §9.1).
// `key` is the DB column / form field; `label` matches the design mock.
export const CATEGORIES = [
  {
    key: 'service',
    label: 'Service',
    short: 'Service',
    desc: 'How quickly and helpfully the council handles requests, repairs, and feedback.',
  },
  {
    key: 'cleanliness',
    label: 'Cleanliness',
    short: 'Clean',
    desc: 'Common areas — corridors, lifts, void decks, bin centres — and how well they’re kept.',
  },
  {
    key: 'maintenance',
    label: 'Maintenance',
    short: 'Maint',
    desc: 'Upkeep of shared property: lifts, lighting, paintwork, railings, and fittings.',
  },
  {
    key: 'pest_control',
    label: 'Pest control',
    short: 'Pest',
    desc: 'Handling of mosquitoes, rodents, and other pests across shared spaces.',
  },
  {
    key: 'environment',
    label: 'Estate environment',
    short: 'Env',
    desc: 'Greenery, walkways, drainage, and the overall feel of the estate.',
  },
];

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);

// Per-category rating guide (the bottom sheet opened from the ⓘ, mock screen 03).
export const RATING_SCALE = [
  [5, 'Excellent', 'Requests are acknowledged quickly and resolved promptly; staff follow up without chasing.'],
  [4, 'Good', 'Most issues are handled well, with only the occasional delay.'],
  [3, 'Fair', 'Things get done eventually, but often slowly or after a reminder.'],
  [2, 'Poor', 'Frequent delays and little follow-up on what you report.'],
  [1, 'Very poor', 'Requests are routinely ignored or left unresolved.'],
].map(([n, label, desc]) => ({ n, label, desc }));

// A score needs at least this many verified reviews before it is shown
// rather than suppressed as "Not enough verified reviews yet" (PRD §9.4).
export const MIN_REVIEWS_FOR_SCORE = 3;
