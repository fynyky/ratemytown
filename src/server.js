import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import 'dotenv/config';

import { CATEGORIES, CATEGORY_KEYS, RATING_SCALE } from './categories.js';
import * as db from './db/queries.js';
import { hashNric, isValidNric } from './identity.js';
import * as h from './helpers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, '..', 'public')));

// Make helpers + config available to every template.
app.locals.CATEGORIES = CATEGORIES;
app.locals.RATING_SCALE = RATING_SCALE;
app.locals.h = h;

// --- Leaderboard / landing (mock 01) ---------------------------------------
app.get('/', async (req, res, next) => {
  try {
    const sort = db.SORT_KEYS.includes(req.query.sort) ? req.query.sort : 'overall';
    const leaderboard = await db.getLeaderboard(sort);
    res.render('leaderboard', { leaderboard, sort });
  } catch (err) {
    next(err);
  }
});

// --- About (mock 07) -------------------------------------------------------
app.get('/about', (req, res) => res.render('about'));

// --- Rating guide (mock 03, the ⓘ sheet) -----------------------------------
app.get('/guide', (req, res) => {
  const focus = CATEGORY_KEYS.includes(req.query.cat) ? req.query.cat : null;
  res.render('guide', { focus });
});

// --- Town council page (mock 06 / 06b) -------------------------------------
app.get('/town/:slug', async (req, res, next) => {
  try {
    const tc = await db.getTownCouncilBySlug(req.params.slug);
    if (!tc) return res.status(404).render('notfound');
    const [ranks, reviews] = await Promise.all([
      db.getCategoryRanks(),
      db.getRecentReviews(tc.id),
    ]);
    res.render('town', { tc, ranks, reviews });
  } catch (err) {
    next(err);
  }
});

// --- Review form (mock 02) -------------------------------------------------
app.get('/rate', async (req, res, next) => {
  try {
    const townCouncils = await db.listTownCouncils();
    const selected = req.query.tc || (townCouncils[0] && townCouncils[0].slug);
    res.render('rate', {
      townCouncils,
      selected,
      form: null,
      errors: [],
    });
  } catch (err) {
    next(err);
  }
});

// Parse + validate the rating form into a normalised shape.
function parseReviewForm(body) {
  const errors = [];
  const overall = clampStar(body.overall);
  const cats = {};
  for (const c of CATEGORIES) cats[c.key] = clampStar(body[c.key]);

  if (!body.tc) errors.push('Please choose your town council.');
  if (!overall) errors.push('Please give an overall rating.');
  for (const c of CATEGORIES) {
    if (!cats[c.key]) errors.push(`Please rate ${c.label.toLowerCase()}.`);
  }
  return {
    errors,
    data: {
      tc: body.tc,
      overall,
      cats,
      goodText: (body.good_text || '').trim().slice(0, 2000),
      badText: (body.bad_text || '').trim().slice(0, 2000),
    },
  };
}

function clampStar(v) {
  const n = parseInt(v, 10);
  return n >= 1 && n <= 5 ? n : 0;
}

// Step 1 -> 2: validate ratings, then show the Singpass verify sheet (mock 04).
app.post('/rate/verify', async (req, res, next) => {
  try {
    const { errors, data } = parseReviewForm(req.body);
    const townCouncils = await db.listTownCouncils();
    if (errors.length) {
      return res.status(400).render('rate', {
        townCouncils,
        selected: data.tc,
        form: req.body,
        errors,
      });
    }
    const tc = townCouncils.find((t) => t.slug === data.tc);
    if (!tc) {
      return res.status(400).render('rate', {
        townCouncils,
        selected: data.tc,
        form: req.body,
        errors: ['That town council was not recognised.'],
      });
    }
    res.render('verify', { data, tc, error: null });
  } catch (err) {
    next(err);
  }
});

// Step 2 -> 3: mock Singpass verification, then publish (mock 05).
app.post('/rate/submit', async (req, res, next) => {
  try {
    const { errors, data } = parseReviewForm(req.body);
    const townCouncils = await db.listTownCouncils();
    const tc = townCouncils.find((t) => t.slug === data.tc);
    if (errors.length || !tc) {
      return res.status(400).render('rate', {
        townCouncils,
        selected: data.tc,
        form: req.body,
        errors: errors.length ? errors : ['Something went wrong. Please try again.'],
      });
    }

    // Mock Singpass/Myinfo: a real integration returns the verified identity and
    // registered address. Here we accept an NRIC and hash it (PRD §10) — we never
    // store the raw value, and the registered TC would come from Myinfo.
    const nric = req.body.nric;
    if (!isValidNric(nric)) {
      return res.status(400).render('verify', {
        data,
        tc,
        error: 'Please enter a valid NRIC/FIN (e.g. S1234567A) to simulate Singpass.',
      });
    }

    const nricHash = hashNric(nric);
    const residentId = await db.findOrCreateResident(nricHash);
    const tcRow = await db.getTownCouncilById(tc.id);
    const { isNew } = await db.upsertReview({
      townCouncilId: tcRow.id,
      residentId,
      overall: data.overall,
      cats: data.cats,
      goodText: data.goodText,
      badText: data.badText,
    });

    res.render('success', { tc: tcRow, overall: data.overall, isNew });
  } catch (err) {
    next(err);
  }
});

// --- 404 + error handling --------------------------------------------------
app.use((req, res) => res.status(404).render('notfound'));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { message: err.message });
});

app.listen(PORT, () => {
  console.log(`RateMyTown.sg running on http://localhost:${PORT}`);
});
