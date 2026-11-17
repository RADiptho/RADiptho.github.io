/* Md. Rakib Ahammed Diptho — site behaviour (2026-11 redesign)

   One page, seven views: #home #research #publications #datasets #cv #service #contact. Only the view the
   address names is shown; a link or tab changes the view behind an ink veil. Contents:
     1  helpers, day and night         8  hero network (canvas) and depth of the stages
     2  content derived from the page  9  pointer effects, pager, certificate strip
     3  reveal on scroll              10  publication filters
     4  counters and word highlight   11  Google Scholar panel, new records
     5  header and menu               12  contact form
     6  router and view transitions   13  viewer (certificates, paper fronts)
     7  intro
   Without JavaScript every view is simply visible, one after another. With prefers-reduced-motion nothing moves.
   No number is typed in here: publication counts are counted from the lists in index.html, and Google Scholar
   figures come from data/scholar.json, which the scheduled workflow writes. The same file brings the records
   Crossref and DataCite hold for the author; one that the lists do not have yet is added to its list (section 11). */
(function () {
  'use strict';
  var w = window, d = document, root = d.documentElement;
  w.__rd = 1;                       // tells the inline script in <head> that this file is running
  root.classList.add('js');

  // ---------- 1. helpers ----------
  function $(s, c) { return (c || d).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function safe(name, fn) { try { return fn(); } catch (e) { if (w.console && console.error) console.error('site.js: ' + name, e); } }
  function media(q) { return w.matchMedia ? w.matchMedia(q) : { matches: false }; }
  var raf = w.requestAnimationFrame ? w.requestAnimationFrame.bind(w) : function (f) { return setTimeout(function () { f(Date.now()); }, 16); };
  var reduce = media('(prefers-reduced-motion: reduce)').matches;
  var fine = media('(hover: hover) and (pointer: fine)').matches;
  var ARROW = '<svg class="i" aria-hidden="true" focusable="false"><use href="#i-arrow"/></svg>';
  // a soft light follows the pointer over a card (mouse only; cards added later get it too)
  function spot(el) {
    if (!fine || reduce) return;
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      el.style.setProperty('--mx', Math.round(e.clientX - r.left) + 'px'); el.style.setProperty('--my', Math.round(e.clientY - r.top) + 'px');
    });
  }
  var RIGHT = '<svg class="i" aria-hidden="true" focusable="false"><use href="#i-right"/></svg>';
  var NAME = 'Md. Rakib Ahammed Diptho';
  var header = $('#siteHeader'), hero = $('.hero'), views = $$('main > .view');
  var current = null, started = false;

  // day and night: the inline script in <head> has already put "night" on <html> when that was the visitor's last choice
  var night = root.classList.contains('night');
  safe('theme', function () {
    var btn = $('#themeBtn'); if (!btn) return;
    function paint() { btn.setAttribute('aria-pressed', night ? 'true' : 'false'); btn.title = night ? 'Switch to day mode' : 'Switch to night mode'; }
    btn.addEventListener('click', function () {
      night = !night;
      if (!reduce) { root.classList.add('theme-fade'); setTimeout(function () { root.classList.remove('theme-fade'); }, 560); }   // colours cross-fade once
      root.classList.toggle('night', night);
      try { w.localStorage.setItem('rd-theme', night ? 'dark' : 'light'); } catch (e) {}                                        // remembered in this browser
      paint(); updateHeader();
    });
    paint();
  });

  var scrollFns = [], ticking = false;
  function runScroll() { ticking = false; for (var i = 0; i < scrollFns.length; i++) scrollFns[i](); }
  function requestScroll() { if (!ticking) { ticking = true; raf(runScroll); } }
  function onScroll(fn) { scrollFns.push(fn); }
  w.addEventListener('scroll', requestScroll, { passive: true });
  w.addEventListener('resize', requestScroll, { passive: true });
  function pageY() { return w.pageYOffset || root.scrollTop || 0; }
  function scrollToY(y, smooth) {
    y = Math.max(0, y);
    try { w.scrollTo({ top: y, left: 0, behavior: smooth && !reduce ? 'smooth' : 'auto' }); } catch (e) { w.scrollTo(0, y); }
  }
  // position in the document from offsets, so entrance transforms that are still running do not shift the target
  function docTop(el) { var y = 0; while (el) { y += el.offsetTop || 0; el = el.offsetParent; } return y; }
  // on narrow screens the publication type tabs stay under the header; what scrolls to the list must clear them
  function stickyPad(el) {
    var bar = $('.filter-row[data-filter="type"]');
    if (!bar || !el || !el.closest || !el.closest('.pub-content') || media('(min-width: 1100px)').matches) return 0;
    return bar.offsetHeight;
  }
  function scrollToEl(el, smooth) { if (el) scrollToY(docTop(el) - Math.min(header ? header.offsetHeight : 64, 64) - 18 - stickyPad(el), smooth); }
  // where a filtered publication list begins: the two-column layout on wide screens, the area chips on narrow ones
  function pubAnchor() { return media('(min-width: 1100px)').matches ? ($('.pub-layout') || $('#pubsCurated')) : ($('#pubAreas') || $('#pubsCurated')); }

  // ---------- 2. content derived from the page (counts) ----------
  var pubs = $$('#pubsCurated .pub');
  var counts = { all: 0, journal: 0, accepted: 0, conference: 0, datasets: 0 };
  var THEMES = {};                  // key -> label, read from the filter chips so the labels live in one place
  var info = [];
  // Every count on the site is counted from the lists. It runs once at the start and again when section 11 has
  // added a record that a registry knows and the page did not have yet.
  function recount(again) {
    counts.all = pubs.length; counts.journal = counts.accepted = counts.conference = 0;
    counts.datasets = $$('#datasetList .dataset').length;
    pubs.forEach(function (li) { var t = li.getAttribute('data-type'); if (counts[t] != null) counts[t]++; });
    $$('[data-count-of]').forEach(function (el) {
      var k = el.getAttribute('data-count-of'), n = counts[k]; if (n == null) return;
      var box = el.closest ? el.closest('.tile-num, .fbtn') : null;
      if (box && k !== 'all') box.hidden = !n;                                   // a type with nothing in it is not offered
      if (!el.classList.contains('stat-n')) { el.textContent = n; return; }
      if (again && String(el.getAttribute('data-to')) === String(n)) return;
      el.setAttribute('data-to', n);
      var host = again && el.closest ? el.closest('[data-r]') : null;
      if (host && host.classList.contains('in')) Counter.ready(el); else el.textContent = n;
    });
  }
  safe('derived', function () {
    recount(false);
    $$('.filters .fchip[data-value]').forEach(function (b) { var k = b.getAttribute('data-value'); if (k !== 'all') THEMES[k] = b.textContent.trim(); });
    info = pubs.map(function (li) {
      var t = $('.pub-title', li), a = t && $('a', t);
      return { li: li, title: ((a || t || li).textContent || '').trim(), href: a ? a.getAttribute('href') : '', year: li.getAttribute('data-year') || '',
        type: li.getAttribute('data-type'), themes: (li.getAttribute('data-themes') || '').split(/\s+/).filter(Boolean) };
    });
    // Research: how many publications belong to each interest; the card opens the Publications view filtered to it
    Object.keys(THEMES).forEach(function (k) {
      var n = info.filter(function (p) { return p.themes.indexOf(k) > -1; }).length;
      $$('[data-theme-count="' + k + '"]').forEach(function (el) {
        el.textContent = n + (n === 1 ? ' publication' : ' publications');
        var link = el.closest ? el.closest('a') : null; if (!link) return;
        if (!n) link.hidden = true;
        else link.setAttribute('aria-label', n + (n === 1 ? ' publication' : ' publications') + ' in ' + THEMES[k] + ': show them in Publications');
      });
    });
  });

  // ---------- 3. reveal on scroll ----------
  // [data-r] elements start hidden (only when this script runs) and receive .in when they enter the viewport.
  // After the entrance .r-done hands the element back to its own styles, so hover transitions are not delayed.
  var Reveal = (function () {
    var io = null, hooks = [];
    function maxDelay(el) {
      var v = 0;
      String(getComputedStyle(el).transitionDelay || '').split(',').forEach(function (p) { var n = parseFloat(p) || 0; if (p.indexOf('ms') > -1) n /= 1000; if (n > v) v = n; });
      return v * 1000;
    }
    function batched(el) { var p = el.parentNode; return !!(p && typeof p.className === 'string' && /(^|\s)(pub-list|certs|metrics)(\s|$)/.test(p.className)); }
    function show(el, order) {
      if (el.classList.contains('in')) return;
      if (order != null) el.style.setProperty('--d', (order * 70) + 'ms');
      var wait = reduce ? 0 : maxDelay(el), kind = el.getAttribute('data-r');
      el.classList.add('in');
      for (var i = 0; i < hooks.length; i++) hooks[i](el);
      if (kind === 'lines') return;
      setTimeout(function () { if (el.classList.contains('in')) el.classList.add('r-done'); }, wait + (kind === 'photo' ? 1900 : 1050));
    }
    if ('IntersectionObserver' in w) {
      io = new IntersectionObserver(function (entries) {
        var k = 0;
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          io.unobserve(en.target);
          show(en.target, batched(en.target) ? Math.min(k++, 6) : null);
        });
      }, { threshold: 0.05, rootMargin: '0px 0px -6% 0px' });
    }
    function arm(scope) {
      var els = $$('[data-r]', scope).filter(function (el) { return !el.classList.contains('in'); });
      if (reduce || !io) { els.forEach(function (el) { el.classList.add('in'); el.classList.add('r-done'); for (var i = 0; i < hooks.length; i++) hooks[i](el); }); return; }
      // what stands on a stage is on screen by design and is shown at once; the rest waits for the viewport
      els.forEach(function (el) { if (el.closest && el.closest('.hero, .page-head')) show(el); else io.observe(el); });
      // safety net: anything on screen that the observer has not reported after a while is shown anyway
      setTimeout(function () {
        els.forEach(function (el) {
          if (el.classList.contains('in') || !el.offsetParent) return;
          var r = el.getBoundingClientRect(); if (r.bottom > 0 && r.top < w.innerHeight) show(el);
        });
      }, 2600);
    }
    function reset(scope) {
      $$('[data-r]', scope).forEach(function (el) {
        if (io) io.unobserve(el);
        el.classList.remove('in'); el.classList.remove('r-done');
        if (batched(el)) el.style.removeProperty('--d');
      });
    }
    function index() { $$('[data-stagger]').forEach(function (box) { $$('[data-r]', box).forEach(function (el, i) { el.style.setProperty('--i', Math.min(i, 8)); }); }); }
    function all() { $$('[data-r]').forEach(function (el) { el.classList.add('in'); el.classList.add('r-done'); }); }
    w.addEventListener('beforeprint', all);
    return { show: show, arm: arm, reset: reset, index: index, onShow: function (fn) { hooks.push(fn); } };
  })();
  Reveal.index();

  // ---------- 4. counters and the word-by-word statement ----------
  // The final value is in the document for assistive technology from the start; only the visible digits count up.
  var Counter = (function () {
    function run(el) {
      var to = parseInt(el.getAttribute('data-to'), 10); if (isNaN(to)) return;
      var sr = d.createElement('span'), vis = d.createElement('span');
      sr.className = 'sr'; sr.textContent = to;
      vis.setAttribute('aria-hidden', 'true'); vis.textContent = reduce ? to : 0;
      el.textContent = ''; el.appendChild(sr); el.appendChild(vis);
      if (reduce) return;
      var t0 = 0, dur = 900 + Math.min(700, to * 30), my = (el.__run = (el.__run || 0) + 1);
      raf(function tick(t) {
        if (el.__run !== my) return;
        if (!t0) t0 = t;
        var p = clamp((t - t0) / dur, 0, 1);
        vis.textContent = Math.round(to * (1 - Math.pow(1 - p, 4)));
        if (p < 1) raf(tick);
      });
    }
    Reveal.onShow(function (el) { $$('.stat-n[data-to]', el).forEach(run); });
    return { ready: function (el) { var host = el.closest('[data-r]'); if (!host || host.classList.contains('in')) run(el); } };
  })();

  safe('statement', function () {
    var el = $('.statement[data-words]'); if (!el || reduce) return;
    var paras = $$('p', el); if (!paras.length) paras = [el];            // one paragraph or several: the words light up in reading order
    paras.forEach(function (p) {
      var words = p.textContent.replace(/\s+/g, ' ').trim().split(' ');
      p.innerHTML = words.map(function (x) { return '<span class="w">' + esc(x) + '</span>'; }).join(' ');
    });
    el.classList.add('words-ready');
    var spans = $$('.w', el), lit = -1;
    function update() {
      if (!el.offsetParent) return;
      var r = el.getBoundingClientRect(), vh = w.innerHeight || 800;
      var n = Math.round(clamp((vh * 0.86 - r.top) / (r.height + vh * 0.40), 0, 1) * spans.length);
      if (n === lit) return;
      for (var i = 0; i < spans.length; i++) spans[i].classList.toggle('on', i < n);
      lit = n;
    }
    onScroll(update); update();
  });

  // ---------- 5. header and menu ----------
  var navLinks = $$('#menu .nav-links a[data-view]'), pill = $('.nav-pill'), navBox = $('#menu .nav-links');
  function activeLink() { for (var i = 0; i < navLinks.length; i++) if (navLinks[i].classList.contains('active')) return navLinks[i]; return null; }
  function movePill(link) {
    if (!pill) return;
    var shown = getComputedStyle(pill).display !== 'none' && pill.offsetParent !== null;
    navLinks.forEach(function (a) { a.classList.toggle('pill-on', shown && a === link); });
    if (!shown || !link) { pill.classList.remove('ready'); return; }
    pill.style.width = link.offsetWidth + 'px';
    pill.style.transform = 'translateX(' + link.offsetLeft + 'px)';
    pill.classList.add('ready');
  }
  function stageOf(view) { return view ? $('.hero, .page-head', view) : null; }
  function updateHeader() {
    if (!header) return;
    var y = pageY(), st = stageOf(current), hh = header.offsetHeight;
    header.classList.toggle('on-dark', night || !!(st && y < st.offsetHeight - hh - 24));     // over a stage, until the sheet reaches the header; at night always
    header.classList.toggle('is-scrolled', y > 12);
    var name = current && current.id === 'home' ? $('.hero-title', current) : null;   // on Home the large name stands in for the small one
    header.classList.toggle('at-hero', !!(name && y < docTop(name) + name.offsetHeight - hh));
    var max = root.scrollHeight - (w.innerHeight || 0);
    header.style.setProperty('--p', max > 0 ? clamp(y / max, 0, 1).toFixed(4) : '0');   // reading progress line under the header
  }
  onScroll(updateHeader);
  safe('nav', function () {
    navLinks.forEach(function (a) {
      a.addEventListener('mouseenter', function () { if (fine) movePill(a); });
      a.addEventListener('focus', function () { movePill(a); });
      a.addEventListener('blur', function () { movePill(activeLink()); });
    });
    if (navBox) navBox.addEventListener('mouseleave', function () { movePill(activeLink()); });
  });

  var Menu = (function () {
    var btn = $('#menuBtn'), open = false;
    var label = btn && $('.menu-btn-label', btn), rest = [$('#main'), $('.site-footer')];
    function set(on) {
      if (!btn || !header || on === open) return;
      open = on;
      header.classList.toggle('menu-open', on); root.classList.toggle('menu-lock', on);
      btn.setAttribute('aria-expanded', on ? 'true' : 'false');
      if (label) label.textContent = on ? 'Close' : 'Menu';
      rest.forEach(function (el) { if (!el) return; if (on) el.setAttribute('inert', ''); else el.removeAttribute('inert'); });
    }
    if (btn) btn.addEventListener('click', function () { set(!open); });
    d.addEventListener('keydown', function (e) {
      if (!open) return;
      if (e.key === 'Escape') { set(false); btn.focus(); return; }
      if (e.key !== 'Tab') return;
      var f = $$('a[href], button', header).filter(function (el) { return el.offsetParent !== null || el === btn; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && d.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && d.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    return { close: function () { set(false); }, isOpen: function () { return open; } };
  })();

  // ---------- 6. router and page transitions ----------
  var token = 0, veil = $('.veil'), veilText = veil ? $('.veil-t', veil) : null, veilTimer = 0, veilBusy = false;
  function viewById(id) { for (var i = 0; i < views.length; i++) if (views[i].id === id) return views[i]; return null; }
  function resolve(hash) {
    var id = String(hash || '').replace(/^#/, '');
    try { id = decodeURIComponent(id); } catch (e) {}
    var v = viewById(id);
    if (v) return { view: v, anchor: null };
    var el = id ? d.getElementById(id) : null;
    if (el && el.closest) { v = el.closest('main > .view'); if (v) return { view: v, anchor: el }; }
    return { view: views[0], anchor: null };
  }
  function setActive(id) {
    var on = null;
    navLinks.forEach(function (a) {
      var is = a.getAttribute('data-view') === id;
      a.classList.toggle('active', is);
      if (is) { a.setAttribute('aria-current', 'page'); on = a; } else a.removeAttribute('aria-current');
    });
    movePill(on);
    var link = $('#menu a[data-view="' + id + '"]');
    d.title = (id === 'home' || !link) ? NAME : link.textContent.trim() + ' | ' + NAME;
  }
  function focusHeading(view) {
    var h = view && $('.page-title, .hero-title', view); if (!h) return;
    try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); }
  }
  function flash(el) { if (!el || !el.classList.contains('interest')) return; el.classList.add('is-target'); setTimeout(function () { el.classList.remove('is-target'); }, 2200); }
  function labelOf(view) { var a = $('#menu a[data-view="' + view.id + '"]'); return a ? a.textContent.trim() : ''; }
  function announce(view) { try { d.dispatchEvent(new CustomEvent('rd-view', { detail: view.id })); } catch (e) {} }
  function settle(view, opts, same) {
    if (!same) { if (started) Reveal.arm(view); Net.view(view.id); announce(view); }
    if (opts.anchor) { scrollToEl(opts.anchor, same); flash(opts.anchor); }
    else if (same && !opts.fromHistory && !opts.keepScroll) scrollToY(0, true);
    if (opts.focus) focusHeading(view);
    requestScroll();
  }
  function show(view, opts) {
    opts = opts || {};
    if (!view) return;
    Menu.close();
    if (view === current) { if (!view.hidden) settle(view, opts, true); return; }   // hidden: its transition is still on the way
    var prev = current, my = ++token;
    current = view;
    setActive(view.id);
    function swap() {
      views.forEach(function (v) { if (v !== view) { v.hidden = true; v.classList.remove('is-shown'); } });
      Reveal.reset(view);
      view.classList.remove('is-shown');
      view.hidden = false;
      if (!opts.keepScroll) w.scrollTo(0, 0);
      updateHeader();
      void view.offsetWidth;                       // the stage art starts from its resting-out position
      view.classList.add('is-shown');
      settle(view, opts, false);
    }
    if (!prev || opts.instant || reduce || !veil) { swap(); return; }
    // the veil rises, the view changes behind it, the veil leaves upwards
    if (veilText) veilText.textContent = labelOf(view);
    if (!veilBusy || veil.classList.contains('out')) { veil.classList.remove('out'); veil.classList.remove('in'); void veil.offsetWidth; veil.classList.add('in'); }
    veilBusy = true;
    clearTimeout(veilTimer);
    veilTimer = setTimeout(function () {
      if (my !== token) return;
      swap();
      veilTimer = setTimeout(function () {
        if (my !== token) return;
        veil.classList.remove('in'); veil.classList.add('out');
        veilTimer = setTimeout(function () { if (my === token) { veil.classList.remove('out'); veilBusy = false; } }, 560);
      }, 110);
    }, 360);
  }
  function navigate(hash, opts) {
    opts = opts || {};
    var r = resolve(hash), h = '#' + (r.anchor ? r.anchor.id : r.view.id);
    if (location.hash !== h) { try { history.pushState(null, '', h); } catch (e) { try { location.hash = h; } catch (e2) {} } }
    show(r.view, { anchor: opts.anchor || r.anchor, focus: true });
  }
  function route() { var r = resolve(location.hash); show(r.view, { anchor: r.anchor, fromHistory: true }); }

  // ---------- 8. hero network (defined before the first view is shown) ----------
  // Five layers stand over the five labels at the foot of the hero: Computer Science, Artificial Intelligence,
  // Machine Learning, Deep Learning, Research. Signals travel left to right; one brighter signal at a time lights
  // the labels as it passes. The mesh runs in front of the photograph but stays below the face. It reacts to the
  // pointer, pauses when it is off screen or the tab is hidden, and is drawn once, still, when motion is reduced.
  var Net = safe('net', function () {
    var api = { start: function () {}, view: function () {} };
    var canvas = $('#heroNet'), pipe = $('#pipeline'), bandEl = $('#heroBand');
    if (!canvas || !hero || !pipe || !canvas.getContext) return api;
    var ctx = canvas.getContext('2d'); if (!ctx) return api;
    var TAU = Math.PI * 2, RGB = [[110, 168, 224], [91, 184, 216], [77, 198, 192], [82, 214, 168], [107, 232, 184]];
    var stages = $$('li', pipe), photo = $('.hero-photo', hero);
    var W = 0, H = 0, CH = 0, off = 0, dpr = 1, small = false, base = 0, ready = false;   // off: where the canvas starts inside the hero
    var cost = 0, skip = 1, tick = 0, frozen = false;                                       // frame-cost governor
    var layers = [], groups = [], signals = [], litT = [];
    var ptr = { x: -1e4, y: -1e4, on: false }, running = false, last = 0, clock = 0, spawnIn = .4, leadIn = .9, onHome = false, visible = true;

    function rnd(s) { var x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
    function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + clamp(a, 0, 1).toFixed(3) + ')'; }
    function mix(a, b, t) { return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)]; }
    function ease(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
    function bez(a, b, t) {
      var mx = (a.x + b.x) / 2, u = 1 - t, c0 = u * u * u, c1 = 3 * u * u * t, c2 = 3 * u * t * t, c3 = t * t * t;
      return { x: c0 * a.x + (c1 + c2) * mx + c3 * b.x, y: (c0 + c1) * a.y + (c2 + c3) * b.y };
    }

    function layout() {
      var r = hero.getBoundingClientRect(); if (r.width < 10 || r.height < 10 || stages.length < 2) return;
      W = r.width; H = r.height; small = W < 760;
      dpr = Math.min(w.devicePixelRatio || 1, small ? 1.5 : 2);
      var baseAbs = pipe.getBoundingClientRect().top - r.top;             // the rule the five labels hang from
      var band = bandEl ? bandEl.getBoundingClientRect().height : 110;
      var tall = small ? band * 1.12 : clamp(band * 2.5, 200, 340);         // height of the tallest (middle) layer
      var env = [.5, .82, 1, .8, .42], n = small ? [3, 4, 4, 4, 2] : (W < 1100 ? [4, 5, 6, 5, 3] : [4, 6, 7, 6, 3]);
      off = Math.max(0, Math.floor(baseAbs - (small ? 16 : 26) - tall - 54));
      CH = Math.ceil(baseAbs - off + 8);                                   // nothing is drawn below the rule
      base = baseAbs - off;
      var foot = base - (small ? 16 : 26);
      // where the face is (layout box, so a running entrance does not matter): layers under it are kept below the chin
      var face = null, pm = photo ? photo.offsetParent : null;
      if (photo && pm && getComputedStyle(photo).position === 'absolute') {   // side by side with the text (not the stacked layout)
        var fx = photo.offsetLeft + (pm !== hero ? pm.offsetLeft : 0), fy = photo.offsetTop + (pm !== hero ? pm.offsetTop : 0);
        var ih = Math.min(photo.offsetHeight, photo.offsetWidth * 726 / 520);       // the picture stands on the bottom edge of its box
        face = { l: fx + photo.offsetWidth * .1, r: fx + photo.offsetWidth * .9, chin: fy + photo.offsetHeight - ih * .2 - off };
      }
      canvas.style.height = CH + 'px'; canvas.style.transform = 'translate3d(0,' + off + 'px,0)';   // moved with a transform, so it is not a layout shift
      var cw = Math.round(W * dpr), ch = Math.round(CH * dpr);
      if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
      layers = stages.map(function (li, l) {
        var sr = li.getBoundingClientRect(), x = sr.left - r.left + sr.width / 2, h = tall * env[l], nodes = [];
        if (face && x > face.l && x < face.r) h = Math.max(34, Math.min(h, foot - face.chin - 18));
        for (var i = 0; i < n[l]; i++) {
          var t = n[l] === 1 ? .5 : i / (n[l] - 1);
          nodes.push({ l: l, bx: x + (rnd(l * 31 + i * 7) - .5) * (small ? 12 : 44), by: foot - h * (1 - t) + (rnd(l * 17 + i * 13 + 5) - .5) * (h / n[l]) * .45,
            x: 0, y: 0, ph: rnd(l * 11 + i * 3 + 1) * TAU, sp: .35 + rnd(l * 5 + i * 19 + 2) * .5, e: 0, f: 0, ring: 0, r: small ? 1.9 : 2.3 });
        }
        return { x: x, nodes: nodes };
      });
      groups = [];
      for (var l = 0; l < layers.length - 1; l++) {
        var g = [];
        layers[l].nodes.forEach(function (a) { layers[l + 1].nodes.forEach(function (b) { g.push({ a: a, b: b }); }); });
        groups.push(g);
      }
      signals = [];
      ready = true; frozen = false; cost = 0; skip = small ? 2 : 1;
      step(0); draw();
    }

    function light(l, hold) {
      var li = stages[l]; if (!li) return;
      li.classList.add('lit'); clearTimeout(litT[l]);
      litT[l] = setTimeout(function () { li.classList.remove('lit'); }, hold);
    }
    function spawn(lead) {
      var path = layers.map(function (L) { return L.nodes[(Math.random() * L.nodes.length) | 0]; });
      signals.push({ path: path, seg: 0, t: 0, v: lead ? 1.05 : .62 + Math.random() * .5, lead: lead });
      path[0].f = 1;
      if (lead) light(0, 640);
    }
    function step(dt) {
      clock += dt;
      var R = small ? 110 : 200, i, n, s, l;
      for (l = 0; l < layers.length; l++) {
        for (i = 0; i < layers[l].nodes.length; i++) {
          n = layers[l].nodes[i];
          var bx = n.bx + (reduce ? 0 : Math.cos(clock * n.sp * .7 + n.ph) * (small ? 1.5 : 3.5));
          var by = n.by + (reduce ? 0 : Math.sin(clock * n.sp + n.ph) * (small ? 2.5 : 5.5));
          var te = 0;
          if (ptr.on) { var dx = ptr.x - bx, dy = ptr.y - by, dist = Math.sqrt(dx * dx + dy * dy); if (dist < R) { te = 1 - dist / R; te *= te; } }
          n.e += (te - n.e) * Math.min(1, dt * 6);
          n.f = Math.max(0, n.f - dt * 1.5); n.ring = Math.max(0, n.ring - dt * .9);
          n.x = bx + (ptr.x - bx) * n.e * .09; n.y = by + (ptr.y - by) * n.e * .09;
        }
      }
      if (reduce || !dt) return;
      spawnIn -= dt; leadIn -= dt;
      var hasLead = false;
      for (i = signals.length - 1; i >= 0; i--) {
        s = signals[i]; s.t += dt * s.v;
        if (s.t >= 1) {
          s.t -= 1; s.seg++;
          n = s.path[s.seg]; n.f = 1;
          var end = s.seg >= s.path.length - 1;
          if (s.lead) { light(s.seg, end ? 1500 : 640); if (end) n.ring = 1; }
          if (end) { signals.splice(i, 1); if (s.lead) leadIn = 1.4; continue; }
        }
        if (s.lead) hasLead = true;
      }
      if (!hasLead && leadIn <= 0) { spawn(true); leadIn = 99; }
      if (spawnIn <= 0 && signals.length < (small ? 3 : 6)) { spawn(false); spawnIn = (small ? .8 : .45) + Math.random() * .8; }
    }
    function curve(k) { var mx = (k.a.x + k.b.x) / 2; ctx.moveTo(k.a.x, k.a.y); ctx.bezierCurveTo(mx, k.a.y, mx, k.b.y, k.b.x, k.b.y); }
    function draw() {
      if (!ready) return;
      var l, i, k, n, g, c;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, CH);
      ctx.lineCap = 'round'; ctx.lineWidth = 1;
      for (l = 0; l < groups.length; l++) {                              // the mesh: one path per pair of layers
        ctx.beginPath(); for (i = 0; i < groups[l].length; i++) curve(groups[l][i]);
        ctx.strokeStyle = rgba(mix(RGB[l], RGB[l + 1], .5), small ? .1 : .095); ctx.stroke();
        for (i = 0; i < groups[l].length; i++) {                         // links near the pointer
          k = groups[l][i]; g = Math.max(k.a.e, k.b.e);
          if (g > .03) { ctx.beginPath(); curve(k); ctx.strokeStyle = rgba(mix(RGB[l], RGB[l + 1], .5), g * .42); ctx.stroke(); }
        }
      }
      ctx.beginPath();                                                     // stems down to the labels
      for (l = 0; l < layers.length; l++) { n = layers[l].nodes[layers[l].nodes.length - 1]; ctx.moveTo(layers[l].x, base); ctx.lineTo(n.x, n.y); }
      ctx.strokeStyle = 'rgba(242,245,249,.16)'; ctx.stroke();
      for (i = 0; i < signals.length; i++) {                               // signals
        var s = signals[i], a = s.path[s.seg], b = s.path[s.seg + 1]; if (!b) continue;
        var te = ease(s.t), p; c = mix(RGB[a.l], RGB[b.l], s.t);
        if (s.lead) { ctx.beginPath(); curve({ a: a, b: b }); ctx.strokeStyle = rgba(c, .26); ctx.stroke(); }
        for (k = 10; k >= 0; k--) {
          var tt = te - k * .026; if (tt < 0) continue;
          p = bez(a, b, tt); var f = 1 - k / 11;
          ctx.beginPath(); ctx.arc(p.x, p.y, (s.lead ? 2.7 : 1.7) * (.35 + .65 * f), 0, TAU);
          ctx.fillStyle = rgba(c, (s.lead ? .95 : .55) * f * f); ctx.fill();
        }
        if (s.lead) { p = bez(a, b, te); ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, TAU); ctx.fillStyle = rgba(c, .12); ctx.fill(); }
      }
      for (l = 0; l < layers.length; l++) {                                // nodes
        c = RGB[l];
        for (i = 0; i < layers[l].nodes.length; i++) {
          n = layers[l].nodes[i]; g = Math.max(n.e, n.f);
          var rr = n.r + g * 1.7;
          if (g > .03) { ctx.beginPath(); ctx.arc(n.x, n.y, rr * 3.6, 0, TAU); ctx.fillStyle = rgba(c, .11 * g); ctx.fill(); }
          if (n.ring > .02) { ctx.beginPath(); ctx.arc(n.x, n.y, rr + (1 - n.ring) * 30, 0, TAU); ctx.strokeStyle = rgba(c, n.ring * .55); ctx.stroke(); }
          ctx.beginPath(); ctx.arc(n.x, n.y, rr, 0, TAU); ctx.fillStyle = rgba(c, .5 + .5 * g); ctx.fill();
        }
      }
    }                                                                      // the fade towards the headline is a CSS mask on the canvas
    // Draws every frame on a capable device, every second or third frame on a slow one, and stops moving
    // (one still drawing) when even that would hold up the page.
    function now() { return (w.performance && performance.now) ? performance.now() : Date.now(); }
    var gapT = 0, gapN = 0, gapSum = 0, lite = false;      // frame pacing: a device that cannot keep up loses the two idle animations
    function frame(t) {
      if (!running) return;
      raf(frame);
      if (!lite) {
        if (gapT && t - gapT < 200) { gapSum += t - gapT; gapN++; }
        gapT = t;
        if (gapN >= 150) { if (gapSum / gapN > 23) { lite = true; hero.classList.add('lite'); } gapN = 0; gapSum = 0; }
      }
      if (++tick % skip) return;
      var dt = Math.min(.1, Math.max(0, (t - last) / 1000)); last = t;
      var t0 = now(); step(dt); draw();
      cost += ((now() - t0) - cost) * .12;
      if (tick > 40) {
        if (cost > 34) { frozen = true; running = false; signals = []; stages.forEach(function (li) { li.classList.remove('lit'); }); step(0); draw(); }
        else skip = cost > 18 ? 3 : (cost > 8 || small ? 2 : 1);
      }
    }
    function play() {
      var should = started && onHome && visible && !d.hidden && ready && !reduce && !frozen;
      if (should && !running) { running = true; tick = 0; last = now(); gapT = 0; raf(frame); }
      else if (!should) running = false;
    }
    var pending = false;
    function relayout() { if (pending) return; pending = true; raf(function () { pending = false; if (onHome) { layout(); play(); } }); }
    if ('ResizeObserver' in w) new ResizeObserver(relayout).observe(hero); else w.addEventListener('resize', relayout);
    if ('IntersectionObserver' in w) new IntersectionObserver(function (en) { visible = en[en.length - 1].isIntersecting; play(); }, { threshold: 0 }).observe(hero);
    d.addEventListener('visibilitychange', play);
    if (d.fonts && d.fonts.ready && d.fonts.ready.then) d.fonts.ready.then(function () { relayout(); movePill(activeLink()); });
    w.addEventListener('load', relayout);

    if (fine && !reduce) {
      hero.addEventListener('pointermove', function (e) {
        if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
        var r = hero.getBoundingClientRect();
        var px = e.clientX - r.left, py = e.clientY - r.top;
        ptr.x = px; ptr.y = py - off; ptr.on = true;
      });
      hero.addEventListener('pointerleave', function () { ptr.on = false; });
    }

    api.start = function () { if (onHome) { layout(); play(); } };
    api.view = function (id) { onHome = id === 'home'; if (onHome) relayout(); else play(); };
    return api;
  }) || { start: function () {}, view: function () {} };

  // ---------- 6b. first view, links, history ----------
  safe('router', function () {
    if (!views.length) return;
    // legacy return address of the old form service: "?sent=1" lands on Contact
    if (/[?&]sent=1(&|$)/.test(location.search)) { try { history.replaceState(null, '', location.pathname + '#contact'); } catch (e) { location.hash = '#contact'; } }
    var first = resolve(location.hash);
    show(first.view, { instant: true, keepScroll: true });
    if (first.anchor) w.addEventListener('load', function () { scrollToEl(first.anchor, false); flash(first.anchor); });
    d.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null; if (!a) return;
      var href = a.getAttribute('href'); if (!href || href.length < 2) return;
      e.preventDefault();
      if (a.classList.contains('skip')) { focusHeading(current); return; }
      if (a.classList.contains('to-top')) { scrollToY(0, true); focusHeading(current); return; }
      var go = a.getAttribute('data-theme-go');
      if (go) { Filters.set({ type: 'all', theme: go }); navigate('#publications', { anchor: pubAnchor() }); return; }   // Research -> filtered list
      navigate(href);
    });
    w.addEventListener('popstate', route);
    w.addEventListener('hashchange', route);
    var rt = 0;
    w.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { movePill(activeLink()); var b = $('#menuBtn'); if (Menu.isOpen() && b && getComputedStyle(b).display === 'none') Menu.close(); }, 120);
    });
  });

  root.classList.add('rd-ready');     // from here on the router decides which view is shown

  // ---------- 7. intro (first visit of a browser session, never with reduced motion) ----------
  function start() {
    if (started) return;
    started = true;
    if (current) Reveal.arm(current);
    Net.start(); requestScroll();
  }
  safe('intro', function () {
    if (!root.classList.contains('intro-on')) { start(); return; }
    try { sessionStorage.setItem('rd-intro', '1'); } catch (e) {}
    setTimeout(function () {
      root.classList.add('intro-done'); start();
      setTimeout(function () { root.classList.remove('intro-on'); root.classList.remove('intro-done'); }, 1000);
    }, 1100);
  });
  if (!started) setTimeout(start, 3000);          // never leave the page waiting on the intro

  // ---------- 9. pointer effects (mouse and pen only) ----------
  safe('pointer', function () {
    if (!fine || reduce) return;
    $$('[data-magnetic]').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * .2).toFixed(1) + 'px,' + ((e.clientY - r.top - r.height / 2) * .28).toFixed(1) + 'px)';
      });
      el.addEventListener('pointerleave', function () { el.style.transform = ''; });
    });
    $$('[data-spot]').forEach(spot);
  });

  // The photograph or drawing on a stage drifts a little against the pointer and the scroll (never with reduced motion).
  safe('depth', function () {
    if (reduce) return;
    var target = null, tx = 0, ty = 0, queued = false;
    function art() { return current ? $('.hero-photo, .stage-art', current) : null; }
    function flush() { queued = false; if (!target) return; target.style.setProperty('--px', tx.toFixed(3)); target.style.setProperty('--py', ty.toFixed(3)); }
    function ask() { if (!queued) { queued = true; raf(flush); } }
    if (fine) d.addEventListener('pointermove', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      var st = stageOf(current); if (!st) return;
      var r = st.getBoundingClientRect();
      if (e.clientY > r.bottom) { if (target && (tx || ty)) { tx = ty = 0; ask(); } return; }
      target = art(); if (!target) return;
      tx = clamp((e.clientX - r.left) / Math.max(1, r.width) * 2 - 1, -1, 1); ty = clamp((e.clientY - r.top) / Math.max(1, r.height) * 2 - 1, -1, 1);
      ask();
    }, { passive: true });
    onScroll(function () {
      var a = art(), st = stageOf(current); if (!a || !st) return;
      var y = pageY(); if (y > st.offsetHeight + 60) return;
      a.style.setProperty('--sy', (y * .14).toFixed(1));
    });
  });

  // Each view ends with the way to the previous and the next one (same order as the menu).
  safe('pager', function () {
    var order = navLinks.map(function (a) { return { id: a.getAttribute('data-view'), label: a.textContent.trim() }; });
    views.forEach(function (v) {
      var host = $('.sheet > .page-body', v), i = -1;
      order.forEach(function (o, k) { if (o.id === v.id) i = k; });
      if (!host || i < 0) return;
      var prev = order[i - 1], next = order[i + 1]; if (!prev && !next) return;
      var nav = d.createElement('nav'); nav.className = 'pager'; nav.setAttribute('aria-label', 'Previous and next page');
      nav.innerHTML = (prev ? '<a class="pager-prev" href="#' + esc(prev.id) + '"><span class="pager-k">' + RIGHT + 'Previous</span><span class="pager-t">' + esc(prev.label) + '</span></a>' : '<span></span>') +
        (next ? '<a class="pager-next" href="#' + esc(next.id) + '"><span class="pager-k">Next' + RIGHT + '</span><span class="pager-t">' + esc(next.label) + '</span></a>' : '');
      host.appendChild(nav);
    });
  });

  // Certificates sit in strips that scroll sideways (Service, CV); two buttons move a strip for mouse and keyboard users.
  safe('strip', function () {
    $$('.certs').forEach(function (strip) {
      var block = strip.parentNode, label = block ? $('.block-label', block) : null;
      if (!label) return;
      var nav = d.createElement('div'); nav.className = 'strip-nav';
      nav.innerHTML = '<button type="button" aria-label="Show earlier certificates"><svg class="i" aria-hidden="true" focusable="false"><use href="#i-prev"/></svg></button>' +
        '<button type="button" aria-label="Show more certificates"><svg class="i" aria-hidden="true" focusable="false"><use href="#i-next"/></svg></button>';
      block.insertBefore(nav, strip); block.classList.add('has-strip');
      var b = $$('button', nav);
      function update() {
        var max = strip.scrollWidth - strip.clientWidth;
        nav.hidden = max < 8;
        b[0].disabled = strip.scrollLeft < 8; b[1].disabled = strip.scrollLeft > max - 8;
      }
      function move(dir) {
        var by = dir * Math.max(240, strip.clientWidth * .72);
        try { strip.scrollBy({ left: by, behavior: reduce ? 'auto' : 'smooth' }); } catch (e) { strip.scrollLeft += by; }
      }
      b[0].addEventListener('click', function () { move(-1); });
      b[1].addEventListener('click', function () { move(1); });
      strip.addEventListener('scroll', function () { raf(update); }, { passive: true });
      strip.addEventListener('load', function () { raf(update); }, true);          // images set the width of the strip as they arrive
      w.addEventListener('resize', function () { raf(update); });
      d.addEventListener('rd-view', function () { raf(update); });
      update();
    });
  });

  // Photographs on the stages of views that are not open yet are fetched once the first view has settled.
  safe('warm', function () {
    var run = function () { $$('.page-head img[loading="lazy"]').forEach(function (img) { img.loading = 'eager'; }); };
    w.addEventListener('load', function () { setTimeout(run, 2600); });
  });

  // ---------- 10. publication filters ----------
  var Filters = safe('filters', function () {
    var boxes = $$('.pub-layout .filters'), list = $('#pubsCurated'), status = $('#pubStatus'), empty = $('#pubEmpty');
    if (!boxes.length || !list) return null;
    var groups = $$('.pub-group', list), state = { type: 'all', theme: 'all' }, buttons = [];
    boxes.forEach(function (bx) { buttons = buttons.concat($$('button[data-value]', bx)); });
    function apply(animate) {
      var shown = 0;
      pubs.forEach(function (li) {
        var ok = (state.type === 'all' || li.getAttribute('data-type') === state.type) &&
          (state.theme === 'all' || (' ' + (li.getAttribute('data-themes') || '') + ' ').indexOf(' ' + state.theme + ' ') > -1);
        li.hidden = !ok; if (ok) shown++;
      });
      groups.forEach(function (g) {
        var n = $$('.pub:not([hidden])', g).length, c = $('.group-count', g); g.hidden = !n;
        if (c) { c.textContent = n; c.hidden = n === $$('.pub', g).length; }      // the full number of a group is on its type button: repeat it only when a filter has narrowed the group
      });
      if (empty) empty.hidden = shown > 0;
      buttons.forEach(function (b) {
        var on = state[b.parentNode.getAttribute('data-filter')] === b.getAttribute('data-value');
        b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      if (status) status.textContent = (state.type === 'all' && state.theme === 'all') ? '' :
        'Showing ' + shown + ' of ' + pubs.length + (state.theme !== 'all' && THEMES[state.theme] ? ' · ' + THEMES[state.theme] : '');
      if (animate && !reduce) {
        var vis = pubs.filter(function (li) { return !li.hidden; });
        vis.forEach(function (li, i) { li.classList.remove('in'); li.classList.remove('r-done'); li.style.setProperty('--d', (Math.min(i, 8) * 55) + 'ms'); });
        void list.offsetWidth;
        raf(function () { vis.forEach(function (li) { Reveal.show(li); }); });
      }
    }
    boxes.forEach(function (bx) {
      bx.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('button[data-value]') : null; if (!b) return;
        state[b.parentNode.getAttribute('data-filter')] = b.getAttribute('data-value'); apply(true);
        if (pageY() > docTop(pubAnchor()) + 40) scrollToEl(pubAnchor(), true);     // a new selection starts at the top of its list
      });
    });
    if (empty) {
      var reset = d.createElement('button'); reset.type = 'button'; reset.className = 'link-go pub-reset'; reset.innerHTML = '<span>Show all publications</span>';
      reset.addEventListener('click', function () { state.type = 'all'; state.theme = 'all'; apply(true); });
      empty.appendChild(d.createTextNode(' ')); empty.appendChild(reset);
    }
    apply(false);
    return { set: function (s) { if (s.type) state.type = s.type; if (s.theme) state.theme = s.theme; apply(false); },
      refresh: function () { if (state.type !== 'all' && !counts[state.type]) state.type = 'all'; apply(false); } };   // the lists have changed (section 11)
  }) || { set: function () {}, refresh: function () {} };

  // ---------- 11. Google Scholar panel, and records the registries have before the page does ----------
  // Reads data/scholar.json, which the scheduled GitHub Actions job (.github/workflows/scholar-sync.yml ->
  // scripts/sync_scholar.py) refreshes. Numbers are never computed or hard-coded here and are always shown
  // with the date they were read.
  // The same file carries the author's records at Crossref (articles, conference papers) and DataCite (datasets).
  // A record that the lists in index.html do not have yet is added to its list, an accepted paper that has been
  // published moves to its list with its DOI, and every count on the site follows. Nothing is added from a guess:
  // a registry record needs a DOI and the author's name, a Google Scholar record needs a venue that reads as a
  // journal or a conference, and everything else stays in the plain list at the end of Publications.
  // Switches on #pubsCurated: data-auto="off" adds nothing; data-auto-skip="doi | title | ..." leaves those out.
  safe('scholar', function () {
    var body = $('#scholarBody'), foot = $('#scholarFoot'), extra = $('#scholarExtra'), curated = $('#pubsCurated'), setList = $('#datasetList');
    if (!body || !foot) return;
    var PROFILE = 'https://scholar.google.com/citations?user=SSoTLJoAAAAJ';
    var GS = '<svg class="gs" viewBox="0 0 24 24" aria-hidden="true"><path d="M5.242 13.769L0 9.5 12 0l12 9.5-5.242 4.269C17.548 11.249 14.978 9.5 12 9.5c-2.977 0-5.548 1.748-6.758 4.269zM12 10a7 7 0 1 0 0 14 7 7 0 0 0 0-14z"/></svg>';
    var LINK = '<a href="' + PROFILE + '" target="_blank" rel="noopener">View Google Scholar Profile</a>';
    var ME = /\bdiptho\b/i;
    function fmtDate(iso, withTime) {
      if (!iso) return null; var dt = new Date(iso); if (isNaN(dt)) return null;
      var day = /^\d{4}-\d{2}-\d{2}$/.test(iso), o = { day: 'numeric', month: 'short', year: 'numeric' };
      if (day) o.timeZone = 'UTC';                                              // a plain date is that date everywhere
      var s = dt.toLocaleDateString('en-GB', o);
      if (withTime && !day) s += ', ' + dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
      return s;
    }
    function ageDays(iso) { if (!iso) return null; var dt = new Date(iso); if (isNaN(dt)) return null; return Math.floor((Date.now() - dt.getTime()) / 86400000); }
    function norm(t) { return String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
    function same(c, n) { return !!c && !!n && (c === n || (n.length > 30 && c.indexOf(n) === 0) || (c.length > 30 && n.indexOf(c) === 0)); }
    function near(a, b) {                                                       // one title in two wordings (a word changed in production)
      var A = a.split(' '), B = b.split(' '), inB = {}, all = {}, hit = 0;
      if (A.length < 6 || B.length < 6) return false;
      B.forEach(function (x) { inB[x] = 1; all[x] = 1; });
      A.forEach(function (x) { if (inB[x] === 1) { inB[x] = 2; hit++; } all[x] = 1; });
      return hit / Object.keys(all).length >= .8;                               // shared words / all words
    }
    function doiOf(el) {                                                        // the DOI an entry already links to
      var a = $$('a[href]', el), i, m, h;
      for (i = 0; i < a.length; i++) {
        h = a[i].getAttribute('href') || ''; try { h = decodeURIComponent(h); } catch (e) {}
        m = /(10\.\d{4,9}\/[^\s?#"<>]+)/.exec(h); if (m) return m[1].toLowerCase().replace(/[.,;]+$/, '');
      }
      return '';
    }
    function doiUrl(doi) { return 'https://doi.org/' + encodeURI(String(doi)); }
    function done() { body.removeAttribute('aria-busy'); try { d.dispatchEvent(new CustomEvent('scholar-rendered')); } catch (e) {} }
    function unavailable(msg) { body.innerHTML = '<p class="scholar-muted">' + msg + '</p>'; foot.innerHTML = GS + '<span class="src">Google Scholar</span>' + LINK; done(); }
    function badge(n) { var sp = d.createElement('span'); sp.className = 'cite'; sp.title = 'Google Scholar citations, as of the last synchronization'; sp.textContent = 'Cited by ' + n; return sp; }
    if (!w.fetch) { unavailable('Google Scholar metrics could not be loaded on this copy of the page.'); return; }

    // ----- the numbers and their dates -----
    function panel(data) {
      var m = data.metrics, since = m.recent_since ? 'since ' + m.recent_since : 'recent', i = 0;
      var conf = m.confirmed && fmtDate(m.confirmed.date) ? m.confirmed : null;   // a total the profile owner confirmed while automatic reads were refused
      var read = fmtDate(data.last_success, true), att = fmtDate(data.last_attempt), age = ageDays(conf ? conf.date : data.last_success);
      function tile(lab, v) {
        if (!v || v.all == null) return '';
        var again = v.recent == null || String(v.recent) === String(v.all);      // the same number twice says nothing: the recent value is shown only where it differs
        return '<div class="metric" data-r style="--i:' + (i++) + '"><b>' + esc(v.all) + '</b><span>' + lab + '</span>' + (again ? '' : '<small>' + esc(v.recent) + ' ' + esc(since) + '</small>') + '</div>';
      }
      var count = data.publication_count != null ? data.publication_count : (data.publications || []).length;
      body.innerHTML = '<div class="metric" data-r style="--i:' + (i++) + '"><b>' + esc(count) + '</b><span>Publications</span><small>indexed by Scholar</small></div>' +
        tile('Citations', m.citations) + tile('h-index', m.h_index) + tile('i10-index', m.i10_index);
      var f = GS + '<span class="src">Google Scholar</span>';
      f += conf ? '<span>Last updated: <b>' + fmtDate(conf.date) + '</b> (citation total confirmed by the profile owner)</span>'
        : '<span>Last updated: <b>' + (read || 'n/a') + '</b> (scheduled sync, not live)</span>';
      var kept = conf ? 'the other values are from ' + (fmtDate(data.last_success) || 'the last read') + '.' : 'showing the last verified values.';
      if (data.status === 'blocked' || data.status === 'failed') f += '<span class="warn">Latest check' + (att ? ' on ' + att : '') + ' was blocked by Google Scholar; ' + kept + '</span>';
      else if (data.status === 'error') f += '<span class="warn">Latest check' + (att ? ' on ' + att : '') + ' failed; ' + kept + '</span>';
      else if (conf) f += '<span>The other values are from ' + (fmtDate(data.last_success) || 'the last read') + '.</span>';
      if (age != null && age > 7) f += '<span class="warn">' + age + ' days old.</span>';
      foot.innerHTML = f + LINK;
      done();
      // Home: total citations, from the same file and with the same date
      var hc = $('#homeCitations'), hn = $('#homeCitationsNote'), when = fmtDate(conf ? conf.date : data.last_success);
      if (hc && m.citations && m.citations.all != null && !isNaN(parseInt(m.citations.all, 10))) {
        hc.setAttribute('data-to', parseInt(m.citations.all, 10)); Counter.ready(hc);
        if (hn) hn.textContent = 'Google Scholar' + (when ? ', ' + when : '');
      }
    }

    // ----- records: badges on the entries the page has, new entries for the records it does not have -----
    var DATAHOST = /\b(mendeley data|zenodo|figshare|dryad|dataverse|ieee dataport|kaggle|pangaea)\b/i;
    var PREPRINT = /\b(arxiv|biorxiv|medrxiv|techrxiv|chemrxiv|eartharxiv|engrxiv|ssrn|research square|researchgate|preprints?|authorea|qeios|osf)\b/i;
    function kindOf(venue) {                                                    // what a Google Scholar venue line says the record is
      var v = String(venue || '').trim();
      if (!v) return 'other';
      if (DATAHOST.test(v)) return 'dataset';
      if (PREPRINT.test(v) || /\b(thesis|dissertation|patent)\b/i.test(v)) return 'other';
      if (/\b(conference|proceedings|proc\.|symposium|workshop|congress)\b/i.test(v)) return 'conference';
      return /\D\s*,?\s+\d+(\s*\(\d+\))?(\s*,\s*[\w.\-–]+)?$/.test(v) ? 'journal' : 'other';   // "Name 14 (7), 430": a volume, perhaps an issue and pages
    }
    function listOf(kind) { return curated ? $('.pub-group[data-group="' + kind + '"] .pub-list', curated) : null; }
    function place(li, list, year, date) {                                      // newest first; a record that has just arrived is the newest of its year
      var items = $$('.pub', list), i, y;
      for (i = 0; i < items.length; i++) {
        if (items[i] === li) continue;
        y = parseInt(items[i].getAttribute('data-year'), 10) || 0;
        if (y < year || (y === year && (items[i].__date || '') <= date)) { list.insertBefore(li, items[i]); return; }
      }
      list.appendChild(li);
    }
    function people(list, me) {
      return (list || []).map(function (a, i) { a = esc(String(a).trim()); return (me === i || (me == null && ME.test(a))) ? '<b>' + a + '</b>' : a; }).filter(Boolean).join(', ');
    }
    function listAnd(a) { a = a.map(esc); return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
    function confName(name) { name = String(name || '').trim().replace(/^(19|20)\d\d\s+/, ''); return name && !/^proc/i.test(name) ? 'Proc. ' + name : name; }
    function venueOf(wk) {                                                      // the venue line of a Crossref record, in the form of the hand-written ones
      var conf = wk.kind === 'conference', name = conf ? confName(wk.container) : String(wk.container || '').trim(), pub = String(wk.publisher || '').trim(), parts = [];
      var s = name ? '<i>' + esc(name) + '</i>' : '';
      if (pub && name.toLowerCase().indexOf(pub.toLowerCase()) < 0) s += conf ? (s ? ', ' : '') + esc(pub) : (s ? ' ' : '') + '(' + esc(pub) + ')';
      if (wk.volume) parts.push('vol. ' + esc(wk.volume));
      if (wk.issue) parts.push('no. ' + esc(wk.issue));
      if (wk.article) parts.push('art. ' + esc(wk.article));
      else if (wk.pages) parts.push((/[-–]/.test(wk.pages) ? 'pp. ' : (conf ? 'p. ' : 'art. ')) + esc(String(wk.pages).replace(/\s*-+\s*/g, '–')));
      if (wk.year) parts.push(esc(wk.year));
      return s + (s && parts.length ? ', ' : '') + parts.join(', ') + '. <a class="pub-doi" href="' + esc(doiUrl(wk.doi)) + '" target="_blank" rel="noopener">doi:' + esc(wk.doi) + '</a>';
    }
    function entry(o) {
      var li = d.createElement('li');
      li.className = 'pub'; li.setAttribute('data-type', o.kind); li.setAttribute('data-year', o.year || ''); li.setAttribute('data-themes', '');
      li.setAttribute('data-auto', o.from.toLowerCase().replace(/[^a-z]+/g, '-')); li.setAttribute('data-r', '');
      li.innerHTML = '<span class="pub-year" aria-hidden="true">' + esc(o.year || '') + '</span><div class="pub-main"><h3 class="pub-title"><a href="' + esc(o.href) + '" target="_blank" rel="noopener">' + esc(o.title) + '</a></h3>' +
        (o.authors ? '<p class="pub-authors">' + o.authors + '.</p>' : '') + '<p class="pub-venue">' + o.venue + ' <span class="pub-auto">Added automatically from ' + esc(o.from) + '</span></p></div>';
      li.__date = o.date || '';
      return li;
    }

    function intake(data) {
      var reg = data.registry || {}, on = !curated || curated.getAttribute('data-auto') !== 'off', skip = {}, changed = false;
      String((curated && curated.getAttribute('data-auto-skip')) || '').split('|').forEach(function (x) { x = x.trim().toLowerCase(); if (x) { skip[x] = 1; skip[norm(x)] = 1; } });
      var cur = pubs.map(function (li) { var t = $('.pub-title', li); return { li: li, t: t, n: norm(t ? t.textContent : li.textContent), doi: doiOf(li), type: li.getAttribute('data-type') }; });
      var sets = $$('.dataset', setList || d.createElement('ul')).map(function (li) { var t = $('.ds-title', li); return { li: li, t: t, n: norm(t ? t.textContent : ''), doi: doiOf(li) }; });
      function findPub(n, doi) {
        var j;
        if (doi) for (j = 0; j < cur.length; j++) if (cur[j].doi === doi) return cur[j];
        for (j = 0; j < cur.length; j++) if (same(cur[j].n, n)) return cur[j];
        for (j = 0; j < cur.length; j++) if (near(cur[j].n, n)) return cur[j];
        return null;
      }
      function findSet(n, dois) {
        var j, k, c;
        for (j = 0; j < sets.length; j++) {
          c = sets[j];
          for (k = 0; c.doi && k < dois.length; k++) if (c.doi === dois[k] || c.doi.indexOf(dois[k] + '.') === 0 || dois[k].indexOf(c.doi + '.') === 0) return c;   // any version of the same deposit
          if (same(c.n, n) || near(c.n, n)) return c;
        }
        return null;
      }
      function add(li, kind, n, doi, year, date) {
        var list = listOf(kind); if (!list) return null;
        place(li, list, parseInt(year, 10) || 0, date || '');
        pubs.push(li);
        var c = { li: li, t: $('.pub-title', li), n: n, doi: doi, type: kind }; cur.push(c); changed = true;
        return c;
      }

      // 1. Crossref: articles and conference papers that carry the author's name
      if (on) (reg.works || []).forEach(function (wk) {
        if (!wk || !wk.title || !wk.doi || (wk.kind !== 'journal' && wk.kind !== 'conference')) return;
        var doi = String(wk.doi).toLowerCase(), n = norm(wk.title), hit;
        if (!n) return;
        if (skip[doi] || skip[n]) { skip[n] = 1; return; }                       // left out by the owner: its Scholar twin stays out too
        hit = findPub(n, doi);
        if (hit) {
          if (hit.type !== 'accepted' || !listOf(wk.kind)) return;
          // an accepted paper that is now published: it moves to its list with its DOI; the authors and research areas stay as written
          var y = parseInt(wk.year, 10) || parseInt(hit.li.getAttribute('data-year'), 10) || 0, yr = $('.pub-year', hit.li), v = $('.pub-venue', hit.li);
          hit.li.setAttribute('data-type', wk.kind); hit.li.setAttribute('data-year', y); hit.li.setAttribute('data-auto', 'published'); hit.li.__date = wk.date || '';
          if (yr) yr.textContent = y;
          if (hit.t && !$('a', hit.t)) hit.t.innerHTML = '<a href="' + esc(doiUrl(wk.doi)) + '" target="_blank" rel="noopener">' + hit.t.innerHTML + '</a>';
          if (v) v.innerHTML = venueOf(wk);
          place(hit.li, listOf(wk.kind), y, wk.date || '');
          hit.type = wk.kind; hit.doi = doi; changed = true;
          return;
        }
        add(entry({ kind: wk.kind, year: wk.year, date: wk.date, title: wk.title, href: doiUrl(wk.doi), authors: people(wk.authors, wk.me), venue: venueOf(wk), from: 'Crossref' }), wk.kind, n, doi, wk.year, wk.date);
      });

      // 2. DataCite: datasets (every version of a deposit is one dataset)
      if (on && setList) (reg.datasets || []).forEach(function (ds) {
        if (!ds || !ds.title || !ds.doi) return;
        var doi = String(ds.doi).toLowerCase(), n = norm(ds.title), dois = [doi].concat((ds.dois || []).map(function (x) { return String(x).toLowerCase(); }));
        if (!n) return;
        if (skip[doi] || skip[n]) { skip[n] = 1; return; }
        if (findSet(n, dois)) return;
        var li = d.createElement('li'), others = (ds.creators || []).filter(function (a, i) { return i !== ds.me && !ME.test(a); }), url = esc(doiUrl(ds.doi));
        li.className = 'dataset'; li.setAttribute('data-r', ''); li.setAttribute('data-spot', ''); li.setAttribute('data-auto', 'datacite');
        li.innerHTML = '<p class="ds-repo"><span class="ds-host">' + esc(ds.host || 'Dataset') + '</span><span>latest version</span>' + (ds.year ? '<span>' + esc(ds.year) + '</span>' : '') + '<span class="ds-auto">added automatically</span></p>' +
          '<h2 class="ds-title"><a href="' + url + '" target="_blank" rel="noopener">' + esc(ds.title) + '</a></h2>' + (others.length ? '<p class="ds-with">with ' + listAnd(others) + '</p>' : '') +
          '<p class="ds-doi"><a href="' + url + '" target="_blank" rel="noopener">doi:' + esc(ds.doi) + ' ' + ARROW + '</a></p>';
        setList.insertBefore(li, setList.firstChild); spot(li);
        sets.push({ li: li, t: $('.ds-title', li), n: n, doi: doi }); changed = true;
      });

      // 3. Google Scholar: citation badges; a record nothing above knows is added when its venue reads as a journal or a conference
      var rest = [];
      (data.publications || []).forEach(function (p) {
        var n = norm(p.title), hit, s, k; if (!n || skip[n]) return;
        hit = findPub(n, '');
        if (hit) { if (p.citations != null && hit.t && !$('.cite', hit.li)) hit.t.appendChild(badge(p.citations)); return; }
        s = findSet(n, []);
        if (s) { if (p.citations != null && s.t && !$('.cite', s.t)) s.t.appendChild(badge(p.citations)); return; }   // a dataset: it is on the Datasets view, with the same badge
        k = kindOf(p.venue);
        if (on && (k === 'journal' || k === 'conference')) {
          var m = /^(.*?\D)\s+(\d+(?:\s*\(\d+\))?(?:\s*,\s*.*)?)$/.exec(String(p.venue).trim()), name = (m ? m[1] : String(p.venue)).replace(/[\s,]+$/, '');
          var who = String(p.authors || '').split(/\s*,\s*/).filter(function (a) { return a && a !== '...' && a !== '…'; });
          var url = p.url && /^https:\/\/scholar\.google\.com\//.test(p.url) ? p.url : PROFILE;
          hit = add(entry({ kind: k, year: p.year, date: '', title: p.title, href: url, authors: people(who, null) + (/(\.\.\.|…)\s*$/.test(p.authors || '') ? ', et al' : ''),
            venue: '<i>' + esc(k === 'conference' ? confName(name) : name) + '</i>' + (m ? ' ' + esc(m[2]) : '') + (p.year ? ', ' + esc(p.year) : '') + '.', from: 'Google Scholar' }), k, n, '', p.year, '');
          if (hit) { if (p.citations != null && hit.t) hit.t.appendChild(badge(p.citations)); return; }
        }
        rest.push(p);
      });
      if (rest.length && extra) {
        extra.innerHTML = '<h2 class="group-label"><span>Also indexed by Google Scholar:</span><span class="group-count">' + rest.length + '</span></h2>' +
          '<p class="extra-note">Records from the Google Scholar profile that are not in the lists of this site, as of the last synchronization.</p><ul class="extra-list">' + rest.map(function (p) {
            var url = p.url && /^https:\/\/scholar\.google\.com\//.test(p.url) ? p.url : PROFILE;
            return '<li><a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(p.title) + '</a>' + (p.citations != null ? '<span class="cite">Cited by ' + esc(p.citations) + '</span>' : '') +
              '<span class="pub-meta">' + esc(p.authors || '') + (p.venue ? ' · ' + esc(p.venue) : '') + (p.year ? ' · ' + esc(p.year) : '') + '</span></li>';
          }).join('') + '</ul>';
      }
      if (changed) { recount(true); Filters.refresh(); Reveal.index(); }
    }

    fetch('data/scholar.json?v=' + Date.now(), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (data) {
      if (!data.metrics || data.status === 'never_synced') unavailable('Google Scholar metrics have not been synchronized yet; they appear here after the first successful scheduled run.');
      else panel(data);
      safe('records', function () { intake(data); });
      if (started && current) Reveal.arm(current);
      try { d.dispatchEvent(new CustomEvent('scholar-rendered')); } catch (e) {}
    }).catch(function () { unavailable('Google Scholar metrics could not be loaded on this copy of the page.'); });
  });

  // ---------- 12. contact form: Cloudflare Worker + D1 + Resend (unchanged service, same request and replies) ----------
  safe('form', function () {
    var form = $('#collabForm'); if (!form) return;
    var status = $('#cf-status'), btn = $('#cf-send'), label = $('span', btn), icon = $('svg', btn);
    var API = 'https://radiptho-contact.dipthobracucse.workers.dev/';
    var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    var MSG = { 'cf-name': 'Please enter your full name.', 'cf-email': 'Please enter a valid email address.', 'cf-message': 'Please write a message of at least 20 characters.' };
    var openedAt = Date.now(), sending = false;
    function val(id) { var el = d.getElementById(id); return el ? String(el.value || '') : ''; }
    function bad(id) {
      if (id === 'cf-name') return !val(id).trim();
      if (id === 'cf-email') return !EMAIL.test(val(id).trim());
      return val(id).trim().length < 20;
    }
    function setErr(id, msg) {
      var el = d.getElementById(id), hint = d.getElementById(id + '-err'); if (!el) return;
      el.classList.toggle('invalid', !!msg); el.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (hint) { hint.textContent = msg || ''; if (msg) el.setAttribute('aria-describedby', id + '-err'); else el.removeAttribute('aria-describedby'); }
    }
    function validate() {
      var first = null;
      Object.keys(MSG).forEach(function (id) { if (bad(id)) { setErr(id, MSG[id]); first = first || d.getElementById(id); } else setErr(id, ''); });
      if (first) first.focus();
      return !first;
    }
    Object.keys(MSG).forEach(function (id) {
      var el = d.getElementById(id); if (!el) return;
      el.addEventListener('input', function () { if (el.classList.contains('invalid')) setErr(id, bad(id) ? MSG[id] : ''); });
    });
    function show(kind, html) {
      status.hidden = false; status.className = 'status ' + kind; status.innerHTML = html;
      try { status.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' }); } catch (e) {}
    }
    function busy(on) {
      sending = on; btn.disabled = on; btn.setAttribute('aria-busy', on ? 'true' : 'false');
      label.textContent = on ? 'Sending…' : 'Send Message';
      var sp = $('.spin', btn);
      if (on) { if (icon) icon.style.display = 'none'; if (!sp) { sp = d.createElement('span'); sp.className = 'spin'; sp.setAttribute('aria-hidden', 'true'); btn.insertBefore(sp, label); } }
      else { if (icon) icon.style.display = ''; if (sp) sp.parentNode.removeChild(sp); }
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (sending) return;
      status.hidden = true;
      if (!validate()) return;
      if (form.elements._honey && form.elements._honey.value) { form.reset(); show('ok', 'Thank you. Your message has been received.'); return; }
      if (Date.now() - openedAt < 3000) { show('err', 'That was quick. Please check your message and click Send Message again.'); openedAt = Date.now() - 3000; return; }
      var replyTo = val('cf-email').trim();
      var payload = { name: val('cf-name').trim(), email: replyTo, institution: val('cf-org').trim(), purpose: val('cf-purpose'), message: val('cf-message').trim() };
      busy(true);
      var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
      var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 15000) : null;
      fetch(API, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(payload), signal: ctrl ? ctrl.signal : undefined })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (body) { return { ok: r.ok, body: body }; }); })
        .then(function (res) {
          if (timer) clearTimeout(timer);
          busy(false);
          if (res.ok && res.body && res.body.ok && res.body.stored) {
            form.reset(); openedAt = Date.now();
            if (res.body.emailed) show('ok', '<b>Thank you, your message has been sent.</b> I will reply to <b>' + esc(replyTo) + '</b> as soon as I can.');
            else show('ok', '<b>Thank you, your message has been securely received.</b> It has been saved and I will review it as soon as possible.');
            return;
          }
          show('err', 'Sorry, the message could not be received. Please try again.');
        })
        .catch(function () { if (timer) clearTimeout(timer); busy(false); show('err', 'Sorry, the connection timed out. Please try again.'); });
    });
  });

  // ---------- 13. viewer: a certificate or the first page of an article, enlarged ----------
  safe('lightbox', function () {
    var lb = $('#lightbox'), img = $('#lbImg'), cap = $('#lbCap'), closeBtn = $('#lbClose'), prev = $('#lbPrev'), next = $('#lbNext');
    var all = $$('.cert-open[data-lightbox], .paper-open[data-lightbox]'); if (!lb || !img || !all.length) return;
    var opens = all, idx = 0, from = null, isOpen = false, sx = null;
    function group(b) {                                   // one strip of certificates, or the paper fronts of the Publications stage, form one set
      var set = b.closest ? b.closest('.certs, .papers') : null;
      opens = set ? $$('[data-lightbox]', set) : all;
      var one = opens.length < 2; if (prev) prev.hidden = one; if (next) next.hidden = one;
      lb.setAttribute('aria-label', set && /(^|\s)papers(\s|$)/.test(set.className) ? 'Enlarged first page' : 'Enlarged certificate');
      return Math.max(0, opens.indexOf(b));
    }
    function item(i) {
      idx = (i + opens.length) % opens.length;
      var b = opens[idx], src = $('img', b), fc = $('figcaption, .paper-cap', b.parentNode), full = b.getAttribute('data-full');   // data-full: a larger file for the viewer
      img.style.opacity = '0';
      img.onload = function () { img.style.opacity = '1'; };
      img.alt = src ? src.alt : ''; img.src = full || (src ? (src.currentSrc || src.src) : '');
      if (cap) cap.innerHTML = fc ? fc.innerHTML : '';
      if (img.complete) img.style.opacity = '1';
    }
    function open(i, el) {
      from = el || d.activeElement; item(i);
      lb.hidden = false; root.classList.add('lb-lock'); void lb.offsetWidth; lb.classList.add('open'); isOpen = true;
      if (closeBtn) closeBtn.focus();
    }
    function close() {
      if (!isOpen) return;
      isOpen = false; lb.classList.remove('open'); root.classList.remove('lb-lock');
      setTimeout(function () { if (!isOpen) { lb.hidden = true; img.removeAttribute('src'); } }, reduce ? 0 : 360);
      if (from && from.focus) from.focus();
    }
    all.forEach(function (b) { b.addEventListener('click', function () { open(group(b), b); }); });
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (prev) prev.addEventListener('click', function () { item(idx - 1); });
    if (next) next.addEventListener('click', function () { item(idx + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    lb.addEventListener('touchstart', function (e) { sx = e.touches && e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (sx == null || !e.changedTouches || !e.changedTouches.length) return;
      var dx = e.changedTouches[0].clientX - sx; sx = null;
      if (w.visualViewport && w.visualViewport.scale > 1.02) return;   // pinched in to read the page: a drag moves the picture, it does not turn to the next one
      if (Math.abs(dx) > 48 && opens.length > 1) item(idx + (dx < 0 ? 1 : -1));
    }, { passive: true });
    d.addEventListener('keydown', function (e) {
      if (!isOpen) return;
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'ArrowLeft') { item(idx - 1); return; }
      if (e.key === 'ArrowRight') { item(idx + 1); return; }
      if (e.key !== 'Tab') return;
      var f = $$('button, a[href]', lb).filter(function (el) { return !el.hidden && el.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && d.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && d.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!lb.contains(d.activeElement)) { e.preventDefault(); first.focus(); }
    });
  });
})();
