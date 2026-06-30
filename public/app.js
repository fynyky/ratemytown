// Progressive enhancement for the star-rating inputs on the review form.
document.querySelectorAll('[data-starinput]').forEach(function (group) {
  var input = group.querySelector('input[type="hidden"]');
  var stars = Array.prototype.slice.call(group.querySelectorAll('.star'));

  function paint(value) {
    stars.forEach(function (s) {
      var on = parseInt(s.dataset.val, 10) <= value;
      s.classList.toggle('on', on);
      s.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }

  stars.forEach(function (star) {
    var val = parseInt(star.dataset.val, 10);
    star.style.cursor = 'pointer';
    star.addEventListener('click', function () {
      input.value = val;
      paint(val);
    });
    star.addEventListener('mouseenter', function () { paint(val); });
  });

  group.addEventListener('mouseleave', function () {
    paint(parseInt(input.value, 10) || 0);
  });
});
