// Focus reel for the CNC tool list: the card nearest the middle of the screen is
// full size and sharp; cards above and below shrink, blur and dim (see css/cnc.css).
// Sets --f (0..1) on each card and .is-focused on the closest one.
(() => {
  'use strict';

  const container = document.getElementById('apps-container');
  if (!container) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const cards = Array.from(container.querySelectorAll('.tool-card'));
  let queued = false;

  function update() {
    queued = false;
    const viewH = window.innerHeight || document.documentElement.clientHeight;
    const centre = viewH * 0.5;
    // Distance (in px) over which a card goes from full focus to fully receded.
    const range = viewH * 0.55;
    let best = null;
    let bestDist = Infinity;

    for (const card of cards) {
      if (card.hidden || card.offsetParent === null) continue;
      const r = card.getBoundingClientRect();
      // Skip cards far off-screen: they keep their last (receded) value.
      if (r.bottom < -viewH || r.top > viewH * 2) {
        card.style.setProperty('--f', '0');
        card.classList.remove('is-focused');
        continue;
      }
      const dist = Math.abs(r.top + r.height / 2 - centre);
      let f = reduceMotion.matches ? 1 : Math.max(0, 1 - dist / range);
      f = f * f * (3 - 2 * f); // smoothstep: a calm plateau near the centre
      card.style.setProperty('--f', f.toFixed(3));
      if (dist < bestDist) { bestDist = dist; best = card; }
    }

    for (const card of cards) card.classList.toggle('is-focused', card === best);
  }

  function requestUpdate() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(update);
  }

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate, { passive: true });
  reduceMotion.addEventListener?.('change', requestUpdate);

  // Search and filters show/hide cards; re-measure when that happens.
  const filterObserver = new MutationObserver(requestUpdate);
  filterObserver.observe(container, { subtree: true, attributes: true, attributeFilter: ['hidden'], childList: true });
  // Banner images change card heights as they load.
  container.querySelectorAll('img').forEach(img => {
    if (!img.complete) img.addEventListener('load', requestUpdate, { once: true });
  });

  requestUpdate();
})();
