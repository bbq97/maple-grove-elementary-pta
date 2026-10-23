/* Grayskills micro-interactions (micro.js) — small, purposeful moments that show the product doing its job.
   Declarative: put data-mi="<verb>" on an element. The page as written IS the final state: with no JS, ?static or
   prefers-reduced-motion nothing is hidden and nothing moves. Each moment plays ONCE when its block is well in view
   (after motion.js has revealed the block), or answers the pointer (hover / click). See motion/MICRO.md for the rules.

   Verbs
     sequence  container; children [data-mi-step] arrive in order. A step may also carry
               data-mi-text="new text" (swaps its text when it plays), data-mi-add="cls" (adds a class when it plays),
               data-mi-count (counts its number up from 0). data-mi-sync="#list" lights list item [data-mi-sync-i].
     type      types its own text with a caret; data-mi-then="#id" starts another moment when done.
     track     a bar whose --b grows from --a; the list given by data-mi-stops lights each stop it passes.
     mark      a marker sweeps under the text (a quote, a highlighted clause).
     flip      a status that finishes: shows data-mi-from (+ class data-mi-from-class) first, then becomes what is written.
     tips      hover tooltips on chart bars: children carry data-mi-tip="Sep · 1,284".
     roll      a number that rolls to its new value whenever its text changes (price toggles).
   Timing: UI-speed eases (180–600ms), never a performance; one moment per block. */
