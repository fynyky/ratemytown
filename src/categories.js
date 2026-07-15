// Shared star labels — the description for each star is category-specific
// (see each category's `scale` below).
const SCALE_LABELS = [
  [5, 'Excellent'],
  [4, 'Good'],
  [3, 'Fair'],
  [2, 'Poor'],
  [1, 'Very poor'],
];

// Build a category's rating scale from five descriptions ordered 5★ → 1★.
const buildScale = (descs) => {
  if (descs.length !== SCALE_LABELS.length)
    throw new Error(`buildScale expects ${SCALE_LABELS.length} descriptions, got ${descs.length}`);
  return SCALE_LABELS.map(([n, label], i) => ({ n, label, desc: descs[i] }));
};

// Service categories, framed around what residents experience (PRD §9.1).
// `key` is the DB column / form field; `label` matches the design mock.
// `scale` is the per-category rating guide (the bottom sheet opened from the
// ⓘ, mock screen 03), with one description per star from 5★ down to 1★.
export const CATEGORIES = [
  {
    key: 'service',
    label: 'Service',
    short: 'Service',
    desc: 'How quickly and helpfully the council handles requests, repairs, and feedback.',
    scale: buildScale([
      'Requests are acknowledged quickly and resolved promptly; staff follow up without chasing.',
      'Most requests are handled well, with only the occasional delay.',
      'Things get done eventually, but often slowly or after a reminder.',
      'Frequent delays and little follow-up on what you report.',
      'Requests are routinely ignored or left unresolved.',
    ]),
  },
  {
    key: 'cleanliness',
    label: 'Cleanliness',
    short: 'Clean',
    desc: 'How well common areas are kept — corridors, lifts, void decks, and bin centres.',
    scale: buildScale([
      'Corridors, lifts, void decks, and bin centres are consistently spotless and fresh.',
      'Common areas are clean most of the time, with only rare lapses.',
      'Generally acceptable, but litter or grime lingers between cleanings.',
      'Common areas are often dirty, with overflowing bins or lingering smells.',
      'Filthy, neglected spaces that are rarely cleaned.',
    ]),
  },
  {
    key: 'maintenance',
    label: 'Maintenance',
    short: 'Maint',
    desc: 'Upkeep of shared property: lifts, lighting, paintwork, railings, and fittings.',
    scale: buildScale([
      'Lifts, lighting, and fittings work reliably; repairs happen fast.',
      'Shared property is well kept, with only minor issues now and then.',
      'Things mostly work, but breakdowns take a while to fix.',
      'Frequent faults — broken lifts, flickering lights, loose fittings — left unaddressed.',
      'Persistent breakdowns and visible disrepair that go unfixed.',
    ]),
  },
  {
    key: 'pest_control',
    label: 'Pest control',
    short: 'Pest',
    desc: 'Handling of mosquitoes, rodents, and other pests across shared spaces.',
    scale: buildScale([
      'Pests are rare, and dealt with promptly whenever they appear.',
      'The occasional pest, but problems are handled before they spread.',
      'Recurring pest sightings that take time to bring under control.',
      'Frequent infestations with slow or patchy treatment.',
      'Persistent rodents, mosquitoes, or other pests left unchecked.',
    ]),
  },
  {
    key: 'environment',
    label: 'Estate environment',
    short: 'Env',
    desc: 'Greenery, walkways, drainage, and the overall feel of the estate.',
    scale: buildScale([
      'Greenery, walkways, and drainage are well maintained and pleasant throughout.',
      'The estate feels well kept, with only minor rough edges.',
      'Liveable, but greenery and walkways could be better looked after.',
      'Neglected greenery, poor drainage, or a generally run-down feel.',
      'Overgrown, poorly drained, and uninviting throughout.',
    ]),
  },
];

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);

// A score needs at least this many verified reviews before it is shown
// rather than suppressed as "Not enough verified reviews yet" (PRD §9.4).
export const MIN_REVIEWS_FOR_SCORE = 3;
