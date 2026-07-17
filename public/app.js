// Rating-guide bottom sheet (mock 03): the ⓘ next to a category opens a modal
// with that category's scale instead of navigating to the full /guide page.
(function () {
  var modal = document.getElementById('guideModal');
  if (!modal) return;
  var panels = Array.prototype.slice.call(modal.querySelectorAll('.guidepanel'));

  function open(key) {
    panels.forEach(function (p) {
      p.hidden = p.dataset.cat !== key;
    });
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function close() {
    modal.hidden = true;
    document.body.style.overflow = '';
  }

  document.querySelectorAll('[data-guide]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      // Unknown category: let the link fall through to the full /guide page.
      if (!modal.querySelector('.guidepanel[data-cat="' + el.dataset.guide + '"]')) return;
      e.preventDefault();
      open(el.dataset.guide);
    });
  });
  modal.querySelectorAll('[data-guide-close]').forEach(function (el) {
    el.addEventListener('click', close);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modal.hidden) close();
  });
})();

// Centre the active sort chip in the scrollable chip row, so the current sort
// is always visible even when it sits off the right edge on narrow screens.
(function () {
  var row = document.querySelector('.chiprow');
  if (!row) return;
  var active = row.querySelector('.chip.on');
  if (!active) return;
  row.scrollLeft = active.offsetLeft - (row.clientWidth - active.offsetWidth) / 2;
})();

