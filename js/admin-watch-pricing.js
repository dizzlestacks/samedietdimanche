/* Update18: authenticated editor retains all seven prices even during public preview. */
(function () {
  'use strict';
  var form = document.getElementById('wp-component-pricing');
  if (!form) return;
  var groups = { bases: ['black-black', 'black-camouflage', 'red-red', 'blue-blue', 'green-green'], fees: ['face', 'band'] };
  var inputs = [], busy = false, loaded = false;
  var status = document.getElementById('wp-price-status');
  var save = document.getElementById('wp-price-save');
  var reload = document.getElementById('wp-price-reload');
  Object.keys(groups).forEach(function (kind) {
    groups[kind].forEach(function (id) {
      var field = document.createElement('div'), label = document.createElement('label'), input = document.createElement('input');
      var key = 'wp-price-' + kind + '-' + id;
      label.htmlFor = key; label.textContent = (kind === 'bases' ? 'Base: ' + id.split('-').map(function(x){return x[0].toUpperCase()+x.slice(1);}).join(' / ') : id[0].toUpperCase()+id.slice(1)+' change · once') + ' · CAD';
      input.id = key; input.type = 'number'; input.min = '0'; input.max = '10000'; input.step = '0.01';
      input.placeholder = 'Unpriced'; input.disabled = true; input.dataset.kind = kind; input.dataset.color = id;
      inputs.push(input); field.appendChild(label); field.appendChild(input); document.getElementById('wp-price-inputs').appendChild(field);
    });
  });
  function lock(value) { busy = value; save.disabled = value || !loaded; reload.disabled = value; inputs.forEach(function (i) { i.disabled = value || !loaded; }); }
  function fill(catalog) {
    inputs.forEach(function (input) {
      var value = input.dataset.kind==='bases'?catalog.models.find(function (x) { return x.id === input.dataset.color; }).cents:catalog.fees[input.dataset.color];
      input.value = value === null ? '' : (value / 100).toFixed(2);
    });
  }
  async function load() {
    if (busy) return;
    lock(true); status.textContent = 'Loading current CAD prices…';
    try {
      var response = await fetch('/api/admin/watch-pricing', { credentials: 'include', cache: 'no-store' });
      if (!response.ok) throw new Error('Could not load prices. Use Reload prices to retry.');
      fill(await response.json()); loaded = true; status.textContent = 'Current prices loaded. Blank fields remain unavailable; save changes explicitly.';
    } catch (error) { loaded = false; status.textContent = error.message; }
    finally { lock(false); }
  }
  function cents(value) {
    if (value === '') return null;
    if (value.length > 20 || !/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error('Use nonnegative CAD amounts with at most two decimal places, or leave blank.');
    var parts = value.split('.');
    var result = Number(parts[0]) * 100 + Number((parts[1] || '').padEnd(2, '0'));
    if (!Number.isSafeInteger(result) || result > 1000000) throw new Error('Maximum base price or change fee is CAD $10,000.00.');
    return result;
  }
  form.addEventListener('submit', async function (event) {
    event.preventDefault(); if (busy || !loaded) return;
    var prices = { bases: {}, fees: {} };
    try {
      inputs.forEach(function (input) { prices[input.dataset.kind][input.dataset.color] = cents(input.value.trim()); });
    } catch (error) { status.textContent = error.message; return; }
    lock(true); status.textContent = 'Saving model prices and change fees…';
    try {
      var response = await fetch('/api/admin/watch-pricing', { method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(prices) });
      if (!response.ok) {
        if (response.status === 401 || response.status === 503) throw new Error('Prices were not saved. Check your admin session/server availability and retry.');
        var problem = await response.json(); throw new Error(problem.error || 'Prices were not saved.');
      }
      fill(await response.json()); status.textContent = 'Base prices and one-time change fees saved in CAD. Checkout is still unavailable.';
    } catch (error) { status.textContent = error.message; }
    finally { lock(false); }
  });
  reload.addEventListener('click', function () {
    if (loaded && !window.confirm('Reload saved prices? Unsaved input changes will be replaced.')) return;
    load();
  });
  load();
})();