(function () {
  "use strict";
  var D = document, W = window;
  var calm = !(W.matchMedia && W.matchMedia("(prefers-reduced-motion: reduce)").matches) && !/[?&]static\b/.test(location.search);
  var EASE = "cubic-bezier(.22,1,.36,1)";
  function $all(sel, root) { return Array.prototype.slice.call((root || D).querySelectorAll(sel)); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function num(s) { var m = String(s).match(/-?[\d,.]+/); return m ? { v: parseFloat(m[0].replace(/,/g, "")), raw: m[0], dec: (m[0].split(".")[1] || "").length, comma: m[0].indexOf(",") >= 0 } : null; }
  function fmt(v, n) { var s = v.toFixed(n.dec); if (n.comma) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ","); return s; }
  function countUp(el, ms) {
    var t = el.textContent, n = num(t); if (!n) return;
    var t0 = performance.now();
    (function f(now) {
      var k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      el.textContent = t.replace(n.raw, fmt(n.v * e, n));
      if (k < 1) requestAnimationFrame(f); else el.textContent = t;
    })(t0);
  }
  // play once when the block is well in view; motion.js reveals the block first (it adds .m-done), so wait a beat
  function onView(el, fn, delay) {
    if (!("IntersectionObserver" in W)) return fn();
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var tall = e.intersectionRect && e.intersectionRect.height >= (W.innerHeight || 800) * 0.55;   // a block taller than ~2 screens never reaches 45%
        if (e.isIntersecting && (e.intersectionRatio >= 0.45 || tall)) { io.disconnect(); setTimeout(fn, delay == null ? 650 : delay); }
      });
    }, { threshold: [0, 0.1, 0.2, 0.3, 0.45] });
    io.observe(el);
  }

  var VERBS = {
    sequence: function (el) {
      var steps = $all("[data-mi-step]", el), gap = +(el.getAttribute("data-mi-gap") || 520);
      steps = steps.map(function (s, i) { return [s, s.hasAttribute("data-mi-order") ? +s.getAttribute("data-mi-order") : i]; })
                   .sort(function (a, b) { return a[1] - b[1]; }).map(function (x) { return x[0]; });
      steps.forEach(function (s) {                               // data-mi-reset="cls": the step starts with these classes and returns to its written ones
        if (s.getAttribute("data-mi-reset") != null) { s.dataset.miClass = s.className; s.className = s.getAttribute("data-mi-reset"); }
      });
      var sync = el.getAttribute("data-mi-sync") ? D.querySelector(el.getAttribute("data-mi-sync")) : null;
      var swaps = steps.map(function (s) { return s.getAttribute("data-mi-text") != null ? s.textContent : null; });
      steps.forEach(function (s) {
        if (s.hasAttribute("data-mi-hold")) return;            // stays visible, only changes when its turn comes
        s.classList.add("mi-pre");
      });
      steps.forEach(function (s) { if (s.getAttribute("data-mi-from")) { s.dataset.miFinal = s.textContent; s.textContent = s.getAttribute("data-mi-from"); } });
      return function () {
        var p = Promise.resolve(); if (sync) sync.classList.add("mi-playing");
        steps.forEach(function (s, i) {
          p = p.then(function () {
            if (el.dataset.miDone) return;                       // finished early (window.__miFinish)
            if (s.dataset.miClass != null) s.className = s.dataset.miClass;
            s.classList.remove("mi-pre"); s.classList.add("mi-in");
            if (s.dataset.miFinal != null) { s.classList.add("mi-swap"); setTimeout(function () { s.textContent = s.dataset.miFinal; s.classList.remove("mi-swap"); }, 160); }
            if (s.getAttribute("data-mi-add")) s.getAttribute("data-mi-add").split(/\s+/).forEach(function (c) { s.classList.add(c); });
            if (s.getAttribute("data-mi-remove")) s.getAttribute("data-mi-remove").split(/\s+/).forEach(function (c) { s.classList.remove(c); });
            $all("[data-mi-count]", s).concat(s.hasAttribute("data-mi-count") ? [s] : []).forEach(function (c) { countUp(c, 900); });
            if (sync && s.hasAttribute("data-mi-sync-i")) {
              $all("[data-mi-sync-item]", sync).forEach(function (li) { li.classList.toggle("mi-lit", li.getAttribute("data-mi-sync-item") === s.getAttribute("data-mi-sync-i")); });
            }
            return wait(+(s.getAttribute("data-mi-wait") || gap));
          });
        });
        p.then(function () { if (sync && !el.dataset.miDone) setTimeout(function () { $all(".mi-lit", sync).forEach(function (li) { li.classList.remove("mi-lit"); }); sync.classList.remove("mi-playing"); }, 1400); });
        return p;
      };
    },
    type: function (el) {
      var full = el.getAttribute("data-mi-text") || el.textContent.trim();
      var keep = $all("[data-mi-keep]", el);                    // child elements (a send button) that stay
      el.dataset.miTyped = full;
      var tn = D.createTextNode(""); var caret = D.createElement("span"); caret.className = "mi-caret";
      Array.prototype.slice.call(el.childNodes).forEach(function (n) { if (n.nodeType === 3) n.remove(); });   // empty field until it types
      el.insertBefore(caret, el.firstChild); el.insertBefore(tn, caret);
      return function () {
        var i = 0, speed = +(el.getAttribute("data-mi-speed") || 34);
        return new Promise(function (done) {
          (function t() {
            if (el.dataset.miTyped == null) return done();         // finished early
            tn.textContent = full.slice(0, ++i);
            if (i < full.length) setTimeout(t, speed + (/[ ,.?]/.test(full[i - 1]) ? speed * 1.6 : Math.random() * speed * .6));
            else setTimeout(function () { caret.remove(); delete el.dataset.miTyped; done(); }, 420);
          })();
        });
      };
    },
    track: function (el) {
      var bar = el.querySelector("i") || el, cs = bar.getAttribute("style") || "";
      var b = (cs.match(/--b:\s*([\d.]+)%/) || [0, "100"])[1], a = (cs.match(/--a:\s*([\d.]+)%/) || [0, "0"])[1];
      var stops = el.getAttribute("data-mi-stops") ? $all(el.getAttribute("data-mi-stops") + " > li") : [];
      var ms = +(el.getAttribute("data-mi-dur") || 1600), byTime = el.getAttribute("data-mi-stops-by") === "time";
      el.dataset.miB = b; bar.style.setProperty("--b", a + "%"); stops.forEach(function (s) { s.classList.add("mi-dim"); });
      return function () {
        bar.style.transition = "none"; var t0 = performance.now();
        return new Promise(function (done) {
          (function f(now) {
            var k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 2.4), cur = +a + (b - a) * e;
            bar.style.setProperty("--b", cur.toFixed(2) + "%");
            stops.forEach(function (s, i) {                       // by position along the bar, or (data-mi-stops-by="time") evenly through the run
              var even = (i / Math.max(1, stops.length - 1)) * 100, m = (s.getAttribute("style") || "").match(/--x:\s*([\d.]+)%/);
              var x = byTime || !m ? even : parseFloat(m[1]);         // a stop without --x is lit evenly through the run (2026-10-17: Castbay's stops stayed dim)
              if ((byTime || !m ? k * 100 : cur) + 0.5 >= x) s.classList.remove("mi-dim");
            });
            if (el.dataset.miB == null) return done();                // finished early (scrolled away / a checker)
            if (k < 1) requestAnimationFrame(f); else { bar.style.setProperty("--b", b + "%"); stops.forEach(function (s) { s.classList.remove("mi-dim"); }); delete el.dataset.miB; done(); }   // never leave a stop dimmed
          })(t0);
        });
      };
    },
    // edge: the design's signature edge line (Ombra's horizon) comes alive — it draws in from the centre when the block
    // lands, then (data-mi-edge="travel") a soft light runs along it once per period while on screen (a loop group).
    // If the element has no edge of its own, data-mi-edge-line="top|bottom" draws one in the page's accent gradient.
    edge: function (el) {
      var line = el.getAttribute("data-mi-edge-line");
      if (line) { var l = D.createElement("span"); l.className = "mi-edge-line mi-edge-line--" + line; l.setAttribute("aria-hidden", "true"); el.appendChild(l); }
      if (getComputedStyle(el).position === "static") el.style.position = "relative";
      el.classList.add("mi-edge", "mi-edge-pre");
      if ((el.getAttribute("data-mi-edge") || "").indexOf("travel") > -1) {
        var lt = D.createElement("span"); lt.className = "mi-edge-light mi-edge-light--" + (line || "top"); lt.setAttribute("aria-hidden", "true"); el.appendChild(lt);
        if (el.getAttribute("data-mi-period")) lt.style.setProperty("--mi-period", el.getAttribute("data-mi-period"));
        lt.classList.add("mi-loop"); loops.push({ el: lt, ratio: 0, group: el.closest("[data-mi-group], article, .icard, .card, figure, section") || el });
      }
      return function () { el.classList.remove("mi-edge-pre"); return wait(1100); };
    },
    mark: function (el) { el.classList.add("mi-mark", "mi-pre-mark"); return function () { el.classList.remove("mi-pre-mark"); return wait(900); }; },
    flip: function (el) {
      var fin = el.textContent, cls = el.getAttribute("data-mi-from-class") || "", fcls = el.className;
      el.dataset.miFin = fin; el.dataset.miFinCls = fcls;
      el.textContent = el.getAttribute("data-mi-from") || "Working…"; if (cls) { el.className = fcls.replace(/\bis-\w+\b/g, "") + " " + cls; }
      el.classList.add("mi-busy");
      return function () {
        return wait(+(el.getAttribute("data-mi-after") || 1400)).then(function () {
          el.classList.add("mi-swap");
          setTimeout(function () { if (el.dataset.miFin == null) return; delete el.dataset.miFin; el.className = fcls; el.textContent = fin; el.classList.add("mi-done-pop"); }, 180);
        });
      };
    },
    tips: function (el) {
      // data-mi-big="#el" / data-mi-label-to="#el": a headline figure (and its caption) that follows the hovered bar
      var big = el.getAttribute("data-mi-big") ? D.querySelector(el.getAttribute("data-mi-big")) : null, big0 = big && big.textContent;
      var lab = el.getAttribute("data-mi-label-to") ? D.querySelector(el.getAttribute("data-mi-label-to")) : null, lab0 = lab && lab.textContent;
      var tip = D.createElement("span"); tip.className = "mi-tip"; tip.setAttribute("aria-hidden", "true"); if (getComputedStyle(el).position === "static") el.style.position = "relative"; el.appendChild(tip);
      $all("[data-mi-tip]", el).forEach(function (b) {
        b.addEventListener("pointerenter", function () {
          var r = b.getBoundingClientRect(), r0 = el.getBoundingClientRect();
          tip.textContent = b.getAttribute("data-mi-tip");
          tip.style.left = (r.left - r0.left + r.width / 2) + "px"; tip.style.top = (r.top - r0.top) + "px";
          el.classList.add("mi-tips-on"); $all("[data-mi-tip]", el).forEach(function (o) { o.classList.toggle("mi-dim", o !== b); });
          if (big && b.getAttribute("data-mi-big")) { big.textContent = b.getAttribute("data-mi-big"); if (lab && b.getAttribute("data-mi-label")) lab.textContent = b.getAttribute("data-mi-label"); }
        });
      });
      el.addEventListener("pointerleave", function () {
        el.classList.remove("mi-tips-on"); $all("[data-mi-tip]", el).forEach(function (o) { o.classList.remove("mi-dim"); });
        if (big) { big.textContent = big0; if (lab) lab.textContent = lab0; }
      });
      return null;                                               // pointer-driven, nothing to play on view
    },
    roll: function (el) {
      var last = el.textContent;
      new MutationObserver(function () {
        var now = el.textContent; if (now === last || el.dataset.miRolling) return;
        var a = num(last), b = num(now); last = now; if (!a || !b) return;
        el.dataset.miRolling = 1; var t0 = performance.now(), ms = 520;
        el.classList.add("mi-rolling");
        (function f(t) {
          var k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
          el.textContent = now.replace(b.raw, fmt(a.v + (b.v - a.v) * e, b));
          if (k < 1) requestAnimationFrame(f); else { el.textContent = now; delete el.dataset.miRolling; el.classList.remove("mi-rolling"); }
        })(t0);
      }).observe(el, { childList: true, characterData: true, subtree: true });
      return null;
    }
  };

  // ── loops: quiet life on illustrations (float, breathe, drift, glint). They run only while on screen, at most
  //    MAX_LOOPS at once (the most visible win), never with reduced motion / ?static. Long periods, small amplitudes. ──
  var MAX_LOOPS = 2, loops = [];   // MAX_LOOPS = illustrated cards alive at once (a card's own loops count as one)
  function setupLoop(el) {
    var kind = el.getAttribute("data-mi-loop") || "float";
    if (el.getAttribute("data-mi-period")) el.style.setProperty("--mi-period", el.getAttribute("data-mi-period"));
    if (el.getAttribute("data-mi-amp")) el.style.setProperty("--mi-amp", el.getAttribute("data-mi-amp"));
    if (el.getAttribute("data-mi-phase")) el.style.setProperty("--mi-phase", el.getAttribute("data-mi-phase"));
    if (kind === "glint") {                                     // a light sheen masked to the drawing itself
      var img = el.tagName === "IMG" ? el : el.querySelector("img");
      if (img) {
        var wrap = D.createElement("span"); wrap.className = "mi-glint"; img.parentNode.insertBefore(wrap, img); wrap.appendChild(img);
        wrap.style.setProperty("--mi-mask", 'url("' + img.currentSrc + '")');
        if (!img.currentSrc) img.addEventListener("load", function () { wrap.style.setProperty("--mi-mask", 'url("' + img.currentSrc + '")'); });
        el.classList.remove("mi-loop--glint"); el = wrap; el.classList.add("mi-loop", "mi-loop--glint");
      }
    }
    if (kind !== "glint") {
      var tr = getComputedStyle(el).translate;                   // keep a centring translate (illustration parts) while it floats
      if (tr && tr !== "none") { var p = tr.split(" "); el.style.setProperty("--mi-tx", p[0]); el.style.setProperty("--mi-ty", p[1] || "0px"); }
      el.classList.add("mi-loop", "mi-loop--" + kind);
    }
    loops.push({ el: el, ratio: 0, group: el.closest("[data-mi-group], article, .icard, .card, figure, section") || el });
  }
  function runLoops() {
    var best = new Map();                                      // each group's best visibility
    loops.forEach(function (l) { best.set(l.group, Math.max(best.get(l.group) || 0, l.ratio)); });
    var live = Array.from(best.entries()).filter(function (g) { return g[1] > 0.25; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, MAX_LOOPS).map(function (g) { return g[0]; });
    loops.forEach(function (l) { l.el.classList.toggle("mi-run", live.indexOf(l.group) > -1); });
  }
  function watchLoops() {
    if (!loops.length || !("IntersectionObserver" in W)) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { loops.forEach(function (l) { if (l.el === e.target || l.el.contains(e.target) || e.target.contains(l.el)) l.ratio = e.isIntersecting ? e.intersectionRatio : 0; }); });
      runLoops();
    }, { threshold: [0, .25, .5, .75, 1] });
    loops.forEach(function (l) { io.observe(l.el); });
  }

  // finish(el): jump a moment to the written page (its final state) — no animation. Used when a started moment leaves the
  // screen before it ends, and by the checkers: window.__miFinish() finishes every STARTED moment; window.__miFinish(true)
  // finishes all of them. A moment whose block was scrolled through but never started stays as it is, so a checker sees it.
  var started = [], all = [];
  function finish(el) {
    $all(".mi-pre", el).concat(el.classList.contains("mi-pre") ? [el] : []).forEach(function (s) { s.classList.remove("mi-pre"); s.classList.add("mi-in"); });
    $all("[data-mi-step]", el).forEach(function (s) {
      if (s.dataset.miClass != null) { s.className = s.dataset.miClass; delete s.dataset.miClass; s.classList.add("mi-in"); }
      if (s.dataset.miFinal != null) { s.textContent = s.dataset.miFinal; delete s.dataset.miFinal; }
    });
    if (el.getAttribute("data-mi-stops")) $all(el.getAttribute("data-mi-stops") + " > li").forEach(function (s) { s.classList.remove("mi-dim"); });
    el.dataset.miDone = 1;
    var sl = el.getAttribute("data-mi-sync") ? D.querySelector(el.getAttribute("data-mi-sync")) : null;
    if (sl) { sl.classList.remove("mi-playing"); $all(".mi-lit", sl).forEach(function (li) { li.classList.remove("mi-lit"); }); }
    el.classList.remove("mi-pre-mark", "mi-edge-pre", "mi-busy");
    if (el.dataset.miFin != null) { el.textContent = el.dataset.miFin; el.className = el.dataset.miFinCls; delete el.dataset.miFin; }
    if (el.dataset.miTyped != null) { $all(".mi-caret", el).forEach(function (c) { c.remove(); }); el.firstChild && el.firstChild.nodeType === 3 ? (el.firstChild.textContent = el.dataset.miTyped) : el.insertBefore(D.createTextNode(el.dataset.miTyped), el.firstChild); delete el.dataset.miTyped; }
    if (el.dataset.miB != null) { var bar = el.querySelector("i") || el; bar.style.setProperty("--b", el.dataset.miB + "%"); delete el.dataset.miB; }
  }
  W.__miFinish = function (everything) { (everything ? all : started).forEach(finish); return (everything ? all : started).length; };

  function init() {
    D.documentElement.classList.add("mi-js");
    var players = {};
    if (calm) $all('[data-mi~="loop"]').forEach(setupLoop);
    $all("[data-mi]").forEach(function (el) { el.getAttribute("data-mi").split(/\s+/).forEach(function (v) {   // several verbs per element: "sequence edge"
      if (!VERBS[v]) return;
      if (!calm && v !== "tips") return;                         // reduced motion / static: the written page is final
      var play; try { play = VERBS[v](el); } catch (err) { if (W.console) console.warn("micro.js: " + v + " failed on", el, err); return; }   // one broken moment never stops the rest
      if (!play) return;
      all.push(el);
      var play0 = play; play = function () { if (started.indexOf(el) < 0) started.push(el); return play0(); };
      if (el.id) players[el.id] = play;
      if (el.hasAttribute("data-mi-chained")) return;            // started by another moment's data-mi-then
      onView(el.closest("[data-mi-view]") || el, function run() {
        Promise.resolve(play()).then(function () {
          var nx = el.getAttribute("data-mi-then"); if (nx && players[nx.replace("#", "")]) players[nx.replace("#", "")]();
        });
      }, el.hasAttribute("data-mi-delay") ? +el.getAttribute("data-mi-delay") : null);
    }); });
    watchLoops();
  }
  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", init); else init();
})();
