// Seeds 19 town councils and a spread of verified resident reviews.
// Deterministic (fixed PRNG seed) so re-seeding gives the same data.
import { pool } from './pool.js';
import { hashNric } from '../identity.js';

// --- deterministic PRNG (mulberry32) ---------------------------------------
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260630);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

// Clamp a category rating around a target, biased toward whole stars.
function ratingNear(target) {
  const jitter = (rand() - 0.5) * 2.4; // ±1.2
  return Math.max(1, Math.min(5, Math.round(target + jitter)));
}

// Build a leaderboard tile gradient (mirrors the mock's wash() helper).
function wash(a, b, c) {
  return (
    `radial-gradient(130% 100% at 88% 12%, ${a}, transparent 60%), ` +
    `linear-gradient(135deg, ${b}, ${c})`
  );
}

// 19 town councils (neutral framing, no party labels — PRD §10).
// [name, area, estates, targetOverall, gradient colors]
const TOWN_COUNCILS = [
  ['Tampines', 'Tampines GRC', 12, 4.5, ['#7bbf8f', '#cfe6d6', '#eff5ef']],
  ['Pasir Ris–Punggol', 'Pasir Ris–Punggol GRC', 14, 4.4, ['#7fc6cf', '#d2eaee', '#eef6f7']],
  ['Bishan–Toa Payoh', 'Bishan–Toa Payoh GRC', 9, 4.3, ['#d8b46a', '#ece0c4', '#f6f1e6']],
  ['Ang Mo Kio', 'Ang Mo Kio GRC', 11, 4.2, ['#e0976a', '#f0d8c6', '#f8efe8']],
  ['Marine Parade–Braddell Heights', 'Marine Parade–Braddell Heights GRC', 10, 4.1, ['#84a9d6', '#d4e2f0', '#eef3f8']],
  ['Jurong–Clementi', 'Jurong–Clementi GRC', 13, 4.0, ['#8fa6b8', '#d6e0e8', '#eef2f5']],
  ['Sengkang', 'Sengkang GRC', 7, 3.9, ['#8cc59b', '#d4ebd9', '#eff7f1']],
  ['Aljunied–Hougang', 'Aljunied–Hougang TC', 8, 3.8, ['#c79bc4', '#e6d4e6', '#f5eef5']],
  ['Chua Chu Kang', 'Chua Chu Kang GRC', 8, 4.1, ['#9ec77e', '#dcebcb', '#f1f6ea']],
  ['East Coast', 'East Coast GRC', 9, 4.0, ['#6cc0b6', '#cfe9e5', '#edf7f5']],
  ['Holland–Bukit Panjang', 'Holland–Bukit Panjang GRC', 8, 3.9, ['#d0a3cf', '#ecd9ec', '#f7eff7']],
  ['Jalan Besar', 'Jalan Besar GRC', 6, 4.2, ['#e3a86a', '#f1ddc6', '#f9f0e6']],
  ['Marsiling–Yew Tee', 'Marsiling–Yew Tee GRC', 7, 3.8, ['#8fb0d8', '#d6e2f1', '#eef3f9']],
  ['Nee Soon', 'Nee Soon GRC', 9, 4.0, ['#7cc6a0', '#cfeadd', '#edf7f1']],
  ['Sembawang', 'Sembawang GRC', 8, 3.9, ['#cdb46f', '#e9e0c5', '#f5f1e6']],
  ['Tanjong Pagar', 'Tanjong Pagar GRC', 10, 4.3, ['#cf8f7e', '#ecd4cc', '#f7efeb']],
  ['West Coast–Jurong West', 'West Coast–Jurong West GRC', 11, 3.7, ['#9aa6c7', '#d9dded', '#eff1f8']],
  ['Hong Kah North', 'Hong Kah North SMC', 3, 4.1, ['#86c79a', '#d2ebda', '#eef7f1']],
  ['Potong Pasir', 'Potong Pasir SMC', 2, 4.0, ['#d6b06a', '#ebe0c4', '#f6f1e6']],
];

const BLURBS = [
  'Residents consistently praise clean common areas and reliable lift repairs, and describe staff as responsive when issues are raised. The most common concern is drainage near carparks flooding after heavy rain. Overall, a well-kept estate that residents are happy to call home.',
  'Reviewers highlight tidy void decks and quick responses to feedback. A recurring theme is ageing lifts that occasionally break down, though repairs are generally prompt. Greenery and walkways are frequently mentioned as a highlight.',
  'Common praise centres on fast pest control and well-maintained corridors. Some residents note that lighting in older blocks could be improved and that responses to minor requests can be slow. The estate environment is widely described as pleasant.',
  'Residents value the friendly service at the TC office and steady upkeep of shared spaces. The most cited frustration is the time taken to resolve recurring maintenance issues. Cleanliness and landscaping draw consistent compliments.',
  'Feedback points to strong cleanliness and a green, walkable estate. A handful of reviews raise slow follow-up on reported faults and bin centre odour during hot weather. On balance, residents feel the estate is well cared for.',
];

