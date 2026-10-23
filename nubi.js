/* Nubi — behaviours. No dependencies. Load at the end of <body>.
   ?static in the URL (or reduced motion) = no motion: everything shown at once.
   Reveals are handled by motion/motion.js when present (html.m-js); the data-reveal fallback below runs only without it. */
(() => {
  const root = document.documentElement;
  const still = /[?&]static\b/.test(location.search);
  if (still) root.classList.add('static');
  root.classList.add('js');
  const reduce = still || matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Header shadow once the page scrolls
  const head = document.querySelector('.site-head');
  if (head) {
    const onScroll = () => head.classList.toggle('is-scrolled', scrollY > 8);
    addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }

  // Mobile drawer
  const toggle = document.querySelector('.nav-toggle');
  const drawer = document.querySelector('.drawer');
  if (toggle && drawer) {
    const set = (open) => { drawer.classList.toggle('is-open', open); toggle.setAttribute('aria-expanded', String(open)); };
    toggle.addEventListener('click', () => set(!drawer.classList.contains('is-open')));
    drawer.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
  }

  // Rails: prev / next buttons scroll one card
  document.querySelectorAll('[data-rail]').forEach((ctrl) => {
    const rail = document.getElementById(ctrl.dataset.rail);
    if (!rail) return;
    const step = () => (rail.firstElementChild?.getBoundingClientRect().width || 300) + 24;
    ctrl.querySelector('[data-prev]')?.addEventListener('click', () => rail.scrollBy({ left: -step(), behavior: reduce ? 'auto' : 'smooth' }));
    ctrl.querySelector('[data-next]')?.addEventListener('click', () => rail.scrollBy({ left: step(), behavior: reduce ? 'auto' : 'smooth' }));
  });

  // Tabs / step lists: [data-tabs] buttons[aria-controls] → scroll target into view + mark current
  document.querySelectorAll('[data-steps]').forEach((list) => {
    const links = [...list.querySelectorAll('a[href^="#"]')];
    links.forEach((a) => a.addEventListener('click', () => { links.forEach((l) => l.removeAttribute('aria-current')); a.setAttribute('aria-current', 'true'); }));
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((l) => l.toggleAttribute('aria-current', l.getAttribute('href') === '#' + e.target.id));
    }), { rootMargin: '-45% 0px -50% 0px' });
    links.forEach((l) => { const t = document.querySelector(l.getAttribute('href')); if (t) io.observe(t); });
  });

  // Arc marquee: text drifts along the curved band (signature moment)
  document.querySelectorAll('.arc textPath').forEach((tp) => {
    if (reduce) return;
    let off = 0, last = performance.now(), vis = true;
    const io = new IntersectionObserver(([e]) => { vis = e.isIntersecting; }); io.observe(tp.closest('.arc'));
    const len = tp.getComputedTextLength ? tp.getComputedTextLength() / 2 : 1200;
    const tick = (t) => { const dt = t - last; last = t; if (vis) { off = (off + dt * 0.045) % len; tp.setAttribute('startOffset', (-off).toFixed(1)); } requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });

  // Fallback reveals (only when the motion engine is not loaded)
  if (!root.classList.contains('m-js')) {
    const els = document.querySelectorAll('[data-reveal]');
    if (reduce || !('IntersectionObserver' in window)) els.forEach((e) => e.classList.add('in'));
    else {
      const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
      els.forEach((e) => io.observe(e));
      setTimeout(() => els.forEach((e) => e.classList.add('in')), 2500);
    }
  }
})();
