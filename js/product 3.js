/* Update28: public catalogue only; the shared cart validates availability and pricing. */
(function () {
  'use strict';
  var content = document.getElementById('product-content');
  var zoom = document.getElementById('product-zoom');
  var zoomPhoto = document.getElementById('zoom-photo');
  var zoomViewport = document.getElementById('zoom-viewport');
  var zoomToggle = document.getElementById('zoom-toggle');
  var id = new URLSearchParams(location.search).get('id');
  var request = 0, selected = null, busy = false;
  function node(tag, text, cls) {
    var el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (cls) el.className = cls;
    return el;
  }
  function button(text, action, cls) {
    var el = node('button', text, cls); el.type = 'button'; el.onclick = action; return el;
  }
  function state(title, message, retry) {
    selected = null; content.textContent = ''; content.setAttribute('aria-busy', 'false');
    var box = node('section', undefined, 'product-state');
    box.appendChild(node('h1', title)); box.appendChild(node('p', message));
    if (retry) box.appendChild(button('Retry', load, 'product-action secondary'));
    content.appendChild(box);
    if (zoom.open) zoom.close();
  }
  function favorites() {
    var stored = JSON.parse(localStorage.getItem('sd-shop-favorites-v1') || '[]');
    if (!Array.isArray(stored)) throw Error('Invalid favorites');
    return stored;
  }
  function render(product) {
    selected = product;
    content.textContent = ''; content.setAttribute('aria-busy', 'false');
    document.title = product.name + ' — SAMEDI ET DIMANCHE';
    var price = (product.prices || []).find(function (p) {
      return p.active === true && String(p.currency).toLowerCase() === 'cad' &&
        Number.isSafeInteger(p.unit_amount) && p.unit_amount > 0 && p.unit_amount <= 1000000;
    });
    var photos = (Array.isArray(product.images) ? product.images : (product.image ? [product.image] : [])).filter(function (src) { return typeof src === 'string' && src.trim(); }).slice(0, 12);
    var index = 0, broken = {}, layout = node('section', undefined, 'product-detail');
    var gallery = node('div'), stage = node('div', undefined, 'product-stage');
    var photo = node('img'), empty = node('p', 'Photograph unavailable.', 'product-image-empty');
    var zoomButton = button('', function () {
      zoomPhoto.src = photos[index]; zoomPhoto.alt = photo.alt;
      zoomViewport.classList.remove('is-enlarged'); zoomToggle.textContent = 'Zoom in';
      zoom.showModal(); document.body.style.overflow = 'hidden';
    }, 'product-image-action');
    zoomButton.appendChild(node('span', 'View closer')); zoomButton.setAttribute('aria-label', 'Zoom product photograph');
    stage.append(photo, empty, zoomButton); gallery.appendChild(stage);
    var controls = node('div', undefined, 'product-gallery-controls');
    var previous = button('←', function () { show(index - 1); });
    var next = button('→', function () { show(index + 1); });
    previous.setAttribute('aria-label', 'Previous photograph'); next.setAttribute('aria-label', 'Next photograph');
    var counter = node('span'); counter.setAttribute('aria-live', 'polite');
    controls.append(previous, counter, next); gallery.appendChild(controls);
    var thumbnails = node('div', undefined, 'product-thumbnails'); thumbnails.setAttribute('aria-label', 'Product photographs');
    photos.forEach(function (src, i) {
      var thumb = button('', function () { show(i); }, 'product-thumbnail');
      thumb.setAttribute('aria-label', 'View photograph ' + (i + 1));
      var img = node('img'); img.src = src; img.alt = ''; img.loading = 'lazy';
      img.onerror = function () { img.remove(); thumb.textContent = 'Photo ' + (i + 1); };
      thumb.appendChild(img); thumbnails.appendChild(thumb);
    });
    gallery.appendChild(thumbnails);
    function show(i) {
      index = photos.length ? (i + photos.length) % photos.length : 0;
      photo.hidden = !photos.length || !!broken[index]; empty.hidden = !photo.hidden;
      zoomButton.hidden = photo.hidden; controls.hidden = !photos.length; thumbnails.hidden = photos.length < 2;
      previous.disabled = next.disabled = photos.length < 2;
      counter.textContent = (index + 1) + ' / ' + photos.length;
      photo.alt = product.name + ' — photograph ' + (index + 1);
      if (photos.length) photo.src = photos[index];
      Array.from(thumbnails.children).forEach(function (thumb, n) { thumb.setAttribute('aria-pressed', String(n === index)); });
    }
    photo.onerror = function () { broken[index] = true; photo.hidden = true; empty.hidden = false; zoomButton.hidden = true; };
    gallery.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); show(index + (e.key === 'ArrowLeft' ? -1 : 1)); }
    });
    show(0);
    var copy = node('div', undefined, 'product-copy');
    copy.appendChild(node('p', 'Samedi Et Dimanche / Collection', 'product-eyebrow'));
    copy.appendChild(node('h1', product.name, 'product-name-detail'));
    copy.appendChild(node('p', price ? new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', currencyDisplay: 'code' }).format(price.unit_amount / 100) : 'Currently unavailable', 'product-price-detail'));
    copy.appendChild(node('p', product.description || 'No description is available for this piece.', 'product-description-detail'));
    var variants = Array.isArray(product.variants) ? product.variants : [];
    var sizeSelect, colorSelect, stockNote, optionControls;
    function available(variant) {
      return variant.active === true && Number.isInteger(variant.stock) && variant.stock > 0 && !!variant.id;
    }
    function chosenVariant() {
      if (!variants.length || !sizeSelect.value || !colorSelect.value) return null;
      return variants.find(function (variant) { return variant.size === sizeSelect.value && variant.color === colorSelect.value; });
    }
    function quantityLimit() {
      var variant = chosenVariant();
      return variants.length ? (variant && available(variant) ? Math.min(20, variant.stock) : 0) : 20;
    }
    if (variants.length) {
      optionControls = node('div', undefined, 'product-options');
      function selector(title, key) {
        var wrap = node('div', undefined, 'product-option');
        var label = node('label', title); label.htmlFor = 'product-' + key;
        var select = node('select'); select.id = label.htmlFor;
        var placeholder = node('option', 'Choose ' + title.toLowerCase()); placeholder.value = '';
        select.appendChild(placeholder);
        Array.from(new Set(variants.map(function (variant) { return variant[key]; }))).forEach(function (value) {
          var option = node('option', value); option.value = value; select.appendChild(option);
        });
        wrap.append(label, select); optionControls.appendChild(wrap); return select;
      }
      sizeSelect = selector('Size', 'size'); colorSelect = selector('Color', 'color');
      stockNote = node('p', '', 'product-option-stock'); stockNote.setAttribute('role', 'status');
      optionControls.appendChild(stockNote); copy.appendChild(optionControls);
      sizeSelect.onchange = function () {
        var compatible = variants.some(function (variant) { return variant.size === sizeSelect.value && variant.color === colorSelect.value && available(variant); });
        if (!compatible) colorSelect.value = '';
        status.textContent = ''; updatePurchase();
      };
      colorSelect.onchange = function () { status.textContent = ''; updatePurchase(); };
    }
    var qtyWrap = node('div', undefined, 'product-quantity'), label = node('label', 'Quantity');
    label.htmlFor = 'product-quantity';
    var quantity = node('input'); quantity.id = 'product-quantity'; quantity.type = 'number'; quantity.min = '1'; quantity.max = '20'; quantity.step = '1'; quantity.value = '1';
    function adjust(delta) { quantity.value = String(Math.min(quantityLimit() || 1, Math.max(1, (Number(quantity.value) || 1) + delta))); updatePurchase(); }
    var minus = button('−', function () { adjust(-1); }), plus = button('+', function () { adjust(1); });
    minus.setAttribute('aria-label', 'Decrease quantity'); plus.setAttribute('aria-label', 'Increase quantity');
    qtyWrap.append(label, minus, quantity, plus); copy.appendChild(qtyWrap);
    var actions = node('div', undefined, 'product-actions'), status = node('p', '', 'product-status'); status.setAttribute('role', 'status');
    function updatePurchase() {
      var variant = chosenVariant(), limit = quantityLimit();
      if (variants.length) {
        Array.from(sizeSelect.options).slice(1).forEach(function (option) {
          option.disabled = !variants.some(function (entry) { return entry.size === option.value && available(entry); });
          option.textContent = option.value + (option.disabled ? ' — unavailable' : '');
        });
        Array.from(colorSelect.options).slice(1).forEach(function (option) {
          option.disabled = !variants.some(function (entry) { return entry.color === option.value && (!sizeSelect.value || entry.size === sizeSelect.value) && available(entry); });
          option.textContent = option.value + (option.disabled ? ' — unavailable' : '');
        });
        sizeSelect.disabled = colorSelect.disabled = busy;
        stockNote.textContent = !variants.some(available) ? 'All options are currently unavailable.' :
          !variant ? 'Choose a size and color to check availability.' :
          !available(variant) ? 'This combination is currently unavailable.' :
          variant.stock + ' available in this combination. Cart items are not reserved.';
      }
      quantity.max = String(limit || 1);
      var qty = Number(quantity.value), valid = Number.isInteger(qty) && qty >= 1 && qty <= limit;
      quantity.disabled = busy || !limit;
      minus.disabled = busy || !limit || qty <= 1;
      plus.disabled = busy || !limit || qty >= limit;
      add.disabled = busy || !selected || !price || !valid;
      add.textContent = !price ? 'Unavailable' : variants.length && !variant ? 'Choose size & color' :
        variants.length && !available(variant) ? 'Unavailable' : 'Add to cart';
      if (limit && !valid && !busy) status.textContent = 'Choose a whole quantity from 1 to ' + limit + '.';
    }
    quantity.oninput = function () { status.textContent = ''; updatePurchase(); };
    var add = button(price ? 'Add to cart' : 'Unavailable', async function () {
      var qty = Number(quantity.value);
      var variant = chosenVariant(), limit = quantityLimit();
      if (variants.length && (!variant || !available(variant))) { status.textContent = 'Choose an available size and color.'; sizeSelect.focus(); return; }
      if (!Number.isInteger(qty) || qty < 1 || qty > limit) { status.textContent = 'Choose a quantity from 1 to ' + limit + '.'; quantity.focus(); return; }
      if (busy || !selected || !price) return;
      busy = true; updatePurchase();
      status.textContent = 'Checking current pricing…';
      try {
        var item = { type: 'shop', productId: product.id, priceId: price.id, quantity: qty };
        if (variant) item.variantId = variant.id;
        await SharedCart.add(item);
        status.textContent = 'Added to your shared cart. ';
        var link = node('a', 'View cart →'); link.href = 'cart.html'; status.appendChild(link);
      } catch (e) { status.textContent = e.message || 'Could not add this piece. Please retry.'; }
      finally { busy = false; updatePurchase(); }
    }, 'product-action');
    add.disabled = !price;
    updatePurchase();
    var favorite = button('Favorite', function () {
      try {
        var ids = favorites();
        localStorage.setItem('sd-shop-favorites-v1', JSON.stringify(ids.includes(product.id) ? ids.filter(function (x) { return x !== product.id; }) : ids.concat(product.id)));
        paintFavorite();
      } catch (_) { status.textContent = 'Favorites could not be saved. Enable browser storage and retry.'; }
    }, 'product-action secondary');
    function paintFavorite() {
      var on = false; try { on = favorites().includes(product.id); } catch (_) {}
      favorite.textContent = on ? 'Remove from favorites' : 'Save to favorites'; favorite.setAttribute('aria-pressed', String(on));
    }
    paintFavorite(); actions.append(add, favorite); copy.append(actions, status); layout.append(gallery, copy); content.appendChild(layout);
  }
  async function load() {
    if (busy) return;
    var ticket = ++request; selected = null;
    content.setAttribute('aria-busy', 'true');
    content.innerHTML = '<div class="product-detail"><div class="product-skeleton"></div><div class="product-state">Loading piece…</div></div>';
    if (!id) { state('Piece not found', 'Choose a piece from the collection to view its details.'); return; }
    try {
      // An explicit closure always wins; products API remains authoritative if settings fail.
      try {
        var settingsResponse = await fetch('/api/site-settings', { credentials: 'include', cache: 'no-store' });
        if (settingsResponse.ok && (await settingsResponse.json()).shopEnabled === false) {
          if (ticket === request) state('Collection coming soon', 'The collection is currently closed. Please check back.');
          return;
        }
      } catch (_) {}
      var response = await fetch('/api/products?category=shop', { credentials: 'include', cache: 'no-store' });
      if (!response.ok) throw Error('Catalogue unavailable');
      var data = await response.json(); if (ticket !== request) return;
      var product = (Array.isArray(data.data) ? data.data : []).find(function (p) { return p.id === id && p.category === 'shop' && p.active === true; });
      if (!product) { state('Piece unavailable', 'This piece is not currently available in the collection.'); return; }
      render(product);
    } catch (_) { if (ticket === request) state('Unable to load this piece', 'The collection could not be reached. Please try again.', true); }
  }
  document.getElementById('zoom-dismiss').onclick = function () { zoom.close(); };
  zoom.addEventListener('close', function () { document.body.style.overflow = ''; });
  zoomToggle.onclick = function () { var enlarged = zoomViewport.classList.toggle('is-enlarged'); zoomToggle.textContent = enlarged ? 'Zoom out' : 'Zoom in'; };
  zoom.addEventListener('click', function (e) { if (e.target === zoom || e.target === zoomViewport) zoom.close(); });
  window.addEventListener('focus', load);
  load();
})();