const GOOD_TEXTS = [
  'Void deck is always spotless and the lifts are reliable — when ours broke down it was running again within two days.',
  'Friendly service at the TC office and quick to respond to feedback.',
  'Greenery and walkways are kept beautifully and pest control is on top of things.',
  'Corridors are cleaned daily and the lighting was upgraded recently. Feels safe walking home at night.',
  'Reported a faulty sensor light and it was fixed the same week. Genuinely well looked after.',
  'Playground and fitness corner are well maintained, great for the kids.',
  'Bin chutes are fumigated regularly — barely see any pests these days.',
  'Lovely place to raise a family. The community spaces are clean and welcoming.',
];

const BAD_TEXTS = [
  'Only gripe is the drainage by the carpark floods after heavy rain — hope it’s on the list.',
  'Lifts in the older blocks are slow and break down now and then.',
  'Took a couple of reminders before my feedback got a response.',
  'Some corridors could use a fresh coat of paint.',
  'Bin centre gets a bit smelly on hot afternoons.',
  'Wish the lighting along the back walkway was brighter.',
  '',
  '',
];

function makeReviews(targetOverall, count, biases) {
  const reviews = [];
  for (let i = 0; i < count; i++) {
    const overall = ratingNear(targetOverall);
    const cats = {
      service: ratingNear(targetOverall + biases.service),
      cleanliness: ratingNear(targetOverall + biases.cleanliness),
      maintenance: ratingNear(targetOverall + biases.maintenance),
      pest_control: ratingNear(targetOverall + biases.pest_control),
      environment: ratingNear(targetOverall + biases.environment),
    };
    const good = rand() < 0.85 ? pick(GOOD_TEXTS) : '';
    const bad = overall <= 3 || rand() < 0.5 ? pick(BAD_TEXTS) : '';
    reviews.push({ overall, cats, good, bad });
  }
  return reviews;
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE reviews, residents, town_councils RESTART IDENTITY CASCADE');

    let residentSeq = 0;
    for (let t = 0; t < TOWN_COUNCILS.length; t++) {
      const [name, area, estates, target, colors] = TOWN_COUNCILS[t];
      const slug = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const areaLabel = `${area} · ${estates} estates`;
      const gradient = wash(colors[0], colors[1], colors[2]);
      const blurb = BLURBS[t % BLURBS.length];

      const tcRes = await client.query(
        `INSERT INTO town_councils (slug, name, area, estates_count, tile_gradient, blurb)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [slug, name, areaLabel, estates, gradient, blurb]
      );
      const tcId = tcRes.rows[0].id;

      // Per-TC category biases give each a distinct strength/weakness profile.
      const biases = {
        service: (rand() - 0.5) * 0.8,
        cleanliness: (rand() - 0.3) * 0.8,
        maintenance: (rand() - 0.5) * 0.8,
        pest_control: (rand() - 0.4) * 0.8,
        environment: (rand() - 0.3) * 0.8,
      };
      const count = 12 + Math.floor(rand() * 34); // 12–45 reviews
      const reviews = makeReviews(target, count, biases);

      for (const r of reviews) {
        residentSeq++;
        const resHash = hashNric(`SEED-${residentSeq}`);
        const resRes = await client.query(
          `INSERT INTO residents (nric_hash) VALUES ($1) RETURNING id`,
          [resHash]
        );
        const residentId = resRes.rows[0].id;
        // Stagger created_at over the past ~120 days.
        const daysAgo = Math.floor(rand() * 120);
        await client.query(
          `INSERT INTO reviews
             (town_council_id, resident_id, overall, service, cleanliness,
              maintenance, pest_control, environment, good_text, bad_text,
              created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now() - ($11 || ' days')::interval, now() - ($11 || ' days')::interval)`,
          [
            tcId,
            residentId,
            r.overall,
            r.cats.service,
            r.cats.cleanliness,
            r.cats.maintenance,
            r.cats.pest_control,
            r.cats.environment,
            r.good || null,
            r.bad || null,
            daysAgo,
          ]
        );
      }
      console.log(`✓ ${name}: ${count} reviews`);
    }

    await client.query('COMMIT');
    console.log('✓ Seed complete');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
