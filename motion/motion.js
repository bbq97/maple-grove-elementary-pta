/* Grayskills motion engine — shared by every design skill (source: grayskiller/motion/). No dependencies, ~12 KB.
   Install: two tags in <head>, both AFTER the skill's own stylesheet(s):
     <link rel="stylesheet" href="motion/motion.css">
     <script src="motion/motion.js" data-rules="motion/rules.json"></script>      ← plain script, never defer/async
   Rules (selectors + personality) come from, in order of priority:
     window.__MOTION   — an inline object the page may set before this script   (highest)
     data-rules        — a JSON file, fetched when the site is served over http(s)
     DEFAULTS below    — work on any Grayskills page (file:// previews use these)
   Hand control on any element:
     data-m="up | fade | pop | panel | wipe | img | node | grow | count | none"   reveal type ("none" = visible, untouched)
     data-m-off      opt an element and everything inside it out          data-m-stagger   children rise one after another
     data-m-split    split this heading into rising words                 data-m-count     count this number up
     data-m-float    gentle breathing float                               data-m-grow      grow from 0 height (bars)
     data-m-draw     draw the <path>/<line> elements inside               data-m-spot      cursor spotlight on this card
   Coexistence: elements the skill marked [data-reveal] / [data-reveal-group] are taken over (treated as data-m="up" / stagger);
   when they come in they also get the skill's own "in" class, and <html> carries .m-js so the skill's JS can skip its reveals:
     if (document.documentElement.classList.contains("m-js")) { ...skip own reveals... }
   Safety: prefers-reduced-motion → everything visible, nothing moves. ?static → this file does nothing at all.
   The page is shown at 2.5 s no matter what; reaching the bottom of the page shows everything that is left. */
