// Shared site extras: announcement bar, Samedi/Dimanche weekend theme,
// loading animation, and smooth page transitions. Fails silently.
(function () {
  // ── Loading veil (logo pulse) ──────────────────────────
  var veil = document.createElement('div');
  veil.className = 'sd-veil';
  veil.innerHTML = '<img src="img/newlogo.png" alt="" class="sd-veil-logo">';
  document.documentElement.appendChild(veil);
  window.addEventListener('load', function () {
    setTimeout(function () { veil.classList.add('sd-veil-hidden'); }, 250);
    setTimeout(function () { veil.remove(); }, 1200);
  });
  // Safety: never trap the user behind the veil
  setTimeout(function () { veil.classList.add('sd-veil-hidden'); }, 3000);

  // ── Page transitions on internal links ─────────────────
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:') || a.target === '_blank') return;
    e.preventDefault();
    document.body.classList.add('sd-leaving');
    setTimeout(function () { window.location.href = href; }, 320);
  });

  // ── Weekend theme: Samedi (Sat) / Dimanche (Sun) ────────
  function applyWeekendTheme(enabled) {
    if (!enabled) return;
    var day = new Date().getDay();
    if (day === 6) document.body.classList.add('theme-samedi');
    else if (day === 0) document.body.classList.add('theme-dimanche');
  }

  // ── Announcement bar ────────────────────────────────────
  function showAnnouncement(text) {
    if (!text) return;
    var bar = document.createElement('div');
    bar.className = 'sd-announce';
    bar.innerHTML = '<span class="sd-announce-text"></span>';
    bar.querySelector('.sd-announce-text').textContent = text;
    document.body.insertBefore(bar, document.body.firstChild);
    document.body.classList.add('has-announce');
  }

  // ── Homepage: huge drop clock + tab visibility ─────────
  function navItem(href, label, sub, idx) {
    var a = document.createElement('a');
    a.href = href;
    a.className = 'landing-nav-item';
    a.style.setProperty('--nav-delay', (0.05 + idx * 0.08) + 's');
    a.innerHTML = '<span class="landing-nav-label"></span><span class="landing-nav-sub"></span><span class="landing-nav-line"></span>';
    a.querySelector('.landing-nav-label').textContent = label;
    a.querySelector('.landing-nav-sub').textContent = sub;
    return a;
  }

  function applyHomepage(s) {
    var nav = document.querySelector('.landing-nav');
    if (!nav) return; // not the homepage

    // Links — managed from the admin "Homepage" tab
    var links = Array.isArray(s.homepageLinks) ? s.homepageLinks : [
      { url: 'watches.html', label: 'Watches', sublabel: 'Automatic \u00b7 Limited', enabled: s.tabWatchesEnabled !== false },
      { url: 'bud.html', label: 'Bud', sublabel: 'The Bud Collection', enabled: s.tabBudEnabled !== false },
    ];
    // Static fallback links are already in the HTML; only rebuild once
    // settings have actually arrived, with a short stagger (page is
    // already painted by now, so long delays would feel broken).
    nav.innerHTML = '';
    var i = 0;
    links.forEach(function (l) {
      if (!l || l.enabled === false || !l.url || !l.label) return;
      nav.appendChild(navItem(l.url, l.label, l.sublabel || '', i));
      i++;
    });
    // Note: the drop countdown intentionally no longer renders on the
    // homepage — it lives only on pages controlled from the admin panel
    // (e.g. the watch page via its drop date setting).
  }

  document.addEventListener('DOMContentLoaded', function () {
    fetch('/api/site-settings')
      .then(function (r) { return r.json(); })
      .then(function (s) {
        window.__siteSettings = s;
        document.dispatchEvent(new CustomEvent('sd:settings', { detail: s }));
        applyWeekendTheme(s.weekendThemeEnabled !== false);
        if (s.announcementEnabled && s.announcementText) showAnnouncement(s.announcementText);
        applyHomepage(s);
      })
      .catch(function () {});
  });
})();
