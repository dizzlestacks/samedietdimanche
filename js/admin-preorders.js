/* Update38 — isolated preorder settings, category links and consented CSV import. */
(function () {
  'use strict';
  var byId = function (id) { return document.getElementById(id); };
  var settingsForm = byId('preorder-settings-form');
  if (!settingsForm) return;
  var loaded = false, settingsBusy = false, linkBusy = false, importBusy = false;
  var fields = byId('preorder-settings-fields'), reload = byId('preorder-settings-reload');
  var watches = byId('preorder-watches-enabled'), shop = byId('preorder-shop-enabled');
  var waitlist = byId('shop-waitlist-enabled'), note = byId('preorder-fulfillment-note');
  var category = byId('preorder-link-category'), expiry = byId('preorder-link-expiry');
  var output = byId('preorder-link-output'), copy = byId('preorder-link-copy');
  function say(id, text, error) {
    var element = byId(id); element.textContent = text; element.dataset.error = error ? 'true' : 'false';
  }
  async function request(path, method, body) {
    var options = { credentials: 'include', cache: 'no-store', method: method || 'GET' };
    if (body !== undefined) { options.headers = { 'Content-Type': 'application/json' }; options.body = JSON.stringify(body); }
    var response = await fetch(path, options);
    var data;
    try { data = await response.json(); } catch (_) { throw Error('The server returned an unreadable response. Please retry.'); }
    if (!response.ok) throw Error(data.error || data.message || 'Request failed (' + response.status + '). Please retry.');
    return data;
  }
  function settingsLock(busy) {
    settingsBusy = busy; fields.disabled = busy || !loaded; reload.disabled = busy;
  }
  function requireNote() { note.required = watches.checked || shop.checked; }
  watches.addEventListener('change', requireNote); shop.addEventListener('change', requireNote);
  async function loadSettings() {
    if (settingsBusy) return;
    settingsLock(true); say('preorder-settings-status', 'Loading preorder settings…');
    try {
      var data = await request('/api/admin/site-settings');
      watches.checked = data.preorderWatchesEnabled === true;
      shop.checked = data.preorderShopEnabled === true;
      waitlist.checked = data.shopWaitlistEnabled === true;
      note.value = data.preorderFulfillmentNote || '';
      requireNote(); loaded = true;
      say('preorder-settings-status', 'Preorder settings loaded. Changes use Save preorder settings, not Save Settings.');
    } catch (error) { say('preorder-settings-status', 'Could not load preorder settings: ' + error.message, true); }
    finally { settingsLock(false); }
  }
  byId('private-preorders').addEventListener('toggle', function () {
    if (this.open && !loaded) loadSettings();
  });
  reload.addEventListener('click', loadSettings);
  settingsForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (settingsBusy || !loaded) return;
    var body = {
      preorderWatchesEnabled: watches.checked, preorderShopEnabled: shop.checked,
      shopWaitlistEnabled: waitlist.checked, preorderFulfillmentNote: note.value.trim()
    };
    if ((body.preorderWatchesEnabled || body.preorderShopEnabled) && !body.preorderFulfillmentNote) {
      say('preorder-settings-status', 'Enter a shipping estimate before enabling private preorders.', true); note.focus(); return;
    }
    if (body.preorderFulfillmentNote.length > 300) { say('preorder-settings-status', 'Shipping estimate must be 300 characters or fewer.', true); return; }
    settingsLock(true); say('preorder-settings-status', 'Saving preorder settings…');
    try {
      var saved = await request('/api/admin/site-settings', 'PUT', body);
      say('preorder-settings-status', 'Preorder settings saved. No other Site Settings were changed.');
      if (window.offerWatchAnnouncements) window.offerWatchAnnouncements(saved.announcementDrafts);
    } catch (error) { say('preorder-settings-status', 'Could not save preorder settings: ' + error.message, true); }
    finally { settingsLock(false); }
  });
  function localDate(date) {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  expiry.value = localDate(new Date(Date.now() + 7 * 86400000));
  expiry.min = localDate(new Date()); expiry.max = localDate(new Date(Date.now() + 30 * 86400000));
  function linkLock(busy) {
    linkBusy = busy; byId('preorder-link-fields').disabled = busy; copy.disabled = busy || !output.value;
  }
  category.addEventListener('change', function () {
    output.value = ''; copy.disabled = true; say('preorder-link-status', '');
  });
  byId('preorder-link-form').addEventListener('submit', async function (event) {
    event.preventDefault(); if (linkBusy) return;
    var date = new Date(expiry.value), now = Date.now(), selected = category.value;
    if (!Number.isFinite(date.getTime()) || date.getTime() <= now || date.getTime() > now + 30 * 86400000) {
      say('preorder-link-status', 'Choose a future expiry no more than 30 days from now.', true); return;
    }
    output.value = ''; linkLock(true); say('preorder-link-status', 'Creating private ' + selected + ' link…');
    try {
      var data = await request('/api/admin/preorder-links', 'POST', { category: selected, expiresAt: date.toISOString() });
      if (typeof data.url !== 'string' || !data.url) throw Error('The server did not return a link.');
      var url = new URL(data.url, location.origin);
      if (url.origin !== location.origin) throw Error('The server returned a link for another origin.');
      output.value = url.href;
      var ends = new Date(data.expiresAt);
      say('preorder-link-status', 'Private ' + selected + ' link created. Expires ' +
        (Number.isFinite(ends.getTime()) ? ends.toLocaleString() : data.expiresAt) + '. Share from the published admin for live customers.');
    } catch (error) { say('preorder-link-status', 'Could not create private link: ' + error.message, true); }
    finally { linkLock(false); }
  });
  byId('preorder-link-revoke').addEventListener('click', async function () {
    if (linkBusy) return;
    var selected = category.value;
    if (!confirm('Revoke every prior ' + selected + ' preorder link? All previously generated links for this category will stop working. This cannot be undone.')) return;
    linkLock(true); say('preorder-link-status', 'Revoking all ' + selected + ' preorder links…');
    try {
      await request('/api/admin/preorder-links/revoke', 'POST', { category: selected });
      output.value = ''; say('preorder-link-status', 'All prior ' + selected + ' preorder links have been revoked.');
    } catch (error) { say('preorder-link-status', 'Could not revoke links: ' + error.message, true); }
    finally { linkLock(false); }
  });
  copy.addEventListener('click', async function () {
    if (linkBusy || !output.value) return;
    linkLock(true);
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) throw Error('Clipboard unavailable. Select and copy the URL manually.');
      await navigator.clipboard.writeText(output.value); say('preorder-link-status', 'Private link copied. Share from the published admin for live customers.');
    } catch (error) { say('preorder-link-status', 'Could not copy link: ' + error.message, true); output.focus(); output.select(); }
    finally { linkLock(false); }
  });
  byId('waitlist-import-form').addEventListener('submit', async function (event) {
    event.preventDefault(); if (importBusy) return;
    var file = byId('waitlist-import-file').files[0], errors = byId('waitlist-import-errors');
    errors.textContent = '';
    if (!file || !/\.csv$/i.test(file.name)) { say('waitlist-import-status', 'Select a .csv file.', true); return; }
    if (file.size > 100 * 1024) { say('waitlist-import-status', 'CSV file must be 100 KB or smaller.', true); return; }
    if (!byId('waitlist-import-consent').checked) { say('waitlist-import-status', 'Confirm you have permission for these email addresses before importing.', true); return; }
    var selected = byId('waitlist-import-category').value;
    importBusy = true; byId('waitlist-import-fields').disabled = true;
    say('waitlist-import-status', 'Reading and importing CSV…');
    try {
      var csv = await file.text();
      if (!csv.trim()) throw Error('The CSV file is empty.');
      var data = await request('/api/admin/waitlist/import', 'POST', { csv: csv, category: selected, consent: true });
      var invalid = Array.isArray(data.invalid) ? data.invalid : [];
      say('waitlist-import-status', 'Import complete: ' + data.imported + ' imported, ' + data.duplicates +
        ' duplicates, ' + invalid.length + ' invalid, ' + data.total + ' total. No emails were sent.');
      invalid.forEach(function (entry) {
        var item = document.createElement('li'); item.textContent = 'Row ' + entry.row + ': ' + entry.reason; errors.appendChild(item);
      });
      byId('waitlist-import-file').value = ''; byId('waitlist-import-consent').checked = false;
      if (typeof loadWaitlist === 'function') await loadWaitlist();
    } catch (error) { say('waitlist-import-status', 'Could not import CSV: ' + error.message, true); }
    finally { importBusy = false; byId('waitlist-import-fields').disabled = false; }
  });
})();
