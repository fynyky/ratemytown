import express from 'express';
import expressLayouts from 'express-ejs-layouts';
import multer from 'multer';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { config } from './config.js';
import { CATEGORIES, CATEGORY_KEYS } from './categories.js';
import * as db from './db/queries.js';
import { hashNric, isValidNric } from './identity.js';
import * as h from './helpers.js';
import { sessionMiddleware } from './session.js';
import { connectRedis, cacheGet, cacheSet, invalidateLeaderboard } from './services/redis.js';
import {
  ensureBucket,
  putImage,
  isAllowedImage,
  statObject,
  getObjectStream,
} from './services/storage.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

// Photo uploads buffered in memory, then streamed to the blobstore.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 4 },
  fileFilter: (req, file, cb) => cb(null, isAllowedImage(file.mimetype)),
});

app.set('view engine', 'ejs');
app.set('views', join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'partials/layout');
app.use(express.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, '..', 'public')));
app.use(sessionMiddleware());

app.locals.CATEGORIES = CATEGORIES;
app.locals.h = h;

// --- Leaderboard / landing (mock 01) — cached in Redis ---------------------
app.get('/', async (req, res, next) => {
  try {
    const sort = db.SORT_KEYS.includes(req.query.sort) ? req.query.sort : 'overall';
    const cacheKey = `lb:${sort}`;
    let leaderboard = await cacheGet(cacheKey);
    if (!leaderboard) {
      leaderboard = await db.getLeaderboard(sort);
      await cacheSet(cacheKey, leaderboard, 30); // 30s TTL
    }
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

// --- Serve an uploaded photo from the blobstore ----------------------------
app.get('/uploads/:dir/:file', async (req, res) => {
  const key = `${req.params.dir}/${req.params.file}`;
  if (!/^reviews\/[\w.-]+$/.test(key)) return res.status(400).end();
  try {
    const stat = await statObject(key);
    res.setHeader('Content-Type', stat.metaData['content-type'] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const stream = await getObjectStream(key);
    stream.on('error', () => {
      // A mid-stream failure may arrive after headers/bytes are already sent.
      if (!res.headersSent) res.status(404);
      res.end();
    });
    stream.pipe(res);
  } catch {
    res.status(404).end();
  }
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
    const selected = req.query.tc || '';
    res.render('rate', { townCouncils, selected, form: null, errors: [] });
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

  if (!body.tc) errors.push('Please choose your town.');
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

// Step 1 -> 2: validate ratings, stash photos in the blobstore and the draft
// in the session, then show the Singpass verify sheet (mock 04).
app.post('/rate/verify', upload.array('photos', 4), async (req, res, next) => {
  try {
    const { errors, data } = parseReviewForm(req.body);
    const townCouncils = await db.listTownCouncils();
    const tc = townCouncils.find((t) => t.slug === data.tc);
    if (errors.length || !tc) {
      return res.status(400).render('rate', {
        townCouncils,
        selected: data.tc,
        form: req.body,
        errors: errors.length ? errors : ['We couldn’t find that town council — please choose one from the list.'],
      });
    }

    // Upload any photos now that the ratings are valid.
    const photoKeys = [];
    for (const file of req.files || []) {
      photoKeys.push(await putImage(file.buffer, file.mimetype));
    }

    // The draft lives in the Redis-backed session, not in hidden form fields.
    req.session.reviewDraft = { ...data, photoKeys };
    res.render('verify', { data: req.session.reviewDraft, tc, error: null });
  } catch (err) {
    next(err);
  }
});

// Step 2 -> 3: mock Singpass verification, then publish (mock 05).
app.post('/rate/submit', async (req, res, next) => {
  try {
    const draft = req.session.reviewDraft;
    if (!draft) return res.redirect('/rate');

    const townCouncils = await db.listTownCouncils();
    const tc = townCouncils.find((t) => t.slug === draft.tc);
    if (!tc) return res.redirect('/rate');

    // Mock Singpass/Myinfo: a real integration returns the verified identity and
    // registered address. Here we accept an NRIC and hash it (PRD §10) — we never
    // store the raw value.
    const nric = req.body.nric;
    if (!isValidNric(nric)) {
      return res.status(400).render('verify', {
        data: draft,
        tc,
        error: 'Please enter a valid NRIC/FIN (e.g. S1234567A) to simulate Singpass.',
        nricValue: nric || '',
      });
    }

    const nricHash = hashNric(nric);
    const residentId = await db.findOrCreateResident(nricHash);
    const { id: reviewId, isNew } = await db.upsertReview({
      townCouncilId: tc.id,
      residentId,
      overall: draft.overall,
      cats: draft.cats,
      goodText: draft.goodText,
      badText: draft.badText,
    });

    if (draft.photoKeys && draft.photoKeys.length) {
      await db.setReviewPhotos(reviewId, draft.photoKeys);
    }

    delete req.session.reviewDraft;
    await invalidateLeaderboard(); // scores changed

    res.render('success', { tc, overall: draft.overall, isNew });
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

// --- Boot: connect services, then listen -----------------------------------
async function start() {
  await connectRedis();
  await ensureBucket();
  app.listen(config.port, () => {
    console.log(`RateMyTown.sg running on http://localhost:${config.port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});
