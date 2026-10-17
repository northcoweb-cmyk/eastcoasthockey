/* Partner logo slider: a slow, endless row that eases down when hovered.
   Plain-JS version of the "logo cloud" pattern; the page works without it (logos just wrap in a row). */
(function () {
  'use strict';
  var box = document.getElementById('lc');
  if (!box) return;
  var set = box.querySelector('.lc-set');
  if (!set) return;
  var reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  if (reduce || !box.animate) return;                    /* static, centred row */

  var SPEED = 38;                                        /* px per second */
  var track = document.createElement('div');
  track.className = 'lc-track';
  set.parentNode.insertBefore(track, set);
  track.appendChild(set);
  var anim = null, w = 0, onScreen = true;

  function build() {
    [].slice.call(track.querySelectorAll('.lc-clone')).forEach(function (n) { n.remove(); });
    box.classList.remove('lc-js');
    w = set.getBoundingClientRect().width;
    if (!w) return;
    var need = Math.ceil(box.clientWidth / w) + 1;
    for (var i = 0; i < need; i++) {
      var c = set.cloneNode(true);
      c.classList.add('lc-clone'); c.setAttribute('aria-hidden', 'true');
      [].forEach.call(c.querySelectorAll('img'), function (im) { im.setAttribute('alt', ''); });
      track.appendChild(c);
    }
    box.classList.add('lc-js');
    if (anim) anim.cancel();
    anim = track.animate([{ transform: 'translate3d(' + (-w) + 'px,0,0)' }, { transform: 'translate3d(0,0,0)' }],
      { duration: (w / SPEED) * 1000, iterations: Infinity, easing: 'linear' });
    if (!onScreen) anim.pause();
  }

  box.addEventListener('pointerenter', function () { if (anim) anim.updatePlaybackRate(0.3); });
  box.addEventListener('pointerleave', function () { if (anim) anim.updatePlaybackRate(1); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      onScreen = es[0].isIntersecting;
      if (anim) { if (onScreen) anim.play(); else anim.pause(); }
    }).observe(box);
  }
  var rz;
  window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(build, 200); });

  /* measure once every logo has its real size */
  var imgs = [].slice.call(set.querySelectorAll('img'));
  var left = imgs.length;
  function done() { if (--left <= 0) build(); }
  imgs.forEach(function (im) { if (im.complete) done(); else { im.addEventListener('load', done); im.addEventListener('error', done); } });
})();
