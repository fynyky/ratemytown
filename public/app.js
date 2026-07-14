// Rating-guide bottom sheet (mock 03): the ⓘ next to a category opens a modal
// with that category's scale instead of navigating to the full /guide page.
(function () {
  var modal = document.getElementById('guideModal');
  if (!modal) return;
  var panels = Array.prototype.slice.call(modal.querySelectorAll('.guidepanel'));

  function open(key) {
    var found = false;
    panels.forEach(function (p) {
      var match = p.dataset.cat === key;
      p.hidden = !match;
      if (match) found = true;
    });
    if (!found) return; // unknown category — let the link fall through to /guide
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function close() {
    modal.hidden = true;
    document.body.style.overflow = '';
  }

  document.querySelectorAll('[data-guide]').forEach(function (el) {
    el.addEventListener('click', function (e) {
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

// Verify step (mock 04) as an in-page popup. Without JS the rate form posts to
// /rate/verify, which renders the full verify.ejs page. With JS we post it in the
// background, keep the draft in the session, and slide the verify sheet up over
// the form — no navigation, so the browser back button never resurfaces it.
(function () {
  var form = document.querySelector('[data-rate-form]');
  var modal = document.getElementById('verifyModal');
  if (!form || !modal) return;

  var scroll = form.querySelector('.scroll');
  var tcEl = modal.querySelector('[data-verify-tc]');
  var photosEl = modal.querySelector('[data-verify-photos]');
  var errEl = modal.querySelector('[data-verify-error]');
  var verifyForm = modal.querySelector('[data-verify-form]');

  function open() {
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    var nric = verifyForm.querySelector('input[name="nric"]');
    if (nric) nric.focus();
  }
  function close() {
    modal.hidden = true;
    document.body.style.overflow = '';
  }

  // Render server-side validation errors as the same .errors block the page uses.
  function showFormErrors(msgs) {
    var box = scroll.querySelector('.errors');
    if (!box) {
      box = document.createElement('div');
      box.className = 'errors';
      scroll.insertBefore(box, scroll.firstChild);
    }
    box.innerHTML = '<ul></ul>';
    var ul = box.querySelector('ul');
    msgs.forEach(function (m) {
      var li = document.createElement('li');
      li.textContent = m;
      ul.appendChild(li);
    });
    box.scrollIntoView({ block: 'nearest' });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;

    fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
      headers: { 'X-Requested-With': 'fetch' },
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok || !res.d.ok) {
          showFormErrors((res.d && res.d.errors) || ['Something went wrong. Please try again.']);
          return;
        }
        var existing = scroll.querySelector('.errors');
        if (existing) existing.remove();
        if (tcEl && res.d.tc) tcEl.textContent = res.d.tc.name;
        if (photosEl) {
          var n = res.d.photoCount || 0;
          photosEl.hidden = n === 0;
          photosEl.textContent = n + ' photo' + (n === 1 ? '' : 's') + ' attached';
        }
        if (errEl) errEl.hidden = true;
        open();
      })
      .catch(function () {
        // Network trouble: fall back to the plain full-page verify flow.
        form.submit();
      })
      .then(function () { if (btn) btn.disabled = false; });
  });

  // Submit the NRIC in the background too, so an invalid entry shows inline in the
  // sheet rather than navigating away and re-rendering the whole page.
  verifyForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = verifyForm.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;

    fetch(verifyForm.action, {
      method: 'POST',
      body: new URLSearchParams(new FormData(verifyForm)),
      headers: { 'X-Requested-With': 'fetch' },
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (res.ok && res.d.ok && res.d.redirect) {
          window.location = res.d.redirect;
          return;
        }
        if (errEl) {
          errEl.textContent = (res.d && res.d.error) || 'Something went wrong. Please try again.';
          errEl.hidden = false;
        }
        if (btn) btn.disabled = false;
      })
      .catch(function () {
        verifyForm.submit();
      });
  });

  modal.querySelectorAll('[data-verify-close]').forEach(function (el) {
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

// Progressive enhancement for the star-rating inputs on the review form.
// The group behaves as an ARIA radiogroup: click or keyboard (arrows / Home /
// End / Enter / Space) sets the rating, with a roving tabindex so the whole
// group is a single tab stop.
document.querySelectorAll('[data-starinput]').forEach(function (group) {
  var input = group.querySelector('input[type="hidden"]');
  var stars = Array.prototype.slice.call(group.querySelectorAll('.star'));

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
    star.style.cursor = 'pointer';
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
