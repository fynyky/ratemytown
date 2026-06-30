// Progressive enhancement for the star-rating inputs on the review form.
document.querySelectorAll('[data-starinput]').forEach(function (group) {
  var input = group.querySelector('input[type="hidden"]');
  var stars = Array.prototype.slice.call(group.querySelectorAll('.star'));

  // `on` reflects whatever is currently shown (hover preview or committed value);
  // `sel` marks only the committed selection so it stays visible while hovering.
  function paint(value) {
    var selected = parseInt(input.value, 10) || 0;
    stars.forEach(function (s) {
      var v = parseInt(s.dataset.val, 10);
      var on = v <= value;
      s.classList.toggle('on', on);
      s.classList.toggle('sel', v <= selected);
      s.setAttribute('aria-checked', v <= selected ? 'true' : 'false');
    });
  }

  stars.forEach(function (star) {
    var val = parseInt(star.dataset.val, 10);
    star.style.cursor = 'pointer';
    star.addEventListener('click', function () {
      input.value = val;
      paint(val);
      // Restart the pop animation to confirm the click registered.
      star.classList.remove('pop');
      void star.offsetWidth;
      star.classList.add('pop');
    });
    star.addEventListener('mouseenter', function () { paint(val); });
  });

  group.addEventListener('mouseleave', function () {
    paint(parseInt(input.value, 10) || 0);
  });
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
