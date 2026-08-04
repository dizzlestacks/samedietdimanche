// Loads editable watch-page settings and, when enabled, shows shop items
// instead of the waitlist form. Falls back silently to the static page.
(function () {
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function formatPrice(amount, currency) {
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'usd' }).format(amount / 100);
    } catch (e) {
      return '$' + (amount / 100).toFixed(2);
    }
  }

  function applySettings(settings) {
    var headline = document.getElementById('wl-headline');
    var sub = document.getElementById('wl-sub');
    if (headline && settings.watchHeadline) headline.textContent = settings.watchHeadline;
    if (sub && settings.watchSub) sub.textContent = settings.watchSub;

    var specsWrap = document.getElementById('wl-specs');
    if (specsWrap && Array.isArray(settings.watchSpecs) && settings.watchSpecs.length > 0) {
      specsWrap.innerHTML = settings.watchSpecs.map(function (s) {
        return '<div class="wl-spec-row">' +
          '<span class="wl-spec-label">' + esc(s.label) + '</span>' +
          '<span class="wl-spec-dot"></span>' +
          '<span class="wl-spec-value">' + esc(s.value) + '</span>' +
        '</div>';
      }).join('');
    }
  }

  function renderShop(products) {
    var shop = document.getElementById('watch-shop');
    var form = document.getElementById('waitlist-form');
    var follow = document.getElementById('wl-follow-reveal');
    if (!shop) return;

    shop.innerHTML = products.map(function (p, i) {
      var price = p.prices && p.prices[0];
      if (!price) return '';
      var img = (p.images && p.images[0]) || '';
      return '<div class="watch-shop-card">' +
        (img ? '<img class="watch-shop-img" src="' + esc(img) + '" alt="' + esc(p.name) + '">' : '') +
        '<div class="watch-shop-info">' +
          '<p class="watch-shop-name">' + esc(p.name) + '</p>' +
          (p.description ? '<p class="watch-shop-desc">' + esc(p.description) + '</p>' : '') +
          '<p class="watch-shop-price">' + formatPrice(price.unit_amount, price.currency) + '</p>' +
          '<button class="wl-btn watch-shop-buy" data-price-id="' + esc(price.id) + '">Purchase</button>' +
        '</div>' +
      '</div>';
    }).join('');

    shop.querySelectorAll('.watch-shop-buy').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        btn.disabled = true;
        var original = btn.textContent;
        btn.textContent = 'Redirecting...';
        try {
          var res = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ priceId: btn.getAttribute('data-price-id'), quantity: 1 }),
          });
          var data = await res.json();
          if (data.url) {
            window.location.href = data.url;
            return;
          }
        } catch (e) {}
        btn.disabled = false;
        btn.textContent = original;
        alert('Checkout is unavailable right now. Please try again.');
      });
    });

    if (form) form.style.display = 'none';
    if (follow) follow.style.display = 'none';
    shop.style.display = '';
  }

  document.addEventListener('DOMContentLoaded', async function () {
    var settings;
    try {
      settings = await (await fetch('/api/site-settings')).json();
    } catch (e) {
      return; // keep static page
    }
    applySettings(settings);

    if (settings.watchesMode === 'shop') {
      try {
        var data = await (await fetch('/api/products')).json();
        var products = (data.data || []).filter(function (p) { return p.prices && p.prices[0]; });
        if (data.stripeEnabled !== false && products.length > 0) {
          renderShop(products);
        }
        // If the shop isn't ready (no Stripe / no products), the waitlist stays.
      } catch (e) {}
    }
  });
})();
