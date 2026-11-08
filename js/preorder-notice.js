/* Update38 — disclosure only. Access, prices and checkout remain server-controlled.
   On shared product/cart pages set data-preorder-scope="shop", "watches" or "cart"
   on #preorder-notice (or on main) to match the items being displayed. */
(function () {
  'use strict';
  function mount() {
    var element = document.getElementById('preorder-notice');
    if (!element) {
      var main = document.querySelector('main');
      if (!main) return null;
      element = document.createElement('aside'); element.id = 'preorder-notice'; element.hidden = true;
      element.setAttribute('role', 'status'); element.setAttribute('aria-live', 'polite');
      if (main.dataset.preorderScope) element.dataset.preorderScope = main.dataset.preorderScope;
      main.insertBefore(element, main.firstChild);
    }
    return element;
  }
  function render(settings) {
    var element = mount(); if (!element) return;
    var path = location.pathname.split('/').pop();
    var scope = element.dataset.preorderScope ||
      (path === 'shop.html' || path === 'clothing.html' ? 'shop' : path === 'watches.html' ? 'watches' : path === 'cart.html' ? 'cart' : '');
    // The cart already discloses preorders on the actual quoted lines and at
    // checkout. A global banner wrongly labels empty/regular-only carts.
    var active = scope === 'shop' ? settings.preorderShopActive === true :
      scope === 'watches' ? settings.preorderWatchesActive === true :
      false;
    element.textContent = '';
    function line(text, cls) {
      var p = document.createElement('p'); p.textContent = text; if (cls) p.className = cls; element.appendChild(p);
    }
    if (settings.preorderAccessInvalid === true) {
      line('This private preorder link is invalid, expired or revoked. Request a new link to access private preorders.', 'preorder-notice-warning');
    }
    if (active) {
      line(settings.publicWatchPreorder && scope !== 'shop' ? 'Pre-order' : 'Private preorder', 'preorder-notice-title');
      line('This is a preorder. Full payment is collected upfront through PayPal.');
      if (typeof settings.preorderFulfillmentNote === 'string' && settings.preorderFulfillmentNote) line(settings.preorderFulfillmentNote);
    }
    element.hidden = !element.childNodes.length;
  }
  window.PreorderNotice = { render: render };
  document.addEventListener('preorder:settings', function (event) { if (event.detail) render(event.detail); });
  fetch('/api/site-settings', { credentials: 'include', cache: 'no-store' })
    .then(function (response) { if (!response.ok) throw Error('Settings unavailable'); return response.json(); })
    .then(render).catch(function () { /* The owning page presents settings errors and retry controls. */ });
})();
