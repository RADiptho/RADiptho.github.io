/* Md. Rakib Ahammed Diptho — site behaviour (2026-11)
   1. navigation: compact translucent bar once the page has scrolled, active link follows the section in view
   2. scroll reveal: content blocks fade / rise into place as they enter the viewport (IntersectionObserver)
   3. Home banner: the light layer follows the pointer a few pixels on desktop (the image itself never moves)
   4. contact form (FormSubmit, AJAX with a normal-post fallback), Google Scholar panel, certificate lightbox
   Everything degrades: without JavaScript all content is visible, the banners are plain images and the form posts
   normally; with prefers-reduced-motion nothing animates. */
(function () {
  var d = document, root = d.documentElement;
  root.classList.add('js');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var nav = d.getElementById('siteNav'), menu = d.getElementById('menu'), menuBtn = d.getElementById('menuBtn');
  var links = Array.prototype.slice.call(menu.querySelectorAll('a[data-view]'));
  var sections = Array.prototype.slice.call(d.querySelectorAll('main > section.view'));

  // Returning from the form service after a normal (non-AJAX) submission: FormSubmit redirects to
  // "<site>/?sent=1" only after it has accepted the message. Show Contact and report it, then tidy the URL.
  window.__formReturned = /[?&]sent=1(&|$)/.test(location.search);
  if (window.__formReturned) { try { history.replaceState(null, '', location.pathname + '#contact'); } catch (e) { location.hash = '#contact'; } }

  // ---- navigation: one selected section at a time; original section contents/effects stay untouched ----
  var navH = 62, ticking = false, currentView = 'home';
  function measure() { navH = nav.offsetHeight || navH; }
  function setActive(id) {
    links.forEach(function (a) { var on = a.getAttribute('data-view') === id; a.classList.toggle('active', on); if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
  }
  function validView(id) {
    for (var i = 0; i < sections.length; i++) if (sections[i].id === id) return id;
    return 'home';
  }
  function showView(id, keepHash) {
    id = validView(id);
    currentView = id;
    sections.forEach(function (section) {
      var on = section.id === id;
      section.hidden = !on;
      section.setAttribute('aria-hidden', on ? 'false' : 'true');
    });
    setActive(id);
    closeMenu();
    window.scrollTo(0, 0);
    if (!keepHash && location.hash !== '#' + id) location.hash = id;
    request();
  }
  function route() { showView((location.hash || '#home').slice(1), true); }
  function update() {
    ticking = false;
    var y = window.scrollY || window.pageYOffset || 0;
    nav.classList.toggle('scrolled', currentView !== 'home' || y > 24);
    setActive(currentView);
  }
  function request() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', function () { measure(); request(); }, { passive: true });
  window.addEventListener('hashchange', route);
  measure();

  function closeMenu() { menu.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); menuBtn.textContent = 'Menu'; }
  menuBtn.addEventListener('click', function () {
    var open = menu.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    menuBtn.textContent = open ? 'Close' : 'Menu';
  });
  links.forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('data-view');
      if (location.hash === '#' + id) { e.preventDefault(); showView(id, true); }
      else closeMenu();
    });
  });
  d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menu.classList.contains('open')) closeMenu(); });

  route();
  window.addEventListener('load', function () { measure(); route(); });

  // ---- scroll reveal ----------------------------------------------------------------------------
  (function () {
    var sel = ['.page > .note', '.page .label', '.page > .cv-link', '.page > .scholar', '.list > li', '.home-grid .photo', '.home-grid .links > a', '.about > *', '.certs > figure', '.contact-grid > *', '.metrics > .metric'];
    var els = Array.prototype.slice.call(d.querySelectorAll(sel.join(',')));
    if (!els.length) return;
    if (reduce || !('IntersectionObserver' in window)) { return; } // nothing to hide: the CSS only hides .rv elements
    var counts = [];
    els.forEach(function (el) {
      var p = el.parentNode, n = 0;
      for (var i = 0; i < counts.length; i++) { if (counts[i].p === p) { n = ++counts[i].n; break; } }
      if (!n) counts.push({ p: p, n: 0 });
      el.classList.add('rv');
      if (el.tagName === 'IMG' || el.tagName === 'FIGURE') el.classList.add('rv-img');
      el.style.setProperty('--d', (Math.min(n, 7) * 70) + 'ms');
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
    els.forEach(function (el) { io.observe(el); });
    // safety: whatever is still hidden after a few seconds in a viewport that never reported it is shown anyway
    setTimeout(function () { els.forEach(function (el) { if (!el.classList.contains('in')) { var r = el.getBoundingClientRect(); if (r.bottom > 0 && r.top < window.innerHeight) el.classList.add('in'); } }); }, 2500);
    window.addEventListener('pagehide', function () { els.forEach(function (el) { el.classList.add('in'); }); });
  })();

  // ---- Home banner: the light layer drifts with the pointer (desktop, fine pointer, motion allowed) ----
  (function () {
    if (reduce || !window.matchMedia || !window.matchMedia('(pointer: fine)').matches) return;
    var banner = d.querySelector('#home .banner'), fx = banner && banner.querySelector('.fx');
    if (!fx) return;
    var tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    function step() { raf = 0; cx += (tx - cx) * 0.12; cy += (ty - cy) * 0.12; fx.style.transform = 'translate3d(' + cx.toFixed(2) + 'px,' + cy.toFixed(2) + 'px,0)'; if (Math.abs(tx - cx) > 0.05 || Math.abs(ty - cy) > 0.05) raf = requestAnimationFrame(step); }
    banner.addEventListener('pointermove', function (e) { var r = banner.getBoundingClientRect(); tx = ((e.clientX - r.left) / r.width - 0.5) * 8; ty = ((e.clientY - r.top) / r.height - 0.5) * 5; if (!raf) raf = requestAnimationFrame(step); });
    banner.addEventListener('pointerleave', function () { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(step); });
  })();

  // ---- collaboration form — Cloudflare Worker + D1 + Resend ---------------------------------
  (function () {
    var form = d.getElementById('collabForm'); if (!form) return;
    var status = d.getElementById('cf-status'), btn = d.getElementById('cf-send'), label = btn.querySelector('span'), icon = btn.querySelector('svg');
    var API = 'https://radiptho-contact.dipthobracucse.workers.dev/';
    var openedAt = Date.now(), sending = false;
    var fields = { name: ['cf-name', 'Please enter your full name.'], email: ['cf-email', 'Please enter a valid email address.'], message: ['cf-message', 'Please write a message of at least 20 characters.'] };
    function esc(t) { return String(t == null ? '' : t).replace(/[&<>\"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[ch]; }); }
    function setErr(id, msg) { var el = d.getElementById(id), hint = d.getElementById(id + '-err'); el.classList.toggle('invalid', !!msg); el.setAttribute('aria-invalid', msg ? 'true' : 'false'); if (hint) hint.textContent = msg || ''; }
    function validate() {
      var ok = true, first = null;
      var name = d.getElementById('cf-name'), email = d.getElementById('cf-email'), msg = d.getElementById('cf-message');
      if (!name.value.trim()) { setErr('cf-name', fields.name[1]); ok = false; first = first || name; } else setErr('cf-name', '');
      if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/.test(email.value.trim())) { setErr('cf-email', fields.email[1]); ok = false; first = first || email; } else setErr('cf-email', '');
      if (msg.value.trim().length < 20) { setErr('cf-message', fields.message[1]); ok = false; first = first || msg; } else setErr('cf-message', '');
      if (first) first.focus(); return ok;
    }
    ['cf-name', 'cf-email', 'cf-message'].forEach(function (id) { d.getElementById(id).addEventListener('input', function () { if (this.classList.contains('invalid')) validate(); }); });
    function show(kind, html) { status.hidden = false; status.className = 'status ' + kind; status.innerHTML = html; status.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' }); }
    function busy(on) { sending = on; btn.disabled = on; btn.setAttribute('aria-busy', on ? 'true' : 'false'); label.textContent = on ? 'Sending…' : 'Send Message'; if (on) { icon.hidden = true; if (!btn.querySelector('.spin')) { var sp = d.createElement('span'); sp.className = 'spin'; sp.setAttribute('aria-hidden', 'true'); btn.insertBefore(sp, label); } } else { icon.hidden = false; var s = btn.querySelector('.spin'); if (s) s.remove(); } }
    form.addEventListener('submit', function (e) {
      e.preventDefault(); if (sending) return; status.hidden = true; if (!validate()) return;
      if (form.elements._honey && form.elements._honey.value) { form.reset(); show('ok', 'Thank you. Your message has been received.'); return; }
      if (Date.now() - openedAt < 3000) { show('err', 'That was quick. Please check your message and click Send Message again.'); openedAt = Date.now() - 3000; return; }
      var replyTo = d.getElementById('cf-email').value.trim();
      var payload = { name: d.getElementById('cf-name').value.trim(), email: replyTo, institution: (d.getElementById('cf-institution') || {}).value || '', purpose: (d.getElementById('cf-purpose') || {}).value || '', message: d.getElementById('cf-message').value.trim() };
      busy(true);
      var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
      var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 15000) : null;
      fetch(API, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(payload), signal: ctrl ? ctrl.signal : undefined })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (body) { return { ok: r.ok, status: r.status, body: body }; }); })
        .then(function (res) {
          if (timer) clearTimeout(timer); busy(false);
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
  })();

  // ---- Google Scholar tracker: reads data/scholar.json, which the scheduled GitHub Actions job
  // (.github/workflows/scholar-sync.yml -> scripts/sync_scholar.py) refreshes twice a day.
  // Numbers are never computed or hard-coded here and are always shown with the date they were read.
  (function () {
    var body = d.getElementById('scholarBody'), foot = d.getElementById('scholarFoot'), extra = d.getElementById('scholarExtra');
    if (!body) return;
    var PROFILE = 'https://scholar.google.com/citations?user=SSoTLJoAAAAJ';
    var GS = '<svg class="gs" viewBox="0 0 24 24" aria-hidden="true"><path d="M5.242 13.769L0 9.5 12 0l12 9.5-5.242 4.269C17.548 11.249 14.978 9.5 12 9.5c-2.977 0-5.548 1.748-6.758 4.269zM12 10a7 7 0 1 0 0 14 7 7 0 0 0 0-14z"/></svg>';
    var LINK = '<a href="' + PROFILE + '" target="_blank" rel="noopener">View Google Scholar Profile</a>';
    function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function fmtDate(iso, withTime) { if (!iso) return null; var dt = new Date(iso); if (isNaN(dt)) return null; var s = dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); if (withTime) s += ', ' + dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }); return s; }
    function ageDays(iso) { if (!iso) return null; var dt = new Date(iso); if (isNaN(dt)) return null; return Math.floor((Date.now() - dt.getTime()) / 86400000); }
    function norm(t) { return String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
    function done() { body.removeAttribute('aria-busy'); try { d.dispatchEvent(new CustomEvent('scholar-rendered')); } catch (e) {} }
    function unavailable(msg) { body.innerHTML = '<p class="scholar-muted">' + msg + '</p>'; foot.innerHTML = GS + '<span class="src">Google Scholar</span>' + LINK; done(); }
    fetch('data/scholar.json?v=' + Date.now(), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (data) {
      var ok = fmtDate(data.last_success, true), att = fmtDate(data.last_attempt), age = ageDays(data.last_success);
      if (!data.metrics || data.status === 'never_synced') { unavailable('Google Scholar metrics have not been synchronized yet; they appear here after the first successful scheduled run.'); return; }
      var m = data.metrics, since = m.recent_since ? 'since ' + m.recent_since : 'recent';
      function tile(lab, v) { if (!v || v.all == null) return ''; return '<div class="metric"><b>' + esc(v.all) + '</b><span>' + lab + '</span>' + (v.recent != null ? '<small>' + esc(v.recent) + ' ' + esc(since) + '</small>' : '') + '</div>'; }
      var pubs = data.publication_count != null ? data.publication_count : (data.publications || []).length;
      body.innerHTML = '<div class="metric"><b>' + esc(pubs) + '</b><span>Publications</span><small>indexed by Scholar</small></div>' + tile('Citations', m.citations) + tile('h-index', m.h_index) + tile('i10-index', m.i10_index);
      var f = GS + '<span class="src">Google Scholar</span>';
      f += '<span>Last updated: <b>' + (ok || 'n/a') + '</b> (scheduled sync, not live)</span>';
      if (data.status === 'blocked' || data.status === 'failed') f += '<span class="warn">Latest check' + (att ? ' on ' + att : '') + ' was blocked by Google Scholar; showing the last verified values.</span>';
      else if (data.status === 'error') f += '<span class="warn">Latest check' + (att ? ' on ' + att : '') + ' failed; showing the last verified values.</span>';
      if (age != null && age > 7) f += '<span class="warn">' + age + ' days old.</span>';
      f += LINK;
      foot.innerHTML = f; done();
      // match Scholar records to the curated list: add citation badges; list the rest
      var curated = Array.prototype.slice.call(d.querySelectorAll('#pubsCurated ol.list li, #pubsCurated ul.list li'));
      var cur = curated.map(function (li) { var a = li.querySelector('a'); return { li: li, n: norm(a ? a.textContent : li.textContent) }; });
      var rest = [];
      (data.publications || []).forEach(function (p) {
        var n = norm(p.title); if (!n) return;
        var hit = null;
        for (var i = 0; i < cur.length; i++) { var c = cur[i].n; if (!c) continue; if (c === n || (n.length > 30 && c.indexOf(n) === 0) || (c.length > 30 && n.indexOf(c) === 0)) { hit = cur[i]; break; } }
        if (hit) {
          if (p.citations != null && !hit.li.querySelector('.cite')) {
            var sp = d.createElement('span'); sp.className = 'cite'; sp.title = 'Google Scholar citations, as of the last synchronization'; sp.textContent = 'Cited by ' + p.citations;
            var anchor = hit.li.querySelector('a'); if (anchor && anchor.nextSibling) hit.li.insertBefore(sp, anchor.nextSibling); else hit.li.appendChild(sp);
          }
        } else rest.push(p);
      });
      if (rest.length) {
        extra.innerHTML = '<p class="label">Also indexed by Google Scholar:</p><p class="pub-meta">Records from the Google Scholar profile that are not in the curated lists above, as of the last synchronization.</p><ul class="list">' + rest.map(function (p) {
          var url = p.url && /^https:\/\/scholar\.google\.com\//.test(p.url) ? p.url : PROFILE;
          return '<li><a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(p.title) + '</a>' + (p.citations != null ? '<span class="cite">Cited by ' + esc(p.citations) + '</span>' : '') + '<br><span class="pub-meta">' + esc(p.authors || '') + (p.venue ? ' · ' + esc(p.venue) : '') + (p.year ? ' · ' + esc(p.year) : '') + '</span></li>';
        }).join('') + '</ul>';
      }
      try { d.dispatchEvent(new CustomEvent('scholar-rendered')); } catch (e) {}
    }).catch(function () { unavailable('Google Scholar metrics could not be loaded on this copy of the page.'); });
  })();

  // ---- certificate lightbox -------------------------------------------------------------------
  var lb = d.getElementById('lightbox'), lbImg = d.getElementById('lbImg');
  function closeLb() { lb.classList.remove('open'); lbImg.src = ''; d.body.style.overflow = ''; }
  Array.prototype.forEach.call(d.querySelectorAll('.certs img'), function (img) {
    img.addEventListener('click', function () { lbImg.src = img.src; lbImg.alt = img.alt; lb.classList.add('open'); d.body.style.overflow = 'hidden'; });
  });
  d.getElementById('lbClose').addEventListener('click', closeLb);
  lb.addEventListener('click', function (e) { if (e.target === lb) closeLb(); });
  d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && lb.classList.contains('open')) closeLb(); });
})();
