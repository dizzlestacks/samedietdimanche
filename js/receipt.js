(function () {
  'use strict';

  var heading = document.getElementById('receipt-heading');
  var message = document.getElementById('receipt-message');
  var state = document.getElementById('receipt-state');
  var loading = document.getElementById('receipt-loading');
  var errorText = document.getElementById('receipt-error');
  var retry = document.getElementById('receipt-retry');
  var printer = document.getElementById('receipt-printer');
  var paper = document.getElementById('receipt-paper');
  var printButton = document.getElementById('receipt-print');
  var downloadButton = document.getElementById('receipt-download');
  var actionStatus = document.getElementById('receipt-action-status');
  var verifiedReceipt = null;
  var busy = false;
  var downloading = false;
  var logoData = null;
  var money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', currencyDisplay: 'code' });
  var dateFormat = new Intl.DateTimeFormat('en-CA', { dateStyle: 'long', timeStyle: 'short', timeZone: 'UTC' });

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function amount(cents) { return money.format(cents / 100); }
  function cents(value) { return Number.isSafeInteger(value) && value >= 0; }
  function text(value) { return typeof value === 'string' && value.trim().length > 0; }
  function optionalText(value) { return value == null || typeof value === 'string'; }

  function isVerified(receipt) {
    if (!receipt || receipt.status !== 'paid' || receipt.currency !== 'CAD') return false;
    if (!text(receipt.id) || !text(receipt.orderId) ||
        !Number.isSafeInteger(receipt.paidAt) || receipt.paidAt <= 0 ||
        !Number.isFinite(new Date(receipt.paidAt).getTime())) return false;
    if (!Array.isArray(receipt.lines) || !receipt.lines.length) return false;
    if (!receipt.lines.every(function (line) {
      return line && text(line.name) && Number.isSafeInteger(line.quantity) && line.quantity > 0 &&
        cents(line.unitCents) && Number.isSafeInteger(line.quantity * line.unitCents) &&
        (line.preorder === undefined || typeof line.preorder === 'boolean') &&
        ['type', 'faceName', 'bandName', 'baseName', 'size', 'color', 'fulfillmentNote'].every(function (key) { return optionalText(line[key]); });
    })) return false;
    var total = receipt.total;
    if (!total || !['subtotalCents', 'shippingCents', 'taxCents', 'totalCents'].every(function (key) { return cents(total[key]); }) || !optionalText(total.taxLabel)) return false;
    var sum = receipt.lines.reduce(function (value, line) { return value + line.quantity * line.unitCents; }, 0);
    return Number.isSafeInteger(sum) && sum === total.subtotalCents &&
      Number.isSafeInteger(total.subtotalCents + total.shippingCents + total.taxCents) &&
      total.totalCents === total.subtotalCents + total.shippingCents + total.taxCents;
  }

  function pair(container, label, value, className) {
    var row = element('div', className);
    row.append(element('dt', '', label), element('dd', '', value));
    container.append(row);
  }

  function buildPaper(receipt) {
    paper.replaceChildren();
    var brand = element('div', 'paper-brand');
    var logo = element('img');
    logo.src = 'img/newlogo.png';
    logo.alt = 'Samedi Et Dimanche';
    logo.width = 76;
    brand.append(logo, element('p', '', 'Samedi Et Dimanche\nPayment receipt'));
    var title = element('div', 'paper-title');
    title.append(element('h2', '', 'Your weekend, collected.'), element('span', 'paid-stamp', 'PAID'));
    var meta = element('dl', 'receipt-meta');
    pair(meta, 'Order', receipt.orderId);
    pair(meta, 'Payment date', dateFormat.format(new Date(receipt.paidAt)) + ' UTC');
    pair(meta, 'Receipt', receipt.id);
    pair(meta, 'Currency', 'Canadian dollars (CAD)');
    var lines = element('ol', 'receipt-lines');
    receipt.lines.forEach(function (line) {
      var item = element('li', 'receipt-line');
      var top = element('div', 'line-top');
      top.append(element('h3', '', line.name), element('span', 'line-amount', amount(line.unitCents * line.quantity)));
      item.append(top);
      var details = [];
      [['type', 'Type'], ['faceName', 'Face'], ['bandName', 'Band'], ['baseName', 'Base'], ['size', 'Size'], ['color', 'Color']].forEach(function (entry) {
        if (text(line[entry[0]])) details.push(entry[1] + ': ' + line[entry[0]]);
      });
      if (details.length) item.append(element('p', 'line-detail', details.join(' · ')));
      item.append(element('p', 'line-quantity', 'Qty ' + line.quantity + ' × ' + amount(line.unitCents) + ' each'));
      if (line.preorder) item.append(element('p', 'preorder-tag', 'Paid preorder — not a shipping confirmation'));
      if (text(line.fulfillmentNote)) item.append(element('p', 'fulfillment', line.fulfillmentNote));
      lines.append(item);
    });
    var totals = element('dl', 'receipt-totals');
    pair(totals, 'Subtotal', amount(receipt.total.subtotalCents));
    pair(totals, 'Shipping', amount(receipt.total.shippingCents));
    pair(totals, text(receipt.total.taxLabel) ? receipt.total.taxLabel : 'Tax', amount(receipt.total.taxCents));
    pair(totals, 'Total paid · CAD', amount(receipt.total.totalCents), 'grand-total');
    var note = receipt.lines.some(function (line) { return line.preorder; })
      ? 'Paid preorder — not a shipping confirmation. Your preorder is paid in full. Saved fulfillment details appear with each item above. Shipping confirmation is separate.'
      : 'Payment received. This receipt confirms payment only; it is not a shipping confirmation.';
    paper.append(brand, title, meta, lines, totals, element('p', 'receipt-note', note),
      element('p', 'paper-signoff', 'Thank you for spending\npart of your weekend with us.'));
  }

  function showError(title, detail) {
    verifiedReceipt = null;
    heading.textContent = title;
    message.textContent = 'No verified receipt is available yet. This page never initiates a payment.';
    state.hidden = false;
    state.setAttribute('aria-busy', 'false');
    loading.hidden = true;
    errorText.textContent = detail;
    errorText.hidden = false;
    retry.hidden = false;
    printer.hidden = true;
    paper.replaceChildren();
    printButton.disabled = true;
    downloadButton.disabled = true;
    actionStatus.textContent = 'Print and download require a verified paid receipt.';
  }

  async function loadReceipt() {
    if (busy) return;
    busy = true;
    retry.hidden = true;
    errorText.hidden = true;
    state.hidden = false;
    loading.hidden = false;
    state.setAttribute('aria-busy', 'true');
    heading.textContent = 'Checking your payment.';
    message.textContent = 'We’re retrieving your receipt securely. This does not make another payment.';
    var controller = new AbortController();
    var timeout;
    try {
      var id;
      var key;
      try {
        id = sessionStorage.getItem('sd-last-receipt');
        key = sessionStorage.getItem('sd-paypal-key');
      } catch (_) {
        showError('Your receipt needs this browser.', 'Browser storage is unavailable. Allow session storage and return to the browser tab where you checked out. If you still need help, contact the shop with your payment reference. Do not pay again.');
        return;
      }
      if (!id || !key) {
        showError('Let’s find your receipt.', 'Open this page in the same browser tab used for checkout. The saved order reference or secure browser key is missing. Return to your original checkout tab to check payment status, or contact the shop with your payment reference. Do not pay again.');
        return;
      }
      if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) {
        showError('We couldn’t identify this order.', 'The saved order reference is not valid. Return to your original checkout tab to check payment status, or contact the shop. Do not pay again.');
        return;
      }
      timeout = setTimeout(function () { controller.abort(); }, 20000);
      var response = await fetch('/api/checkout/' + encodeURIComponent(id) + '/receipt', {
        method: 'POST',
        headers: { 'X-Checkout-Key': key, 'Accept': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        signal: controller.signal
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          showError('This receipt couldn’t be verified.', 'The secure browser key was not accepted. Use the original checkout tab or contact the shop with your payment reference. Do not pay again.');
        } else if (response.status === 409 || response.status === 202) {
          showError('Payment is still being checked.', 'Your payment has not been verified as paid. Wait a moment and check again. If PayPal shows a payment, do not submit another one.');
        } else if (response.status === 404) {
          showError('Your receipt isn’t available.', 'We couldn’t find a verified receipt for this order. Try again shortly or contact the shop with your payment reference. Do not pay again.');
        } else {
          showError('We couldn’t retrieve your receipt.', 'The receipt service is temporarily unavailable. Check again in a moment. This will not charge you again.');
        }
        return;
      }
      var payload = await response.json();
      var receipt = payload && payload.receipt;
      if (!isVerified(receipt)) {
        showError('Payment is not yet verified.', 'We haven’t received a complete, verified paid receipt. Wait a moment and check again, or return to your original checkout tab. Do not pay again if PayPal already shows a payment.');
        return;
      }
      buildPaper(receipt);
      verifiedReceipt = receipt;
      heading.textContent = 'A little weekend, kept.';
      message.textContent = 'Payment confirmed. Thank you for making us part of your collection.';
      state.hidden = true;
      state.setAttribute('aria-busy', 'false');
      printer.hidden = false;
      paper.classList.remove('is-fed');
      void paper.offsetWidth;
      paper.classList.add('is-fed');
      printButton.disabled = false;
      downloadButton.disabled = false;
      actionStatus.textContent = 'Keep a copy: download a standalone HTML receipt or print to PDF.';
    } catch (error) {
      showError('Your receipt couldn’t be loaded.', error && error.name === 'AbortError'
        ? 'The secure check took too long. Please check again. No new payment has been requested.'
        : 'Check your connection, then try again. If the problem continues, return to your original checkout tab or contact the shop. Do not pay again.');
    } finally {
      clearTimeout(timeout);
      busy = false;
    }
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  async function embeddedLogo() {
    if (logoData) return logoData;
    var response = await fetch('img/newlogo.png', { cache: 'force-cache', credentials: 'same-origin' });
    if (!response.ok) throw new Error('Logo unavailable');
    var blob = await response.blob();
    logoData = await new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return logoData;
  }

  async function downloadReceipt() {
    if (!verifiedReceipt || downloading) return;
    downloading = true;
    downloadButton.disabled = true;
    actionStatus.textContent = 'Preparing your offline HTML receipt…';
    try {
      var logo = await embeddedLogo();
      var clone = paper.cloneNode(true);
      clone.classList.remove('is-fed');
      clone.querySelector('img').src = logo;
      // DOM serialization escapes all server-provided text nodes. No data is
      // interpolated into script, CSS, or executable attributes.
      var css = 'html{color-scheme:light}body{margin:0;padding:32px 20px;background:#e6dbd0;color:#33262a;font:12px/1.7 Montserrat,system-ui,sans-serif}*{box-sizing:border-box}.receipt-paper{max-width:620px;margin:auto;padding:36px;background:#f4eee4;overflow-wrap:anywhere}.paper-brand,.paper-title,.line-top,.receipt-totals>div{display:flex;justify-content:space-between;gap:18px}.paper-brand{align-items:center;border-bottom:1px solid #d8cbbf;padding-bottom:20px}.paper-brand img{width:76px;height:auto;background:#23151d;padding:8px}.paper-brand p{font-size:10px;white-space:pre-line;text-align:right;letter-spacing:.1em}.paper-title{align-items:center;margin:24px 0}h2{font-size:19px;font-weight:400}h3{margin:0;font-size:12px;font-weight:600}.paid-stamp{border:2px solid #9b6655;color:#865343;padding:6px 10px;letter-spacing:.2em;font-size:11px;transform:rotate(-8deg)}.receipt-meta{font-size:10px}.receipt-meta>div{display:grid;grid-template-columns:85px minmax(0,1fr);gap:14px;margin:6px 0}dd{margin:0;text-align:right}dt,.line-detail,.line-quantity,.fulfillment,.receipt-note{color:#6c5b61}.receipt-lines{list-style:none;padding:0;margin:24px 0 0;border-top:1px dashed #d8cbbf}.receipt-line{padding:18px 0;border-bottom:1px dashed #d8cbbf}.line-amount{white-space:nowrap}.line-detail,.line-quantity,.fulfillment,.preorder-tag{font-size:10px;margin:7px 0 0}.preorder-tag{color:#7a433d;font-weight:600}.receipt-totals{margin-top:24px;font-variant-numeric:tabular-nums}.receipt-totals>div{margin-top:12px}.receipt-totals dd{white-space:nowrap}.grand-total{border-top:1px solid #d8cbbf;padding-top:17px;font-size:16px;font-weight:600}.grand-total dt{color:#33262a}.receipt-note{font-size:10px;border-top:1px dashed #d8cbbf;padding-top:20px;margin-top:25px}.paper-signoff{white-space:pre-line;font-size:9px;text-transform:uppercase;letter-spacing:.12em;text-align:center;margin-top:24px}@media(max-width:440px){body{padding:12px}.receipt-paper{padding:22px 16px}}@media print{@page{margin:15mm}html,body{height:auto;overflow:visible!important}body{padding:0;background:#f4eee4}.receipt-paper{max-width:none;padding:0;height:auto;overflow:visible!important;print-color-adjust:exact;-webkit-print-color-adjust:exact}.paper-brand,.paper-title,.receipt-meta,.receipt-totals,.receipt-note,.paper-signoff,.line-top,.line-detail,.line-quantity,.preorder-tag,.fulfillment{break-inside:avoid}.receipt-line{break-inside:auto}}';
      var html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' +
        escapeHTML('Payment receipt ' + verifiedReceipt.orderId + ' — Samedi Et Dimanche') +
        '</title><style>' + css + '</style></head><body>' + clone.outerHTML + '</body></html>';
      var url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
      var link = document.createElement('a');
      link.href = url;
      link.download = 'samedi-et-dimanche-receipt-' + verifiedReceipt.orderId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) + '.html';
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
      actionStatus.textContent = 'Your HTML receipt is ready. Open the downloaded file in any browser, even offline.';
    } catch (_) {
      actionStatus.textContent = 'The branded download couldn’t be prepared. Check your connection and try again, or use Print receipt to save a PDF.';
    } finally {
      downloading = false;
      downloadButton.disabled = !verifiedReceipt;
    }
  }

  retry.addEventListener('click', loadReceipt);
  printButton.addEventListener('click', function () { if (verifiedReceipt) window.print(); });
  downloadButton.addEventListener('click', downloadReceipt);
  loadReceipt();
})();