(() => {
  if (/[?&]static\b/.test(location.search)) { document.documentElement.style.scrollBehavior = 'auto'; return; }
  const html = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  html.classList.add('m-js');
  const reveal = () => html.classList.add('m-on');
  setTimeout(reveal, 2500);

  const DEFAULTS = {
    personality: 'calm',                                   // calm | crisp | playful
    accent: '--accent',                                    // token (or a colour) used for the progress bar, spotlight, glow pulse
    headings: 'h1, h2, .t-display, .t-h1, .t-h2',          // split into rising words
    noSplit: '.card, .panel, article, [data-mock], .il, table, button, .faq, details, header, footer, nav',
    eyebrows: '.chip, .eyebrow, .label, .badge, .tag, .kicker, .pill-label',
    wipes: 'mark, .hl, [class*="-hl"]',
    groups: '[class*="grid"], [class*="list"], [class*="cards"], [class*="stats"], [class*="logos"], [class*="steps"], [data-m-stagger]',
    chips: '[class*="chip"], [class*="tag"], [class*="avatar"], [class*="logos"]',
    cards: '.card, .panel, article',
    spotlight: '.card, [data-m-spot]',
    lift: '',                                              // cards that rise 4px on hover (skill decides; many have their own hover)
    nav: '.site-head, body > header',
    buttons: '.btn',
    mocks: '.il, [data-mock]',
    mockNodes: '.il-node, .il-dot, .il-pill, .il-abs, .il-card',
    mockLines: '.il__lines path, .il__lines line, [data-m-draw] path, [data-m-draw] line',
    mockBars: '.il-bars i',
    counters: '.il-num, .il-metric__head b',
    floats: '.il-pill--float',
    lit: '.il-node--lit',
    legacy: { reveal: '[data-reveal]', group: '[data-reveal-group]', extra: '', inClass: 'in' },
    skipCount: '[data-count]',                             // numbers the skill's own JS counts
    progress: true, cursorGlow: false, parallax: true, magnetic: false,
    smoothScroll: false,                                   // inertial wheel scrolling: on per build for business / corporate / luxury / other sites (Farhan 2026-10-13)
  };
  const PERSONA = {                                        // JS timings (ms); the CSS side lives in motion.css under html.m-<name>
    calm:    { stagger: 110, chip: 70, word: 45, node: 90, bar: 60, mockBase: 380, count: 1600, lead: 280, floatY: [-7, -9],  floatDur: 6 },
    crisp:   { stagger: 70,  chip: 50, word: 30, node: 70, bar: 45, mockBase: 260, count: 1000, lead: 180, floatY: [-4, -5],  floatDur: 5 },
    playful: { stagger: 90,  chip: 60, word: 40, node: 80, bar: 55, mockBase: 320, count: 1300, lead: 220, floatY: [-9, -12], floatDur: 4.5 },
  };
  const merge = (a, b) => { const o = Object.assign({}, a, b || {}); o.legacy = Object.assign({}, a.legacy, (b && b.legacy) || {}); return o; };
  let R = merge(DEFAULTS, window.__MOTION);
  const me = document.currentScript, src = me && me.getAttribute('data-rules');
  const ready = new Promise((res) => {
    if (!src || !/^https?:$/.test(location.protocol)) return res();
    const t = setTimeout(res, 400);
    fetch(src).then((r) => r.json()).then((j) => { R = merge(merge(DEFAULTS, j), window.__MOTION); }).catch(() => {}).then(() => { clearTimeout(t); res(); });
  });

  const $$ = (s, r = document) => (s && s.trim() ? [...r.querySelectorAll(s)] : []);
  const is = (el, s) => !!(s && s.trim() && el.matches(s));
  const within = (el, s) => !!(s && s.trim() && el.parentElement && el.parentElement.closest(s));
  const off = (el) => el.closest('[data-m-off]');
  const tagged = (el) => el.hasAttribute('data-m') || el.classList.contains('m-split');
  const ms = (n) => (n / 1000).toFixed(3) + 's';
  const delayOf = (el) => (parseFloat(el.style.getPropertyValue('--d')) || 0) * 1000;
  const keepTranslate = (el) => {                           // elements centred with `translate` (illustration parts) keep it while they animate
    const t = getComputedStyle(el).translate;
    if (!t || t === 'none') return;
    const p = t.split(' '); el.style.setProperty('--m-tx', p[0]); el.style.setProperty('--m-ty', p[1] || '0px');
  };
  // micro.js owns everything inside a [data-mi] moment (house rule micro-moments, 2026-10-17): motion only reveals the
  // moment's own block (up / panel / fade) and never pops, wipes, counts, staggers or floats its parts — one animation per element
  const miOwned = (el, type) => {
    const mi = el.closest && el.closest('[data-mi]'); if (!mi) return false;
    if (mi !== el) return true;
    return !/^(up|panel|fade)$/.test(type || '') || /\b(mark|flip|roll|loop)\b/.test(el.getAttribute('data-mi') || '');
  };
  const set = (el, type, delay = 0) => {
    if (!el || off(el) || tagged(el) || miOwned(el, type)) return false;
    keepTranslate(el); el.setAttribute('data-m', type);
    if (delay) el.style.setProperty('--d', ms(delay));
    return true;
  };

  /* Split a heading into masked words (keeps <br>, <span class="accent">, highlight boxes, icons) */
  const split = (el, base, P) => {
    if (off(el) || el.classList.contains('m-split') || el.closest('[data-m-off]') || el.querySelector('[data-mi]') || miOwned(el)) return 0;
    el.classList.add('m-split');
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const parts = n.textContent.split(/(\s+)/);
          if (parts.every((p) => !p.trim())) return;
          const frag = document.createDocumentFragment();
          parts.forEach((p) => {
            if (!p) return;
            if (!p.trim()) { frag.append(p); return; }
            const w = document.createElement('span'); w.className = 'm-w';
            const wi = document.createElement('span'); wi.className = 'm-wi'; wi.textContent = p;
            wi.style.setProperty('--d', ms(base + Math.min(i++, 18) * P.word));
            w.append(wi); frag.append(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && !/^(BR|IMG|SVG|I|INPUT|BUTTON)$/i.test(n.tagName) && !n.classList.contains('m-w')) walk(n);
      });
    };
    walk(el);
    return i;
  };

  const run = () => {
    const P = PERSONA[R.personality] || PERSONA.calm;
    window.__motionRules = R;                               // what the engine actually used (debugging)
    html.classList.add('m-' + (PERSONA[R.personality] ? R.personality : 'calm'));
    if (R.accent) html.style.setProperty('--m-accent', /^--/.test(R.accent) ? 'var(' + R.accent + ', currentColor)' : R.accent);
    const L = R.legacy || {};
    const legacySel = [L.reveal, L.extra].filter((s) => s && s.trim()).join(', ');
    const main = document.querySelector('main') || document.body;

    if (reduce) {                                          // show everything, move nothing; the skill's own "in" class still lands
      $$(legacySel).forEach((el) => { el.classList.add('m-in'); if (L.inClass) el.classList.add(L.inClass); });
      reveal(); return;
    }

    /* 1. Intro: the first block of <main> animates on load in a set order */
    const first = [...main.children].find((c) => !/^(SCRIPT|STYLE|TEMPLATE)$/.test(c.tagName) && !c.classList.contains('sr-only') && !c.hidden);
    if (first) first.setAttribute('data-m-intro', '');
    const inIntro = (el) => !!el.closest('[data-m-intro]');

    /* 2. Headlines → words; the chip before them pops, the line / buttons after them rise */
    $$(R.headings, main).forEach((h) => {
      if (within(h, R.noSplit) || within(h, R.mocks) || h.closest('[hidden]')) return;
      if (parseFloat(getComputedStyle(h).fontSize) < 16) return;
      const intro = inIntro(h);
      if (!split(h, intro ? 260 : 80, P)) return;
      let k = 0;
      [...h.parentElement.children].forEach((s) => {
        if (s === h) return;
        if (s.compareDocumentPosition(h) & 4) { if (is(s, R.eyebrows)) set(s, 'pop', 0); return; }   // before the heading
        if (is(s, 'p, a, .btn, [class*="actions"], [class*="cta"], [class*="btns"], [class*="buttons"]')) set(s, 'up', P.lead + k++ * 90);
      });
    });
    $$(R.eyebrows, main).forEach((el) => { if (!within(el, R.cards) && !within(el, R.mocks) && !el.closest('header, nav, footer')) set(el, 'pop', 0); });
    $$(R.wipes, main).forEach((el, k) => { if (!within(el, R.mocks)) set(el, 'wipe', 150 + k * 120); });

    /* 3. Groups: children rise one after another (skill [data-reveal-group] included) */
    const groupSel = [R.groups, L.group].filter((s) => s && s.trim()).join(', ');
    $$(groupSel, main).forEach((g) => {
      if (off(g) || g.closest('header, nav, footer, form, table, [data-m-stagger-done]') || within(g, R.mocks)) return;
      const kids = [...g.children].filter((c) => !/^(SCRIPT|TEMPLATE|STYLE)$/.test(c.tagName) && !c.hidden);
      if (kids.length < 2) return;
      g.setAttribute('data-m-stagger-done', '');
      const chip = is(g, R.chips);
      kids.forEach((c, k) => set(c, chip ? 'pop' : 'up', Math.min(k, 7) * (chip ? P.chip : P.stagger) + (inIntro(g) ? 700 : 0)));
    });

    /* 4. Cards that are not in a group */
    $$(R.cards, main).forEach((c) => { if (!c.closest('[data-m]') && !within(c, R.mocks)) set(c, 'up', inIntro(c) ? 450 : 60); });

    /* 5. Photos: unmask + zoom settle; big ones in clipped frames get parallax */
    const parallax = [];
    $$('img', main).forEach((img) => {
      if (off(img) || /\.svg(\?|$)/i.test(img.getAttribute('src') || '') || img.closest('.btn, .chip, [class*="avatar"], .logo, [class*="logos"]') || within(img, R.mocks)) return;
      const r = img.getBoundingClientRect();
      if (r.width < 140 && r.height < 140) return;
      set(img, 'img', inIntro(img) ? 350 + parallax.length * 120 : 0);
      const host = img.parentElement;
      if (R.parallax && fine && r.width >= 280 && host && /hidden|clip/.test(getComputedStyle(host).overflow + getComputedStyle(host.parentElement || host).overflow)) {
        img.style.setProperty('--ps', '1.08'); parallax.push(img);
      }
    });

    /* 6. Anything left in a section rises as a block, so nothing appears un-animated */
    const walk = (el, depth, intro) => {
      [...el.children].forEach((c) => {
        if (/^(SCRIPT|TEMPLATE|STYLE|LINK|SVG|BR)$/.test(c.tagName) || c.hidden || off(c) || tagged(c) || c.classList.contains('sr-only')) return;
        if (is(c, R.mocks)) { set(c, intro ? 'panel' : 'up', intro ? 450 : 60); return; }
        const cs = getComputedStyle(c);
        if (cs.position === 'absolute' || cs.position === 'fixed' || cs.display === 'none') return;
        if (c.querySelector('[data-m], .m-split')) { if (depth < 4) walk(c, depth + 1, intro); return; }
        const h = c.getBoundingClientRect().height;
        if (h < 12) return;
        set(c, h > 420 && !is(c, 'h1, h2, h3, p, ul, ol') ? 'panel' : 'up', intro ? 450 : 60);
      });
    };
    $$('main > *, body > section, body > .section').forEach((s) => { if (!off(s) && !is(s, 'header, footer, nav, script, style')) walk(s, 0, s.hasAttribute('data-m-intro')); });

    /* 7. Illustrations + mock-ups: parts pop in child order after the container, lines draw, bars grow, numbers count, one glow pulse */
    const counters = [];
    const addCounter = (el, extra = 0) => {
      if (el.children.length || off(el) || miOwned(el) || counters.some((x) => x.el === el) || within(el, R.skipCount) || is(el, R.skipCount)) return;
      const t = el.textContent.trim();
      const m = t.match(/^([+$€£]?)(\d[\d,]*(?:\.\d+)?)(\s?[%+a-zA-Z×]{0,3})$/);
      if (!m) return;
      const num = parseFloat(m[2].replace(/,/g, ''));
      if (!m[1] && !m[3].trim() && !m[2].includes(',') && num >= 1900 && num <= 2100) return;       // a year, not a count
      el.setAttribute('data-m-final', t);
      counters.push({ el, pre: m[1], num, dec: (m[2].split('.')[1] || '').length, comma: m[2].includes(','), suf: m[3], extra });
      if (!tagged(el)) set(el, 'count');
    };
    const mockSel = R.mocks + ', [data-m-draw]';
    $$(mockSel, main).forEach((c) => {
      if (off(c) || within(c, mockSel)) return;
      const base = delayOf(c) + P.mockBase;
      const nodes = $$(R.mockNodes, c).filter((n) => !off(n) && !tagged(n)).slice(0, 14);
      nodes.forEach((n, i) => set(n, 'node', base + i * P.node));
      const after = base + nodes.length * P.node;
      $$(R.mockLines, c).forEach((ln, i) => {
        if (off(ln) || tagged(ln) || typeof ln.getTotalLength !== 'function') return;
        let len = 0; try { len = ln.getTotalLength(); } catch (e) { return; }
        if (!len || !isFinite(len)) return;
        const da = getComputedStyle(ln).strokeDasharray, parts = (da && da !== 'none') ? da.split(/[,\s]+/).map(parseFloat).filter((x) => !isNaN(x)) : [];
        let dash, offset;
        if (!parts.length || parts.every((x) => x === 0)) { dash = len + ' ' + len; offset = len; }             // solid: one dash the length of the path
        else {                                                                                                   // dotted / dashed: repeat the pattern, then one gap as long as the path
          const pat = parts.length % 2 ? parts.concat(parts) : parts, period = pat.reduce((a, b) => a + b, 0) || 1;
          const reps = Math.ceil(len / period); let s = []; for (let k = 0; k < reps; k++) s = s.concat(pat);
          dash = s.join(' ') + ' 0 ' + Math.ceil(len + 1); offset = reps * period;
        }
        ln.style.strokeDasharray = dash; ln.style.strokeDashoffset = offset; ln.setAttribute('data-m-len', Math.round(len));
        ln.setAttribute('data-m', 'line'); ln.style.setProperty('--d', ms(after + 120 + i * 80));
      });
      $$(R.mockBars, c).forEach((b, i) => set(b, 'grow', after + i * P.bar));
      $$('[data-m-grow]', c).forEach((b, i) => set(b, 'grow', after + i * P.bar));
      $$(R.counters, c).forEach((n) => addCounter(n, after));
      $$('[data-m-count]', c).forEach((n) => addCounter(n, after));
      $$(R.lit, c).forEach((n) => { if (miOwned(n)) return; if (getComputedStyle(n).position === 'static') n.classList.add('m-rel'); n.classList.add('m-lit'); n.style.setProperty('--dl', ms(after + 200)); });
      $$([R.floats, '[data-m-float]'].filter(Boolean).join(', '), c).slice(0, 2).forEach((f, k) => float(f, k, inIntro(c) ? 900 : 120, P));
    });
    $$('[data-m-grow]', main).forEach((b, i) => { if (!within(b, mockSel)) set(b, 'grow', 120 + i * P.bar); });

    /* 8. Skill reveals we take over: [data-reveal] (and anything else in rules.legacy.extra) */
    $$(legacySel, main).forEach((el, k) => {
      if (tagged(el) || off(el)) return;
      const i = parseFloat(el.style.getPropertyValue('--i'));
      set(el, 'up', (isNaN(i) ? 0 : Math.min(i, 7) * P.stagger) + (inIntro(el) ? 450 : 0));
    });

    /* 9. Count-up numbers anywhere (300+, 95%, $49, 1,000+) — explicit data-m-count, or big standalone numbers */
    $$('[data-m-count]', main).forEach((el) => addCounter(el));
    $$('main *').forEach((el) => {
      if (el.children.length || !/\d/.test(el.textContent) || el.textContent.trim().length > 14 || counters.some((x) => x.el === el)) return;
      if (el.closest('.m-split, h1, h2, h3, h4')) return;   // a number inside a headline ("35 floors up") is a word, not a stat (Orvel 2026-10-11)
      if (parseFloat(getComputedStyle(el).fontSize) >= 26) addCounter(el);
    });

    /* 10. Ambient floats outside mock-ups */
    function float(el, k, delay, P) {
      if (off(el) || miOwned(el) || el.closest('.btn') || el.classList.contains('m-float')) return;
      keepTranslate(el);
      el.classList.add('m-float');
      el.style.setProperty('--fd', (P.floatDur + (k % 5) * 0.7).toFixed(1) + 's');
      el.style.setProperty('--fdl', (-(k % 7) * 0.9).toFixed(1) + 's');
      el.style.setProperty('--fy', P.floatY[k % 2] + 'px');
      if (!tagged(el) && !el.closest('[data-m]')) set(el, 'pop', delay);
    }
    $$('[data-m-float]', main).forEach((el, k) => { if (!within(el, R.mocks)) float(el, k, inIntro(el) ? 900 + (k % 6) * 90 : 120, P); });

    /* 11. Footer columns rise once */
    const foot = document.querySelector('.site-foot, body > footer');
    if (foot && !off(foot)) {
      const cols = foot.querySelector('[class*="grid"], [class*="cols"], [class*="links"]');
      if (cols) [...cols.children].forEach((el, k) => set(el, 'up', (k % 4) * 90));
      $$('[class*="bottom"], [class*="legal"]', foot).forEach((el) => { if (!el.closest('[data-m]')) set(el, 'up', 60); });
    }

    /* Observe */
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } }), { rootMargin: '0px 0px -7% 0px', threshold: 0 });
    // After its reveal the engine lets go of `transition`, so the component's own hover transitions work again.
    const secs = (v) => v.split(',').map((t) => (t.trim().endsWith('ms') ? parseFloat(t) / 1000 : parseFloat(t) || 0));
    const doneAfter = (el) => {
      const cs = getComputedStyle(el), d = secs(cs.transitionDuration), l = secs(cs.transitionDelay);
      return Math.max(0, ...d.map((x, i) => x + (l[i % l.length] || 0))) * 1000;
    };
    function show(el) {
      el.classList.add('m-in');
      setTimeout(() => { el.classList.add('m-done'); if (el.classList.contains('m-lift')) addTransition(el, LIFT_TR); }, doneAfter(el) + 120);
      if (L.inClass && (el.hasAttribute('data-reveal') || is(el, L.extra))) el.classList.add(L.inClass);
      if (el.getAttribute('data-m') === 'line') el.style.strokeDashoffset = '0';
      const c = counters.find((x) => x.el === el);
      if (c && !c.done) { c.done = true; setTimeout(() => count(c), delayOf(el) || c.extra); }
    }
    const all = $$('[data-m], .m-split, .m-float');
    counters.forEach((c) => { if (!all.includes(c.el)) all.push(c.el); });
    all.forEach((el) => (el.closest('[data-m-intro]') ? setTimeout(() => show(el), 60) : io.observe(el)));

    function count(c) {
      const t0 = performance.now(), dur = P.count;
      const fmt = (v) => { let s = v.toFixed(c.dec); if (c.comma) s = Number(s).toLocaleString('en-US', { minimumFractionDigits: c.dec }); return c.pre + s + c.suf; };
      const step = (now) => { const p = Math.min(1, (now - t0) / dur); const e = 1 - Math.pow(2, -10 * p); c.el.textContent = p === 1 ? c.el.getAttribute('data-m-final') : fmt(c.num * e); if (p < 1) requestAnimationFrame(step); };
      c.el.style.fontVariantNumeric = 'tabular-nums';
      requestAnimationFrame(step);
    }

    /* 12. Chrome: progress bar, smart sticky nav, parallax, bottom-of-page safety — one rAF-throttled scroll handler */
    let bar = null;
    if (R.progress) { bar = document.createElement('div'); bar.className = 'm-progress'; bar.setAttribute('aria-hidden', 'true'); document.body.append(bar); }
    let head = null;   /* an empty or bad nav selector must not stop the rest of the engine (sticky nav, parallax, bottom safety) */
    try { head = R.nav ? document.querySelector(R.nav) : null; } catch (_) { head = null; }
    if (head) head.classList.add('m-nav');
    let lastY = scrollY, ticking = false;
    const showRest = () => $$('[data-m]:not(.m-in), .m-split:not(.m-in), .m-float:not(.m-in)').forEach((el) => { show(el); io.unobserve(el); });
    const onScroll = () => {
      const y = scrollY, max = html.scrollHeight - innerHeight;
      if (bar) bar.style.setProperty('--p', max > 0 ? (y / max).toFixed(4) : 1);
      if (head) {
        head.classList.toggle('m-scrolled', y > 8);
        // the menu stays put: no hide-on-scroll (Farhan 2026-10-10: "all menus are jumping on scroll"). Only colour/shadow may change.
      }
      lastY = y;
      if (y >= max - 4) showRest();
      parallax.forEach((img) => {
        const r = img.parentElement.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight) return;
        const p = (r.top + r.height / 2 - innerHeight / 2) / (innerHeight / 2 + r.height / 2);
        img.style.translate = `0 ${(p * -3.2).toFixed(2)}%`;
      });
      ticking = false;
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    onScroll();

    // Add an engine transition to the element's OWN transition (its hover colours, zooms, lifts keep easing).
    const EASE = 'cubic-bezier(.16, 1, .3, 1)', LIFT_TR = 'translate .6s ' + EASE + ', box-shadow .6s ' + EASE;
    function addTransition(el, extra) {
      if (el.dataset.mBase === undefined) {
        const prev = el.style.transition; el.style.transition = '';
        const cs = getComputedStyle(el), props = cs.transitionProperty.split(','), durs = secs(cs.transitionDuration);
        el.dataset.mBase = (props.length === 1 && props[0].trim() === 'all' && !durs[0]) || durs.every((x) => !x) ? '' : cs.transition;
        el.style.transition = prev;
      }
      el.style.transition = (el.dataset.mBase ? el.dataset.mBase + ', ' : '') + extra;
    }

    if (fine) {
      /* 12a. Smooth scroll (opt-in: "smoothScroll": true; Farhan 2026-10-13 — a calm, premium feel; never on SaaS or local
         sites unless the user asks). Mouse wheels and trackpads glide to their target; the real page scroll position is kept, so
         sticky headers, reveals, anchors and the keyboard all work. Touch screens, reduced motion and ?static keep native scrolling.
         An element (or its ancestor) with data-m-native keeps its own scrolling (maps, carousels, code blocks). */
      if (R.smoothScroll) {
        html.classList.add('m-smooth');
        let target = scrollY, current = scrollY, raf = 0, last = 0;
        const maxY = () => Math.max(0, document.documentElement.scrollHeight - innerHeight);
        const inner = (el, dy) => {
          for (; el && el.nodeType === 1 && el !== document.body && el !== document.documentElement; el = el.parentElement) {
            if (el.hasAttribute('data-m-native')) return true;
            const cs = getComputedStyle(el);
            if (/(auto|scroll|overlay)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1)
              if (dy < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true;
          }
          return false;
        };
        const locked = () => /hidden|clip/.test(getComputedStyle(document.body).overflowY) || /hidden|clip/.test(getComputedStyle(html).overflowY);
        const tick = (t) => {
          const dt = last ? Math.min(64, t - last) : 16.7; last = t;
          current += (target - current) * (1 - Math.pow(1 - 0.085, dt / 16.7));
          if (Math.abs(target - current) < 0.5) { current = target; window.scrollTo(0, current); raf = 0; last = 0; return; }
          window.scrollTo(0, current); raf = requestAnimationFrame(tick);
        };
        const go = (y) => { if (!raf) current = scrollY; target = Math.max(0, Math.min(maxY(), y)); if (!raf) raf = requestAnimationFrame(tick); };
        addEventListener('wheel', (e) => {
          if (document.hidden || e.ctrlKey || e.defaultPrevented || Math.abs(e.deltaX) > Math.abs(e.deltaY) || locked() || inner(e.target, e.deltaY)) return;
          e.preventDefault();
          const d = e.deltaY * (e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? innerHeight : 1);
          go((raf ? target : scrollY) + d);
        }, { passive: false });
        addEventListener('scroll', () => { if (!raf) target = current = scrollY; }, { passive: true });   // keyboard, scrollbar, find-in-page
        document.addEventListener('click', (e) => {
          const a = e.target.closest && e.target.closest('a[href*="#"]'); if (!a || a.target === '_blank') return;
          const u = new URL(a.href, location.href);                                  // "#faq" and "index.html#faq" on this same page
          if (u.origin !== location.origin || u.pathname !== location.pathname || u.search !== location.search) return;
          const id = u.hash.slice(1);
          if (!id || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
          const t = document.getElementById(decodeURIComponent(id)); if (!t) return;
          e.preventDefault();
          const pad = parseFloat(getComputedStyle(html).scrollPaddingTop) || 0;
          go(t.getBoundingClientRect().top + scrollY - pad);
          if (history.pushState) history.pushState(null, '', '#' + id);
        });
      }

      /* 12b. Sliding nav pill (opt-in: data-m-glide on the menu; Farhan 2026-10-13). One soft pill glides to the
         hovered link and rests on aria-current; with no current link it fades in on hover and out on leave. */
      $$('[data-m-glide]').forEach((nav) => {
        if (nav.querySelector(':scope > .m-glide-pill')) return;
        const items = $$(':scope > a, :scope > * > a, :scope > * > button', nav).filter((x) => x.closest('[data-m-glide]') === nav && !x.closest('[role="menu"], .nav__menu, ul ul'));
        if (!items.length) return;
        const pill = document.createElement('span'); pill.className = 'm-glide-pill'; pill.setAttribute('aria-hidden', 'true'); nav.prepend(pill);
        const cur = items.find((x) => x.hasAttribute('aria-current'));
        const to = (el, jump) => {
          const r = el.getBoundingClientRect(), n = nav.getBoundingClientRect();
          if (jump) { pill.style.transition = 'none'; requestAnimationFrame(() => { pill.style.transition = ''; }); }
          pill.style.transform = `translate(${(r.left - n.left - nav.clientLeft).toFixed(1)}px, ${(r.top - n.top - nav.clientTop).toFixed(1)}px)`;
          pill.style.width = r.width + 'px'; pill.style.height = r.height + 'px'; pill.classList.add('on');
        };
        const rest = () => (cur ? to(cur) : pill.classList.remove('on'));
        if (cur) (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => to(cur, true));
        items.forEach((el) => ['mouseenter', 'focus'].forEach((ev) => el.addEventListener(ev, () => to(el, !pill.classList.contains('on')))));
        nav.addEventListener('mouseleave', rest);
        nav.addEventListener('focusout', (e) => { if (!nav.contains(e.relatedTarget)) rest(); });
        addEventListener('resize', () => { if (cur) to(cur, true); });
      });

      /* 13. Magnetic buttons + shine (off by default since 2026-10-13: Farhan wants soft button hovers) */
      if (R.magnetic) $$(R.buttons).forEach((b) => {
        if (off(b)) return;
        b.classList.add('m-mag'); if (!b.hasAttribute('aria-haspopup')) b.classList.add('m-shine');
        b.addEventListener('pointerenter', () => addTransition(b, 'translate .18s ' + EASE));
        b.addEventListener('pointermove', (e) => {
          const r = b.getBoundingClientRect();
          const x = (e.clientX - r.left - r.width / 2) * 0.22, y = (e.clientY - r.top - r.height / 2) * 0.32;
          b.classList.add('m-mag-on'); b.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
        });
        b.addEventListener('pointerleave', () => { addTransition(b, 'translate .5s ' + EASE); b.classList.remove('m-mag-on'); b.style.translate = ''; });
      });

      /* 14. Card spotlight (+ optional lift) */
      $$(R.spotlight).forEach((c) => {
        if (off(c) || within(c, R.mocks) || c.querySelector(':scope > .m-spot')) return;
        if (getComputedStyle(c).position === 'static') c.classList.add('m-rel');
        const s = document.createElement('span'); s.className = 'm-spot'; s.setAttribute('aria-hidden', 'true'); c.prepend(s);
        c.classList.add('m-spot-host');
        // Chrome applies the :hover style BEFORE it dispatches pointerenter, so the lift transition must already be on the element:
        // untagged cards get it now, revealed cards when the engine lets go (.m-done, see show()).
        if (is(c, R.lift)) { c.classList.add('m-lift'); if (!c.hasAttribute('data-m')) addTransition(c, LIFT_TR); }
        c.addEventListener('pointermove', (e) => { const r = c.getBoundingClientRect(); c.style.setProperty('--mx', e.clientX - r.left + 'px'); c.style.setProperty('--my', e.clientY - r.top + 'px'); });
      });

      /* 15. Hero cursor glow (eased follow) — only inside a clipped hero */
      const hero = main.querySelector('[data-m-intro]');
      if (R.cursorGlow && hero && /hidden|clip/.test(getComputedStyle(hero).overflow)) {
        if (getComputedStyle(hero).position === 'static') hero.classList.add('m-rel');
        hero.classList.add('m-glow-host');
        const g = document.createElement('div'); g.className = 'm-glow'; g.setAttribute('aria-hidden', 'true'); hero.prepend(g);
        let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
        const loop = () => { cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08; g.style.translate = `${cx}px ${cy}px`; raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.5 ? requestAnimationFrame(loop) : 0; };
        hero.addEventListener('pointermove', (e) => { const r = hero.getBoundingClientRect(); tx = e.clientX - r.left; ty = e.clientY - r.top; if (!raf) raf = requestAnimationFrame(loop); });
      }
    }

    reveal();
  };

  const start = () => ready.then(run);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