// Town-page hero slideshow + lightbox: the cover photo, then each review photo
// with its review's quote. Arrows loop around and drive one shared index —
// they exist in both the hero and the lightbox, so paging either keeps the two
// in step. Clicking a slide opens the current photo full-screen; Escape, the
// ✕, or the backdrop closes it. With a single slide (or no JS) the hero stays
// a static cover photo.
(function () {
  var hero = document.querySelector('[data-hero]');
  if (!hero) return;
  var slides = Array.prototype.slice.call(hero.querySelectorAll('.heroslide'));
  var box = document.querySelector('[data-lightbox]');
  var boxImg = box && box.querySelector('[data-lightbox-img]');

  var idx = 0;
  function show(n) {
    idx = (n + slides.length) % slides.length;
    slides.forEach(function (s, i) { s.classList.toggle('on', i === idx); });
    if (box && !box.hidden) boxImg.src = slides[idx].dataset.img;
  }
  document.querySelectorAll('[data-hero-prev]').forEach(function (b) {
    b.addEventListener('click', function () { show(idx - 1); });
  });
  document.querySelectorAll('[data-hero-next]').forEach(function (b) {
    b.addEventListener('click', function () { show(idx + 1); });
  });

  if (!box) return;
  function openBox() {
    boxImg.src = slides[idx].dataset.img;
    box.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeBox() {
    box.hidden = true;
    document.body.style.overflow = '';
  }
  slides.forEach(function (s) { s.addEventListener('click', openBox); });
  box.querySelectorAll('[data-lightbox-close]').forEach(function (b) {
    b.addEventListener('click', closeBox);
  });
  document.addEventListener('keydown', function (e) {
    if (box.hidden) return;
    if (e.key === 'Escape') closeBox();
    if (e.key === 'ArrowLeft') show(idx - 1);
    if (e.key === 'ArrowRight') show(idx + 1);
  });
})();

// "Most recent ▾" on the town page is a real sort control: reorder the review
// cards client-side by the data-* attributes each card carries. Without JS the
// list stays in the server's most-recent order.
(function () {
  var sel = document.querySelector('[data-review-sort]');
  var wrap = document.querySelector('[data-reviews]');
  if (!sel || !wrap) return;
  sel.addEventListener('change', function () {
    var cards = Array.prototype.slice.call(wrap.children);
    cards.sort(function (a, b) {
      if (sel.value === 'high') return b.dataset.overall - a.dataset.overall || b.dataset.ts - a.dataset.ts;
      if (sel.value === 'low') return a.dataset.overall - b.dataset.overall || b.dataset.ts - a.dataset.ts;
      return b.dataset.ts - a.dataset.ts;
    });
    cards.forEach(function (c) { wrap.appendChild(c); });
  });
})();

// The 1-5 vocabulary ("Good", "Excellent"), published once per form by rate.ejs
// from the same list the rating guide uses.
var STAR_WORDS = (function () {
  var el = document.querySelector('[data-star-words]');
  try {
    return el ? JSON.parse(el.dataset.starWords) : [];
  } catch (e) {
    return [];
  }
})();

// Progressive enhancement for the star-rating inputs on the review form.
// The group behaves as an ARIA radiogroup: click or keyboard (arrows / Home /
// End / Enter / Space) sets the rating, with a roving tabindex so the whole
// group is a single tab stop.
document.querySelectorAll('[data-starinput]').forEach(function (group) {
  var input = group.querySelector('input[type="hidden"]');
  var stars = Array.prototype.slice.call(group.querySelectorAll('.star'));
  // Names the level being shown. Lives outside the group: the design puts it
  // beside the stars for overall, but on the label row for each category.
  var word = document.querySelector('[data-star-word-for="' + input.name + '"]');

  // `on` reflects whatever is currently shown (hover preview or committed value);
  // `sel` marks only the committed selection so it stays visible while hovering.
  function paint(value) {
    var selected = parseInt(input.value, 10) || 0;
    stars.forEach(function (s) {
      var v = parseInt(s.dataset.val, 10);
      s.classList.toggle('on', v <= value);
      s.classList.toggle('sel', v <= selected);
      // Only the committed star is the "checked" radio; the fill is visual.
      s.setAttribute('aria-checked', v === selected ? 'true' : 'false');
    });
    if (word) word.textContent = STAR_WORDS[value] || '';
  }

  // Roving tabindex: the committed star (or the first, if none) is the tab stop.
  function setTabStop(value) {
    var stop = value || 1;
    stars.forEach(function (s) {
      s.tabIndex = parseInt(s.dataset.val, 10) === stop ? 0 : -1;
    });
  }

  function select(value, focus) {
    input.value = value;
    // A hidden input fires no event of its own; the submit gate listens for this.
    input.dispatchEvent(new Event('change', { bubbles: true }));
    paint(value);
    setTabStop(value);
    var star = stars[value - 1];
    if (focus) star.focus();
    // Restart the pop animation to confirm the selection registered.
    star.classList.remove('pop');
    void star.offsetWidth;
    star.classList.add('pop');
  }

  stars.forEach(function (star) {
    var val = parseInt(star.dataset.val, 10);
    star.addEventListener('click', function () { select(val, false); });
    star.addEventListener('mouseenter', function () { paint(val); });
    star.addEventListener('keydown', function (e) {
      var cur = parseInt(input.value, 10) || 0;
      var next;
      switch (e.key) {
        case 'ArrowRight': case 'ArrowUp': next = Math.min(5, cur + 1); break;
        case 'ArrowLeft': case 'ArrowDown': next = Math.max(1, (cur || 1) - 1); break;
        case 'Home': next = 1; break;
        case 'End': next = 5; break;
        case 'Enter': case ' ': next = val; break;
        default: return;
      }
      e.preventDefault();
      select(next, true);
    });
  });

  group.addEventListener('mouseleave', function () {
    paint(parseInt(input.value, 10) || 0);
  });

  setTabStop(parseInt(input.value, 10) || 0);
});

// Hold the review form until it can actually be submitted — town and overall are
// the only required answers — and say which one is still missing rather than
// failing on the server after a round trip. The button ships enabled, so the
// form still works without JS.
//
// The town comes first: until one is chosen, everything below the picker is
// parked (dimmed + inert) and the picker itself carries the emphasis, so the
// form reads as "step 1: which town?". Ships unlocked for the same no-JS reason.
(function () {
  var form = document.querySelector('[data-rateform]');
  if (!form) return;
  var btn = form.querySelector('[data-submit-gate]');
  var tc = form.querySelector('select[name="tc"]');
  var overall = form.querySelector('input[name="overall"]');
  if (!btn || !tc || !overall) return;
  var rest = form.querySelector('[data-form-rest]');
  var hint = form.querySelector('[data-town-hint]');

  function sync() {
    var hasTown = !!tc.value;
    var hasOverall = !!(parseInt(overall.value, 10) || 0);
    btn.disabled = !(hasTown && hasOverall);
    // "Verify to submit" pre-empts the Singpass verification sheet that opens
    // on submit, so the popup doesn't come as a surprise.
    btn.textContent = !hasTown
      ? 'Choose your town to submit'
      : !hasOverall
        ? 'Rate overall to submit'
        : 'Verify to submit';

    // `inert` blocks focus and clicks in one go (the stars are spans, so a
    // disabled fieldset wouldn't cover them); .locked handles the dimming.
    if (rest) {
      rest.classList.toggle('locked', !hasTown);
      rest.inert = !hasTown;
    }
    if (hint) hint.hidden = hasTown;
    form.classList.toggle('needstown', !hasTown);
  }

  form.addEventListener('change', sync);
  sync();
})();

// Tile-based photo picker: accumulate selections, preview each as a tile with a
// remove button, and keep the real <input>'s FileList in sync for form submit.
document.querySelectorAll('[data-photogrid]').forEach(function (grid) {
  var input = grid.querySelector('[data-photo-input]');
  var addBtn = grid.querySelector('[data-photo-add]');
  var note = grid.parentNode.querySelector('[data-photo-files]');
  if (!input || !addBtn) return;

  var MAX = 4;
  var MAX_SIZE = 5 * 1024 * 1024;
  var dflt = note ? note.textContent : '';
  var files = [];

  function syncInput() {
    var dt = new DataTransfer();
    files.forEach(function (f) { dt.items.add(f); });
    input.files = dt.files;
  }

  function render() {
    // Drop any existing previews; keep the hidden input and the add button.
    grid.querySelectorAll('.photoprev').forEach(function (el) { el.remove(); });

    files.forEach(function (file, i) {
      var tile = document.createElement('div');
      tile.className = 'phototile photoprev';
      tile.style.backgroundImage = 'url(' + URL.createObjectURL(file) + ')';

      var rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'photorm';
      rm.setAttribute('aria-label', 'Remove photo');
      rm.textContent = '✕';
      rm.addEventListener('click', function () {
        files.splice(i, 1);
        syncInput();
        render();
      });

      tile.appendChild(rm);
      grid.insertBefore(tile, addBtn);
    });

    addBtn.style.display = files.length >= MAX ? 'none' : '';
    if (note) {
      note.textContent = files.length
        ? files.length + ' of ' + MAX + ' photo' + (files.length > 1 ? 's' : '') + ' added'
        : dflt;
    }
  }

  addBtn.addEventListener('click', function () { input.click(); });

  input.addEventListener('change', function () {
    Array.prototype.forEach.call(input.files, function (file) {
      if (files.length >= MAX) return;
      if (file.size > MAX_SIZE) return; // skip oversized; backend also enforces this
      files.push(file);
    });
    syncInput();
    render();
  });
});
