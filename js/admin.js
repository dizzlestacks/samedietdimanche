const productList = document.getElementById('product-list');
const budList = document.getElementById('bud-list');
const editModal = document.getElementById('edit-modal');
const budModal = document.getElementById('bud-modal');
const productForm = document.getElementById('product-form');
const budForm = document.getElementById('bud-form');
const toast = document.getElementById('toast');
const imageInput = document.getElementById('form-image');
const imagePreview = document.getElementById('image-preview');
const imagePlaceholder = document.getElementById('image-placeholder');
const removeImageBtn = document.getElementById('remove-image-btn');
const uploadArea = document.getElementById('image-upload-area');
const budImageInput = document.getElementById('bud-form-image');
const budImagePreview = document.getElementById('bud-image-preview');
const budImagePlaceholder = document.getElementById('bud-image-placeholder');
const budRemoveImageBtn = document.getElementById('bud-remove-image-btn');
const budUploadArea = document.getElementById('bud-image-upload-area');

let products = [];
let budItems = [];
let editingId = null;
let budEditingId = null;
let currentImageUrl = '';
let productPhotos = [];
let photoSession = 0;
let photosUploading = false;
let productSaving = false;
let productVariants = [];

function renderProductVariants() {
  const section = document.getElementById('product-variants');
  section.hidden = editingCategory === 'watch';
  section.disabled = productSaving || section.hidden;
  const list = document.getElementById('product-variant-list');
  list.textContent = '';
  if (!productVariants.length) {
    const empty = document.createElement('p');
    empty.className = 'variant-empty';
    empty.textContent = 'No variants. This piece can be added without choosing a size or color.';
    list.appendChild(empty);
  }
  productVariants.forEach((variant, index) => {
    const row = document.createElement('div');
    row.className = 'product-variant-row';
    ['size', 'color', 'stock'].forEach(key => {
      const label = document.createElement('label');
      label.textContent = key.charAt(0).toUpperCase() + key.slice(1);
      const input = document.createElement('input');
      input.className = 'form-input';
      input.type = key === 'stock' ? 'number' : 'text';
      input.required = true;
      input.value = variant[key];
      if (key === 'stock') { input.min = '0'; input.max = '100000'; input.step = '1'; }
      else input.maxLength = 60;
      input.setAttribute('aria-label', label.textContent + ', variant ' + (index + 1));
      input.addEventListener('input', () => { variant[key] = input.value; input.setCustomValidity(''); });
      label.appendChild(input);
      row.appendChild(label);
    });
    const enabled = document.createElement('label');
    enabled.className = 'variant-enabled';
    const toggle = document.createElement('input');
    toggle.type = 'checkbox'; toggle.checked = variant.active === true;
    toggle.addEventListener('change', () => { variant.active = toggle.checked; });
    enabled.append(toggle, document.createTextNode('Enabled'));
    const remove = document.createElement('button');
    remove.type = 'button'; remove.className = 'action-btn variant-remove'; remove.textContent = 'Remove';
    remove.setAttribute('aria-label', 'Remove variant ' + (index + 1));
    remove.onclick = () => {
      if (productSaving || !confirm('Remove this size and color combination? Existing orders keep their option labels.')) return;
      productVariants.splice(index, 1); renderProductVariants();
    };
    row.append(enabled, remove); list.appendChild(row);
  });
  document.getElementById('product-variant-add').disabled = productSaving || productVariants.length >= 100;
  document.getElementById('product-variants-status').textContent = productVariants.length + ' / 100 variants. Changes apply when you save the product.';
}

document.getElementById('product-variant-add').addEventListener('click', () => {
  if (productSaving || editingCategory === 'watch' || productVariants.length >= 100) return;
  productVariants.push({ size: '', color: '', stock: 0, active: true });
  renderProductVariants();
  document.querySelector('#product-variant-list .product-variant-row:last-child input').focus();
});

function collectProductVariants() {
  if (editingCategory === 'watch') return [];
  if (productVariants.length > 100) throw Error('A product can have up to 100 variants.');
  const combinations = new Set();
  return productVariants.map((variant, index) => {
    const size = String(variant.size || '').trim(), color = String(variant.color || '').trim();
    const stock = Number(variant.stock);
    if (!size || !color || size.length > 60 || color.length > 60)
      throw Error('Variant ' + (index + 1) + ': size and color are required, up to 60 characters each.');
    if (String(variant.stock).trim() === '' || !Number.isInteger(stock) || stock < 0 || stock > 100000)
      throw Error('Variant ' + (index + 1) + ': stock must be a whole number from 0 to 100000.');
    const key = JSON.stringify([size.toLowerCase(), color.toLowerCase()]);
    if (combinations.has(key)) throw Error('Variant ' + (index + 1) + ': this size and color combination is already listed.');
    combinations.add(key);
    const result = { size, color, stock, active: variant.active === true };
    if (variant.id) result.id = variant.id;
    return result;
  });
}
let budCurrentImageUrl = '';
let productSearch = '';
let budSearch = '';

function showToast(message, isError) {
  toast.textContent = message;
  toast.className = 'toast' + (isError ? ' toast-error' : '') + ' toast-visible';
  setTimeout(() => { toast.className = 'toast'; }, 3500);
}

function formatPrice(cents) {
  return '$' + (cents / 100).toFixed(2);
}

function activateTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => {
    const on = p.id === 'tab-' + name;
    p.classList.toggle('active', on);
    p.style.display = on ? 'block' : 'none';
  });
  if (name === 'waitlist' && !waitlistLoaded) loadWaitlist();
  if (name === 'watchpage' && !watchPageLoaded) loadWatchPageSettings();
  if (name === 'orders' && !ordersLoaded) loadOrders();
  if (name === 'reviews' && !reviewsLoaded) loadAdminReviews();
  if (name === 'marketing' && !marketingLoaded) initMarketing();
  if (name === 'sitesettings' && !siteSettingsLoaded) loadSiteSettingsTab();
  if (name === 'homepage' && !homepageLinksLoaded) loadHomepageLinks();
  if (name === 'socials' && !socialLinksLoaded) loadSocialLinks();
}
let ordersLoaded = false, reviewsLoaded = false, marketingLoaded = false;
let siteSettingsLoaded = false;

async function loadSiteSettingsTab() {
  try {
    const response = await fetch('/api/admin/site-settings', { credentials: 'include', cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load settings');
    const s = await response.json();
    document.getElementById('ss-sales-tax-enabled').checked = s.salesTaxEnabled !== false;
    document.getElementById('wp-announce-enabled').checked = Boolean(s.announcementEnabled);
    document.getElementById('wp-announce-text').value = s.announcementText || '';
    document.getElementById('wp-weekend-theme').checked = s.weekendThemeEnabled !== false;
    document.getElementById('wp-bundles-enabled').checked = Boolean(s.bundlesEnabled);
    const bundlesList = document.getElementById('wp-bundles-list');
    bundlesList.innerHTML = '';
    (s.bundles || []).forEach(b => bundlesList.appendChild(wpBundleRow(b)));
    document.getElementById('wp-instagram').value = s.instagramUrl || '';
    document.getElementById('ws-bud-enabled').checked = s.budWaitlistEnabled !== false;
    document.getElementById('ws-bud-headline').value = s.budWaitlistHeadline || '';
    document.getElementById('ws-bud-sub').value = s.budWaitlistSub || '';
    document.getElementById('ws-bud-button').value = s.budWaitlistButton || '';
    document.getElementById('ws-watches-enabled').checked = s.watchesWaitlistEnabled !== false;
    document.getElementById('ws-watches-button').value = s.watchesWaitlistButton || '';
    siteSettingsLoaded = true;
  } catch (e) {
    showToast('Could not load settings', true);
  }
}

document.getElementById('sitesettings-save-btn').addEventListener('click', async () => {
  if (!siteSettingsLoaded) { showToast('Load Settings before saving. Reopen this tab to retry.', true); return; }
  try {
    const res = await fetch('/api/admin/site-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        salesTaxEnabled: document.getElementById('ss-sales-tax-enabled').checked,
        announcementEnabled: document.getElementById('wp-announce-enabled').checked,
        announcementText: document.getElementById('wp-announce-text').value.trim(),
        weekendThemeEnabled: document.getElementById('wp-weekend-theme').checked,
        bundlesEnabled: document.getElementById('wp-bundles-enabled').checked,
        bundles: [...document.querySelectorAll('#wp-bundles-list .wp-bundle-row')].map(row => ({
          name: row.querySelector('.wp-bundle-name').value.trim(),
          note: row.querySelector('.wp-bundle-note').value.trim(),
          priceIds: row.querySelector('.wp-bundle-prices').value.split(',').map(x => x.trim()).filter(Boolean),
        })).filter(b => b.name && b.priceIds.length >= 2),
        instagramUrl: document.getElementById('wp-instagram').value.trim(),
        budWaitlistEnabled: document.getElementById('ws-bud-enabled').checked,
        budWaitlistHeadline: document.getElementById('ws-bud-headline').value.trim(),
        budWaitlistSub: document.getElementById('ws-bud-sub').value.trim(),
        budWaitlistButton: document.getElementById('ws-bud-button').value.trim(),
        watchesWaitlistEnabled: document.getElementById('ws-watches-enabled').checked,
        watchesWaitlistButton: document.getElementById('ws-watches-button').value.trim(),
      }),
    });
    if (!res.ok) throw new Error('Save failed');
    const saved = await res.json();
    if (window.offerWatchAnnouncements) window.offerWatchAnnouncements(saved.announcementDrafts);
    showToast('Settings saved');
  } catch (e) {
    showToast('Could not save settings', true);
  }
});

// ── Homepage links tab ─────────────────────────────────────
let homepageLinksLoaded = false;
let homepageLinks = [];

async function loadHomepageLinks() {
  try {
    const s = await (await fetch('/api/site-settings')).json();
    homepageLinksLoaded = true;
    homepageLinks = Array.isArray(s.homepageLinks) ? s.homepageLinks : [];
    renderHomepageLinks();
  } catch (e) {
    document.getElementById('hl-list').innerHTML = '<p class="loading-text">Failed to load links</p>';
  }
}

function renderHomepageLinks() {
  const list = document.getElementById('hl-list');
  list.innerHTML = '';
  if (homepageLinks.length === 0) {
    list.innerHTML = '<p class="loading-text">No links yet. Click "+ Add Link" to create one.</p>';
    return;
  }
  homepageLinks.forEach((link, i) => {
    const row = document.createElement('div');
    row.className = 'product-row' + (link.enabled === false ? ' product-inactive' : '');
    row.style.gap = '0.6rem';
    row.style.flexWrap = 'wrap';
    row.innerHTML =
      '<label class="wp-mode-option" style="margin:0" title="Show on homepage">' +
        '<input type="checkbox" class="hl-enabled" aria-label="Show this link on homepage"' + (link.enabled !== false ? ' checked' : '') + '>' +
      '</label>' +
      '<input type="text" class="form-input hl-label" placeholder="Name" maxlength="60" style="flex:1;min-width:110px">' +
      '<input type="text" class="form-input hl-sublabel" placeholder="Sublabel (optional)" maxlength="100" style="flex:1.4;min-width:150px">' +
      '<input type="text" class="form-input hl-url" placeholder="URL (e.g. shop.html or https://...)" maxlength="500" style="flex:1.6;min-width:170px">' +
      '<div class="row-actions">' +
        '<button class="action-btn hl-up" title="Move up"' + (i === 0 ? ' disabled' : '') + '>&uarr;</button>' +
        '<button class="action-btn hl-down" title="Move down"' + (i === homepageLinks.length - 1 ? ' disabled' : '') + '>&darr;</button>' +
        '<button class="action-btn hl-delete" title="Delete" style="border-color:rgba(200,80,80,0.3)">&times;</button>' +
      '</div>';
    row.querySelector('.hl-label').value = link.label || '';
    row.querySelector('.hl-sublabel').value = link.sublabel || '';
    row.querySelector('.hl-url').value = link.url || '';
    row.querySelector('.hl-label').addEventListener('input', e => { link.label = e.target.value; });
    row.querySelector('.hl-sublabel').addEventListener('input', e => { link.sublabel = e.target.value; });
    row.querySelector('.hl-url').addEventListener('input', e => { link.url = e.target.value; });
    row.querySelector('.hl-enabled').addEventListener('change', e => {
      link.enabled = e.target.checked;
      row.classList.toggle('product-inactive', !link.enabled);
    });
    row.querySelector('.hl-up').addEventListener('click', () => {
      homepageLinks.splice(i - 1, 0, homepageLinks.splice(i, 1)[0]);
      renderHomepageLinks();
    });
    row.querySelector('.hl-down').addEventListener('click', () => {
      homepageLinks.splice(i + 1, 0, homepageLinks.splice(i, 1)[0]);
      renderHomepageLinks();
    });
    row.querySelector('.hl-delete').addEventListener('click', () => {
      if (!confirm('Delete "' + (link.label || 'this link') + '" from the homepage?')) return;
      homepageLinks.splice(i, 1);
      renderHomepageLinks();
    });
    list.appendChild(row);
  });
}

document.getElementById('hl-add-btn').addEventListener('click', () => {
  if (!homepageLinksLoaded) return;
  homepageLinks.push({ label: '', sublabel: '', url: '', enabled: true });
  renderHomepageLinks();
  const rows = document.querySelectorAll('#hl-list .hl-label');
  if (rows.length) rows[rows.length - 1].focus();
});

document.getElementById('hl-save-btn').addEventListener('click', async () => {
  const invalid = homepageLinks.find(l => !String(l.label || '').trim() || !String(l.url || '').trim());
  if (invalid) { showToast('Every link needs a name and a URL', true); return; }
  try {
    const res = await fetch('/api/admin/site-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ homepageLinks }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Save failed');
    homepageLinks = Array.isArray(data.homepageLinks) ? data.homepageLinks : homepageLinks;
    renderHomepageLinks();
    showToast('Homepage links saved');
  } catch (e) {
    showToast(e.message || 'Could not save links', true);
  }
});

// ── Socials tab ────────────────────────────────────────────
let socialLinksLoaded = false;
let socialLinks = [];

async function loadSocialLinks() {
  try {
    const s = await (await fetch('/api/site-settings')).json();
    socialLinksLoaded = true;
    socialLinks = Array.isArray(s.socialLinks) ? s.socialLinks : [];
    renderSocialLinks();
  } catch (e) {
    document.getElementById('sl-list').innerHTML = '<p class="loading-text">Failed to load socials</p>';
  }
}

function renderSocialLinks() {
  const list = document.getElementById('sl-list');
  list.innerHTML = '';
  if (socialLinks.length === 0) {
    list.innerHTML = '<p class="loading-text">No socials yet. Click "+ Add Social" to create one.</p>';
    return;
  }
  socialLinks.forEach((link, i) => {
    const row = document.createElement('div');
    row.className = 'product-row' + (link.enabled === false ? ' product-inactive' : '');
    row.style.gap = '0.6rem';
    row.style.flexWrap = 'wrap';
    row.innerHTML =
      '<label class="wp-mode-option" style="margin:0" title="Show on socials page">' +
        '<input type="checkbox" class="sl-enabled" aria-label="Show this link on socials page"' + (link.enabled !== false ? ' checked' : '') + '>' +
      '</label>' +
      '<input type="text" class="form-input sl-label" placeholder="Name (e.g. Instagram)" maxlength="60" style="flex:1;min-width:110px">' +
      '<input type="text" class="form-input sl-sublabel" placeholder="Handle (e.g. @samedietdimanche.ca)" maxlength="100" style="flex:1.4;min-width:150px">' +
      '<input type="text" class="form-input sl-url" placeholder="URL (https://...)" maxlength="500" style="flex:1.6;min-width:170px">' +
      '<div class="row-actions">' +
        '<button class="action-btn sl-up" title="Move up"' + (i === 0 ? ' disabled' : '') + '>&uarr;</button>' +
        '<button class="action-btn sl-down" title="Move down"' + (i === socialLinks.length - 1 ? ' disabled' : '') + '>&darr;</button>' +
        '<button class="action-btn sl-delete" title="Delete" style="border-color:rgba(200,80,80,0.3)">&times;</button>' +
      '</div>';
    row.querySelector('.sl-label').value = link.label || '';
    row.querySelector('.sl-sublabel').value = link.sublabel || '';
    row.querySelector('.sl-url').value = link.url || '';
    row.querySelector('.sl-label').addEventListener('input', e => { link.label = e.target.value; });
    row.querySelector('.sl-sublabel').addEventListener('input', e => { link.sublabel = e.target.value; });
    row.querySelector('.sl-url').addEventListener('input', e => { link.url = e.target.value; });
    row.querySelector('.sl-enabled').addEventListener('change', e => {
      link.enabled = e.target.checked;
      row.classList.toggle('product-inactive', !link.enabled);
    });
    row.querySelector('.sl-up').addEventListener('click', () => {
      socialLinks.splice(i - 1, 0, socialLinks.splice(i, 1)[0]);
      renderSocialLinks();
    });
    row.querySelector('.sl-down').addEventListener('click', () => {
      socialLinks.splice(i + 1, 0, socialLinks.splice(i, 1)[0]);
      renderSocialLinks();
    });
    row.querySelector('.sl-delete').addEventListener('click', () => {
      if (!confirm('Delete "' + (link.label || 'this social') + '"?')) return;
      socialLinks.splice(i, 1);
      renderSocialLinks();
    });
    list.appendChild(row);
  });
}

document.getElementById('sl-add-btn').addEventListener('click', () => {
  if (!socialLinksLoaded) return;
  socialLinks.push({ label: '', sublabel: '', url: '', enabled: true });
  renderSocialLinks();
  const rows = document.querySelectorAll('#sl-list .sl-label');
  if (rows.length) rows[rows.length - 1].focus();
});

document.getElementById('sl-save-btn').addEventListener('click', async () => {
  const invalid = socialLinks.find(l => !String(l.label || '').trim() || !String(l.url || '').trim());
  if (invalid) { showToast('Every social needs a name and a URL', true); return; }
  try {
    const res = await fetch('/api/admin/site-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ socialLinks }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Save failed');
    socialLinks = Array.isArray(data.socialLinks) ? data.socialLinks : socialLinks;
    renderSocialLinks();
    showToast('Socials saved');
  } catch (e) {
    showToast(e.message || 'Could not save socials', true);
  }
});

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => activateTab(btn.dataset.tab));
});

document.querySelectorAll('[data-jump]').forEach(btn => {
  btn.addEventListener('click', () => activateTab(btn.dataset.jump));
});

function setImagePreview(url) {
  currentImageUrl = url || '';
  if (url) {
    imagePreview.src = url;
    imagePreview.style.display = 'block';
    imagePlaceholder.style.display = 'none';
    removeImageBtn.style.display = 'inline-block';
  } else {
    imagePreview.removeAttribute('src');
    imagePreview.style.display = 'none';
    imagePlaceholder.style.display = 'flex';
    removeImageBtn.style.display = 'none';
  }
}

// Product photos are ordered. Never save local previews, pending uploads or failures.
function resetProductPhotos(urls) {
  photoSession++;
  productPhotos.forEach(photo => { if (photo.preview) URL.revokeObjectURL(photo.preview); });
  productPhotos = (Array.isArray(urls) ? urls : []).filter(url => typeof url === 'string' && url.trim()).slice(0, 12).map(url => ({ url, state: 'ready' }));
  photosUploading = false;
  imageInput.value = '';
  renderProductPhotos();
}

function renderProductPhotos() {
  const list = document.getElementById('product-photo-list');
  const status = document.getElementById('product-images-status');
  const pending = productPhotos.filter(photo => photo.state === 'pending').length;
  const failed = productPhotos.filter(photo => photo.state === 'failed').length;
  setImagePreview(productPhotos[0]?.url || '');
  imagePreview.alt = 'Current cover photograph';
  imagePreview.onerror = () => {
    imagePreview.style.display = 'none';
    imagePlaceholder.style.display = 'flex';
  };
  imagePlaceholder.querySelector('.upload-text').textContent = photosUploading ? 'Uploading photographs…' : 'Click to add photographs';
  imageInput.disabled = photosUploading || productSaving || productPhotos.length >= 12;
  removeImageBtn.disabled = photosUploading || productSaving;
  document.getElementById('save-btn').disabled = photosUploading || pending > 0 || failed > 0 || productSaving;
  status.textContent = productPhotos.length + ' / 12 photographs. ' +
    (pending ? pending + ' uploading. ' : '') +
    (failed ? failed + ' failed — retry or remove failed photographs before saving. ' : '') +
    (!productPhotos.length ? 'No photographs yet. ' : '') +
    'First photograph is the cover. Use the arrows to reorder; Set cover moves a photograph to first.';
  list.textContent = '';
  productPhotos.forEach((photo, index) => {
    const item = document.createElement('div');
    item.className = 'product-photo-item';
    const image = document.createElement('img');
    image.src = photo.url || photo.preview;
    image.alt = 'Product photograph ' + (index + 1);
    item.appendChild(image);
    image.onerror = () => { image.hidden = true; caption.textContent += ' · Preview unavailable'; };
    const caption = document.createElement('p');
    caption.className = 'product-photo-caption';
    caption.textContent = (index === 0 ? 'Cover · ' : 'Photo ' + (index + 1) + ' · ') +
      (photo.state === 'pending' ? 'Uploading…' : photo.state === 'failed' ? photo.error : 'Ready');
    item.appendChild(caption);
    const controls = document.createElement('div');
    controls.className = 'product-photo-controls';
    function action(label, handler, disabled) {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.textContent = label; btn.disabled = productSaving || disabled;
      btn.addEventListener('click', handler); controls.appendChild(btn);
      return btn;
    }
    action('←', () => {
      productPhotos.splice(index - 1, 0, productPhotos.splice(index, 1)[0]); renderProductPhotos();
    }, index === 0 || photosUploading).setAttribute('aria-label', 'Move photograph ' + (index + 1) + ' earlier');
    action('→', () => {
      productPhotos.splice(index + 1, 0, productPhotos.splice(index, 1)[0]); renderProductPhotos();
    }, index === productPhotos.length - 1 || photosUploading).setAttribute('aria-label', 'Move photograph ' + (index + 1) + ' later');
    action(index === 0 ? 'Cover' : 'Set cover', () => {
      productPhotos.unshift(productPhotos.splice(index, 1)[0]); renderProductPhotos();
    }, index === 0 || photosUploading || photo.state !== 'ready');
    if (photo.state === 'failed') action('Retry', () => uploadProductPhotos([photo]), photosUploading);
    action('Remove', () => {
      if (photo.preview) URL.revokeObjectURL(photo.preview);
      productPhotos = productPhotos.filter(entry => entry !== photo); renderProductPhotos();
    }, photosUploading);
    item.appendChild(controls); list.appendChild(item);
  });
}

async function uploadProductPhotos(photos) {
  if (photosUploading || productSaving) return;
  const session = photoSession;
  photosUploading = true;
  photos.forEach(photo => { photo.state = 'pending'; photo.error = ''; });
  renderProductPhotos();
  for (const photo of photos) {
    if (session !== photoSession) break;
    try {
      if (!photo.file || !/^image\//i.test(photo.file.type)) throw Error('Select an image file.');
      const body = new FormData(); body.append('image', photo.file);
      const res = await fetch('/api/admin/upload', { method: 'POST', credentials: 'include', body });
      let data;
      try { data = await res.json(); } catch (_) { throw Error('Upload response unavailable. Retry or remove.'); }
      if (!res.ok || typeof data.url !== 'string' || !data.url.trim()) throw Error(data.error || 'Upload failed. Retry or remove.');
      if (session !== photoSession) break;
      photo.url = data.url; photo.state = 'ready';
      if (photo.preview) { URL.revokeObjectURL(photo.preview); photo.preview = ''; }
      photo.file = null;
    } catch (err) {
      if (session !== photoSession) break;
      photo.state = 'failed'; photo.error = err.message || 'Upload failed. Retry or remove.';
    }
    if (session === photoSession) renderProductPhotos();
  }
  if (session === photoSession) { photosUploading = false; renderProductPhotos(); }
}

function setBudImagePreview(url) {
  budCurrentImageUrl = url || '';
  if (url) {
    budImagePreview.src = url;
    budImagePreview.style.display = 'block';
    budImagePlaceholder.style.display = 'none';
    budRemoveImageBtn.style.display = 'inline-block';
  } else {
    budImagePreview.src = '';
    budImagePreview.style.display = 'none';
    budImagePlaceholder.style.display = 'flex';
    budRemoveImageBtn.style.display = 'none';
  }
}

async function handleImageUpload(file, callback) {
  try {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch('/api/admin/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (res.ok && data.url) {
      callback(data.url);
      showToast('Image uploaded');
    } else {
      showToast(data.error || 'Upload failed', true);
    }
  } catch (err) {
    showToast('Upload failed', true);
  }
}

imageInput.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files || []);
  imageInput.value = '';
  if (!files.length || photosUploading || productSaving) return;
  if (productPhotos.length + files.length > 12) { showToast('Up to 12 photographs per product. Select fewer files or remove a photograph.', true); return; }
  const additions = files.map(file => ({ file, preview: URL.createObjectURL(file), url: '', state: 'pending' }));
  productPhotos.push(...additions);
  await uploadProductPhotos(additions);
});

removeImageBtn.addEventListener('click', () => {
  if (photosUploading || productSaving || !productPhotos.length) return;
  const photo = productPhotos.shift();
  if (photo.preview) URL.revokeObjectURL(photo.preview);
  renderProductPhotos();
});

budImageInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const uploadText = budImagePlaceholder.querySelector('.upload-text');
  uploadText.textContent = 'Uploading...';
  await handleImageUpload(file, setBudImagePreview);
  uploadText.textContent = 'Click to upload image';
  budImageInput.value = '';
});

budRemoveImageBtn.addEventListener('click', () => setBudImagePreview(''));

function productRow(product) {
    const price = product.prices.find(p => p.active !== false);
    const badge = product.metadata?.badge || '';
    const isActive = product.active;
    const thumb = product.images && product.images[0];
    const row = document.createElement('div');
    row.className = 'product-row' + (isActive ? '' : ' product-inactive');
    row.innerHTML =
      (thumb ? '<img alt="" class="row-thumb">' : '<div class="row-thumb-empty"></div>') +
      '<div class="row-info">' +
        '<div class="row-name">' + escapeHtml(product.name) +
          (badge ? ' <span class="row-badge">' + escapeHtml(badge) + '</span>' : '') +
          (!isActive ? ' <span class="row-status">Inactive</span>' : '') +
        '</div>' +
        '<div class="row-description">' + escapeHtml(product.description || 'No description') + '</div>' +
      '</div>' +
      '<div class="row-price">' + (price ? formatPrice(price.unit_amount) : '—') + '</div>' +
      '<div class="row-actions">' +
        '<button class="action-btn edit-btn">Edit</button>' +
        (isActive
          ? '<button class="action-btn deactivate-btn">Deactivate</button>'
          : '<button class="action-btn activate-btn">Activate</button>') +
      '</div>';
    if (thumb) row.querySelector('.row-thumb').src = thumb;
    row.querySelector('.edit-btn').addEventListener('click', () => openEdit(product));
    const toggleBtn = row.querySelector('.deactivate-btn') || row.querySelector('.activate-btn');
    toggleBtn.addEventListener('click', () => toggleProduct(product.id, !isActive));
  return row;
}

function renderProducts() {
  const q = productSearch.trim().toLowerCase();
  const items = products.filter(p => (p.category || 'shop') !== 'watch').filter(p => !q ||
    (p.name || '').toLowerCase().includes(q) ||
    (p.description || '').toLowerCase().includes(q));
  productList.innerHTML = '';
  if (items.length === 0) {
    productList.innerHTML = '<p class="loading-text">' +
      (q ? 'No products match your search.' : 'No products yet. Click "+ Add Product" to create one.') +
      '</p>';
  } else {
    items.forEach(product => productList.appendChild(productRow(product)));
  }
}

let editingCategory = 'shop';
let editingInventoryRevision;

function openEdit(product, category) {
  if (productSaving) return;
  editingId = product ? product.id : null;
  editingInventoryRevision = product?.inventoryRevision;
  editingCategory = product ? (product.category || 'shop') : (category === 'watch' ? 'watch' : 'shop');
  const isWatch = editingCategory === 'watch';
  productVariants = (Array.isArray(product?.variants) ? product.variants : []).map(variant => ({
    id: variant.id, size: variant.size, color: variant.color, stock: variant.stock, active: variant.active === true
  }));
  renderProductVariants();
  document.getElementById('modal-title').textContent = product
    ? (isWatch ? 'Edit Watch Product' : 'Edit Product')
    : (isWatch ? 'Add Watch Product' : 'Add Product');
  document.getElementById('form-id').value = product ? product.id : '';
  document.getElementById('form-name').value = product ? product.name : '';
  document.getElementById('form-description').value = product ? (product.description || '') : '';
  const price = product ? product.prices.find(p => p.active !== false) : null;
  document.getElementById('form-price').value = price ? (price.unit_amount / 100).toFixed(2) : '';
  document.getElementById('form-badge').value = product?.metadata?.badge || '';
  resetProductPhotos(Array.isArray(product?.images) ? product.images : (product?.image ? [product.image] : []));
  document.getElementById('save-btn').textContent = product ? 'Save Changes' : 'Create Product';
  editModal.style.display = 'flex';
  requestAnimationFrame(() => editModal.classList.add('modal-active'));
}

function closeModal() {
  if (productSaving) { showToast('Please wait while this product saves.', true); return; }
  resetProductPhotos([]);
  productVariants = [];
  editModal.classList.remove('modal-active');
  setTimeout(() => { editModal.style.display = 'none'; }, 300);
  editingId = null;
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('cancel-btn').addEventListener('click', closeModal);
editModal.addEventListener('click', (e) => { if (e.target === editModal) closeModal(); });
document.getElementById('add-btn').addEventListener('click', () => {
  openEdit(null, 'shop');
});

productForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (productSaving) return;
  if (photosUploading || productPhotos.some(photo => photo.state !== 'ready')) {
    showToast('Finish uploads, then retry or remove failed photographs before saving.', true);
    return;
  }
  let variants;
  try { variants = collectProductVariants(); }
  catch (err) {
    document.getElementById('product-variants-status').textContent = err.message;
    showToast(err.message, true); return;
  }
  productSaving = true;
  document.getElementById('product-variants').disabled = true;
  renderProductPhotos();
  const saveBtn = document.getElementById('save-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';
  const name = document.getElementById('form-name').value;
  const description = document.getElementById('form-description').value;
  const price = document.getElementById('form-price').value;
  const badge = document.getElementById('form-badge').value;
  const images = productPhotos.map(photo => photo.url);
  const image = images[0] || '';
  try {
    let res;
    if (editingId) {
      res = await fetch('/api/admin/products/' + editingId, {
        method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, price: Number(price), badge, image, images, category: editingCategory, ...(editingCategory === 'watch' ? {} : { variants, inventoryRevision: editingInventoryRevision }) }),
      });
    } else {
      res = await fetch('/api/admin/products', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, price: Number(price), badge, image, images, category: editingCategory, ...(editingCategory === 'watch' ? {} : { variants }) }),
      });
    }
    const data = await res.json();
    if (res.ok) {
      showToast(editingId ? 'Product updated' : 'Product created');
      productSaving = false;
      closeModal();
      loadProducts();
    } else {
      if (res.status === 409) await loadProducts();
      showToast(data.error || 'Something went wrong', true);
    }
  } catch (err) {
    showToast('Connection error', true);
  }
  productSaving = false;
  document.getElementById('product-variants').disabled = editingCategory === 'watch';
  renderProductPhotos();
  saveBtn.textContent = editingId ? 'Save Changes' : 'Create Product';
});

async function toggleProduct(id, active) {
  try {
    const res = await fetch('/api/admin/products/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });
    if (res.ok) {
      showToast(active ? 'Product activated' : 'Product deactivated');
      loadProducts();
    } else {
      showToast('Failed to update product', true);
    }
  } catch (err) {
    showToast('Connection error', true);
  }
}


async function loadProducts() {
  try {
    const res = await fetch('/api/admin/products');
    const data = await res.json();
    products = data.data || [];
    renderProducts();
    renderDashboard();
  } catch (err) {
    productList.innerHTML = '<p class="loading-text">Failed to load products</p>';
  }
}

function getStrainClass(strain) {
  if (strain === 'Sativa') return 'strain-sativa';
  if (strain === 'Indica') return 'strain-indica';
  return 'strain-hybrid';
}

function renderBudItems() {
  const q = budSearch.trim().toLowerCase();
  const items = budItems.filter(i => !q ||
    (i.name || '').toLowerCase().includes(q) ||
    (i.category || '').toLowerCase().includes(q) ||
    (i.strain || '').toLowerCase().includes(q));
  budList.innerHTML = '';
  if (items.length === 0) {
    budList.innerHTML = '<p class="loading-text">' +
      (q ? 'No items match your search.' : 'No menu items yet. Click "+ Add Item" to create one.') +
      '</p>';
    return;
  }
  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'product-row' + (item.active ? '' : ' product-inactive');
    row.innerHTML =
      (item.image ? '<img src="' + item.image + '" alt="" class="row-thumb">' : '<div class="row-thumb-empty"></div>') +
      '<div class="row-info">' +
        '<div class="row-name">' + item.name +
          ' <span class="strain-badge-row ' + getStrainClass(item.strain) + '">' + item.strain + '</span>' +
          '<span class="category-tag">' + item.category + '</span>' +
          (!item.active ? ' <span class="row-status">Inactive</span>' : '') +
        '</div>' +
        '<div class="row-description">' + (item.description || 'No description') + '</div>' +
      '</div>' +
      '<div class="row-price">' + (item.price || '—') + '</div>' +
      '<div class="row-actions">' +
        '<button class="action-btn edit-btn">Edit</button>' +
        (item.active
          ? '<button class="action-btn deactivate-btn">Deactivate</button>'
          : '<button class="action-btn activate-btn">Activate</button>') +
        '<button class="action-btn deactivate-btn" style="border-color:rgba(200,80,80,0.3)">Delete</button>' +
      '</div>';
    row.querySelector('.edit-btn').addEventListener('click', () => openBudEdit(item));
    const toggleBtn = row.querySelectorAll('.action-btn')[1];
    toggleBtn.addEventListener('click', () => toggleBudItem(item.id, !item.active));
    const deleteBtn = row.querySelectorAll('.action-btn')[2];
    deleteBtn.addEventListener('click', () => deleteBudItem(item.id, item.name));
    budList.appendChild(row);
  });
}

function openBudEdit(item) {
  budEditingId = item ? item.id : null;
  document.getElementById('bud-modal-title').textContent = item ? 'Edit Menu Item' : 'Add Menu Item';
  document.getElementById('bud-form-id').value = item ? item.id : '';
  document.getElementById('bud-form-name').value = item ? item.name : '';
  document.getElementById('bud-form-strain').value = item ? item.strain : 'Hybrid';
  document.getElementById('bud-form-category').value = item ? item.category : 'flower';
  document.getElementById('bud-form-price').value = item ? item.price : '';
  document.getElementById('bud-form-description').value = item ? (item.description || '') : '';
  document.getElementById('bud-form-thc').value = item ? item.thc : '';
  document.getElementById('bud-form-cbd').value = item ? item.cbd : '';
  document.getElementById('bud-form-weight').value = item ? item.weight : '';
  document.getElementById('bud-form-terpenes').value = item ? item.terpenes : '';
  document.getElementById('bud-form-effects').value = item ? (item.effects || []).join(', ') : '';
  setBudImagePreview(item ? item.image : '');
  document.getElementById('bud-save-btn').textContent = item ? 'Save Changes' : 'Create Item';
  budModal.style.display = 'flex';
  requestAnimationFrame(() => budModal.classList.add('modal-active'));
}

function closeBudModal() {
  budModal.classList.remove('modal-active');
  setTimeout(() => { budModal.style.display = 'none'; }, 300);
  budEditingId = null;
}

document.getElementById('bud-modal-close').addEventListener('click', closeBudModal);
document.getElementById('bud-cancel-btn').addEventListener('click', closeBudModal);
budModal.addEventListener('click', (e) => { if (e.target === budModal) closeBudModal(); });
document.getElementById('bud-add-btn').addEventListener('click', () => openBudEdit(null));

budForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const saveBtn = document.getElementById('bud-save-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  const payload = {
    name: document.getElementById('bud-form-name').value,
    strain: document.getElementById('bud-form-strain').value,
    category: document.getElementById('bud-form-category').value,
    price: document.getElementById('bud-form-price').value,
    description: document.getElementById('bud-form-description').value,
    thc: document.getElementById('bud-form-thc').value,
    cbd: document.getElementById('bud-form-cbd').value,
    weight: document.getElementById('bud-form-weight').value,
    terpenes: document.getElementById('bud-form-terpenes').value,
    effects: document.getElementById('bud-form-effects').value.split(',').map(s => s.trim()).filter(Boolean),
    image: budCurrentImageUrl,
  };

  try {
    let res;
    if (budEditingId) {
      res = await fetch('/api/admin/bud-menu/' + budEditingId, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      res = await fetch('/api/admin/bud-menu', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    const data = await res.json();
    if (res.ok) {
      showToast(budEditingId ? 'Item updated' : 'Item created');
      closeBudModal();
      loadBudItems();
    } else {
      showToast(data.error || 'Something went wrong', true);
    }
  } catch (err) {
    showToast('Connection error', true);
  }
  saveBtn.disabled = false;
  saveBtn.textContent = budEditingId ? 'Save Changes' : 'Create Item';
});

async function toggleBudItem(id, active) {
  try {
    const res = await fetch('/api/admin/bud-menu/' + id, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });
    if (res.ok) {
      showToast(active ? 'Item activated' : 'Item deactivated');
      loadBudItems();
    } else {
      showToast('Failed to update item', true);
    }
  } catch (err) {
    showToast('Connection error', true);
  }
}

async function deleteBudItem(id, name) {
  if (!confirm('Delete "' + name + '" permanently?')) return;
  try {
    const res = await fetch('/api/admin/bud-menu/' + id, { method: 'DELETE' });
    if (res.ok) {
      showToast('Item deleted');
      loadBudItems();
    } else {
      showToast('Failed to delete item', true);
    }
  } catch (err) {
    showToast('Connection error', true);
  }
}

const shopOpenToggle = document.getElementById('shop-open-toggle');
if (shopOpenToggle) {
  fetch('/api/site-settings')
    .then(r => r.json())
    .then(s => { shopOpenToggle.checked = s.shopEnabled !== false; })
    .catch(() => {});
  shopOpenToggle.addEventListener('change', async () => {
    try {
      const res = await fetch('/api/admin/site-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopEnabled: shopOpenToggle.checked }),
      });
      if (!res.ok) throw new Error();
      showToast(shopOpenToggle.checked
        ? 'Shop is now open'
        : 'Shop page now shows "coming soon"');
    } catch (e) {
      shopOpenToggle.checked = !shopOpenToggle.checked;
      showToast('Could not save — try again', true);
    }
  });
}

// Settings tab: show/hide the Bud link on the homepage entirely.
const showBudToggle = document.getElementById('ws-show-bud');
if (showBudToggle) {
  fetch('/api/site-settings')
    .then(r => r.json())
    .then(s => {
      const links = Array.isArray(s.homepageLinks) ? s.homepageLinks : [];
      const bud = links.find(l => l && /bud\.html$/.test(String(l.url || '')));
      showBudToggle.checked = !bud || bud.enabled !== false;
    })
    .catch(() => {});
  showBudToggle.addEventListener('change', async () => {
    try {
      const sRes = await fetch('/api/site-settings');
      const s = await sRes.json();
      const links = Array.isArray(s.homepageLinks) ? s.homepageLinks : [];
      let found = false;
      const updated = links.map(l => {
        if (l && /bud\.html$/.test(String(l.url || ''))) { found = true; return { ...l, enabled: showBudToggle.checked }; }
        return l;
      });
      if (!found) updated.push({ label: 'Bud', sublabel: 'The Bud Collection', url: 'bud.html', enabled: showBudToggle.checked });
      const res = await fetch('/api/admin/site-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homepageLinks: updated }),
      });
      if (!res.ok) throw new Error();
      showToast(showBudToggle.checked ? 'Bud is visible on the homepage' : 'Bud hidden from the homepage');
      if (typeof loadHomepageLinks === 'function') loadHomepageLinks();
    } catch (e) {
      showBudToggle.checked = !showBudToggle.checked;
      showToast('Could not save — try again', true);
    }
  });
}

const budWaitlistToggle = document.getElementById('bud-waitlist-toggle');
if (budWaitlistToggle) {
  // Load the current mode once, then save on every change.
  fetch('/api/site-settings')
    .then(r => r.json())
    .then(s => { budWaitlistToggle.checked = s.budWaitlistEnabled !== false; })
    .catch(() => {});
  budWaitlistToggle.addEventListener('change', async () => {
    try {
      const res = await fetch('/api/admin/site-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budWaitlistEnabled: budWaitlistToggle.checked }),
      });
      if (!res.ok) throw new Error();
      showToast(budWaitlistToggle.checked
        ? 'Bud page set to waitlist mode'
        : 'Bud page now shows the menu');
      const ws = document.getElementById('ws-bud-enabled');
      if (ws) ws.checked = budWaitlistToggle.checked;
    } catch (e) {
      budWaitlistToggle.checked = !budWaitlistToggle.checked;
      showToast('Could not save — try again', true);
    }
  });
}

async function loadBudItems() {
  try {
    const res = await fetch('/api/admin/bud-menu');
    if (!res.ok) throw new Error('Server returned ' + res.status);
    const data = await res.json();
    budItems = data.data || [];
    renderBudItems();
    renderDashboard();
  } catch (err) {
    budList.innerHTML = '<p class="loading-text">Failed to load menu items</p>';
  }
}

const productSearchInput = document.getElementById('product-search');
if (productSearchInput) {
  productSearchInput.addEventListener('input', (e) => { productSearch = e.target.value; renderProducts(); });
}
const budSearchInput = document.getElementById('bud-search');
if (budSearchInput) {
  budSearchInput.addEventListener('input', (e) => { budSearch = e.target.value; renderBudItems(); });
}

function renderDashboard() {
  const stats = document.getElementById('dashboard-stats');
  if (!stats) return;
  const setText = (id, v) => { const n = document.getElementById(id); if (n) n.textContent = v; };
  setText('stat-wl-total', waitlistEntries.length);
  const watches = waitlistEntries.filter(e => e.category === 'watches').length;
  const bud = waitlistEntries.filter(e => e.category === 'bud').length;
  setText('stat-wl-breakdown', watches + ' watches · ' + bud + ' bud');
}

// ─── Overview at-a-glance (orders & reviews) ─────────────
(async function loadOverviewGlance() {
  const setText = (id, v) => { const n = document.getElementById(id); if (n) n.textContent = v; };
  try {
    const res = await fetch('/api/admin/orders');
    if (!res.ok) throw new Error('Orders returned ' + res.status);
    const data = await res.json();
    if (data.paymentEnabled === false && !(data.data || []).length) {
      setText('stat-orders', '0');
      setText('stat-orders-sub', 'Payments are off');
    } else {
      const orders = data.data || [];
      setText('stat-orders', orders.length);
      setText('stat-orders-sub', formatPrice(data.revenue || 0) + ' revenue');
    }
  } catch (e) {
    setText('stat-orders-sub', 'Could not load orders');
  }
  try {
    const res = await fetch('/api/admin/reviews');
    if (!res.ok) throw new Error('Reviews returned ' + res.status);
    const data = await res.json();
    const reviews = data.data || [];
    const pending = reviews.filter(r => !r.approved).length;
    setText('stat-reviews-pending', pending);
    setText('stat-reviews-sub', reviews.length + ' total review' + (reviews.length === 1 ? '' : 's'));
  } catch (e) {
    setText('stat-reviews-sub', 'Could not load reviews');
  }
})();

// ─── Waitlist ────────────────────────────────────────────
const waitlistList = document.getElementById('waitlist-list');
const waitlistCount = document.getElementById('waitlist-count');
const waitlistExportBtn = document.getElementById('waitlist-export-btn');
let waitlistEntries = [];
let waitlistFilter = 'all';
let waitlistLoaded = false;

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
  } catch (e) { return iso || ''; }
}

function renderWaitlist() {
  if (!waitlistList) return;
  const rows = waitlistEntries.filter(e => waitlistFilter === 'all' || e.category === waitlistFilter);
  if (waitlistCount) {
    waitlistCount.textContent = rows.length + ' ' + (rows.length === 1 ? 'entry' : 'entries');
  }
  const plain = document.getElementById('waitlist-plain');
  if (plain) {
    plain.value = rows.map(e => `${e.email}\t${e.category}\t${e.created_at}`).join('\n');
  }
  if (rows.length === 0) {
    waitlistList.innerHTML = '<p class="loading-text">No waitlist entries yet.</p>';
    return;
  }
  waitlistList.innerHTML = `
    <table class="waitlist-table">
      <thead>
        <tr><th>Email</th><th>Category</th><th>Joined</th><th>Member access</th></tr>
      </thead>
      <tbody>
        ${rows.map(e => `
          <tr>
            <td class="wl-email-cell">${escapeHtml(e.email)}</td>
            <td><span class="wl-cat-badge wl-cat-${escapeHtml(e.category)}">${escapeHtml(e.category)}</span></td>
            <td class="wl-date-cell">${escapeHtml(formatDate(e.created_at))}</td>
            <td>${e.category === 'watches' && e.ref_code ? `<button type="button" class="admin-btn" data-access-code="${escapeHtml(e.ref_code)}">Get private link</button>` : '—'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  waitlistList.querySelectorAll('[data-access-code]').forEach(button => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const response = await fetch('/api/admin/early-access', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:button.dataset.accessCode})});
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not create link.');
        button.parentElement.querySelector('input')?.remove();
        const input = document.createElement('input');
        input.type='text';input.readOnly=true;input.value=location.origin+data.url;
        input.setAttribute('aria-label','Private member link, expires in 7 days');
        button.parentElement.appendChild(input);input.focus();input.select();
        button.textContent='Renew link';
        showToast('Private link ready. Copy it and send it to this member. Valid for 7 days.');
      } catch(error) {showToast(error.message,true);}
      finally {button.disabled=false;}
    });
  });
}

const waitlistCopyBtn = document.getElementById('waitlist-copy-btn');
if (waitlistCopyBtn) {
  waitlistCopyBtn.addEventListener('click', async () => {
    const plain = document.getElementById('waitlist-plain');
    if (!plain || !plain.value) { showToast('Nothing to copy'); return; }
    try {
      await navigator.clipboard.writeText(plain.value);
      showToast('Copied to clipboard');
    } catch (e) {
      plain.select();
      document.execCommand('copy');
      showToast('Copied');
    }
  });
}

async function loadWaitlist() {
  if (!waitlistList) return;
  try {
    const res = await fetch('/api/admin/waitlist');
    if (!res.ok) throw new Error('Failed to fetch');
    const payload = await res.json();
    waitlistEntries = Array.isArray(payload) ? payload : (payload.data || []);
    waitlistLoaded = true;
    if (payload && payload.storage === 'file') {
      const note = document.getElementById('waitlist-storage-note') || (() => {
        const p = document.createElement('p');
        p.id = 'waitlist-storage-note';
        p.className = 'loading-text';
        waitlistList.parentNode.insertBefore(p, waitlistList);
        return p;
      })();
      note.textContent = 'Note: no database is connected, so signups are saved to a file on the server. They work, but connect the database to keep them safe long-term (a redeploy can clear the file). Export/copy them regularly.';
    }
    renderWaitlist();
    renderDashboard();
  } catch (err) {
    waitlistList.innerHTML = '<p class="loading-text">Could not load waitlist.</p>';
  }
}

document.querySelectorAll('.waitlist-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.waitlist-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    waitlistFilter = btn.dataset.filter;
    renderWaitlist();
  });
});

if (waitlistExportBtn) {
  waitlistExportBtn.addEventListener('click', () => {
    const rows = waitlistEntries.filter(e => waitlistFilter === 'all' || e.category === waitlistFilter);
    const header = 'email,category,joined_at\n';
    const body = rows.map(e => `"${(e.email||'').replace(/"/g,'""')}",${e.category},${e.created_at}`).join('\n');
    const blob = new Blob([header + body], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `waitlist-${waitlistFilter}-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

// ─── Watch Page settings ─────────────────────────────────
let watchPageLoaded = false;

function wpSpecRow(label, value) {
  const row = document.createElement('div');
  row.className = 'wp-spec-row';
  row.innerHTML =
    '<input type="text" class="wp-spec-label" placeholder="Label (e.g. Movement)" maxlength="100">' +
    '<input type="text" class="wp-spec-value" placeholder="Value" maxlength="300">' +
    '<button type="button" class="action-btn wp-spec-remove">Remove</button>';
  row.querySelector('.wp-spec-label').value = label || '';
  row.querySelector('.wp-spec-value').value = value || '';
  row.querySelector('.wp-spec-remove').addEventListener('click', () => row.remove());
  return row;
}

async function loadWatchPageSettings() {
  try {
    const res = await fetch('/api/admin/site-settings', { credentials: 'include', cache: 'no-store' });
    if (!res.ok) throw new Error('Failed');
    const s = await res.json();
    watchPageLoaded = true;

    const modeInput = document.querySelector('input[name="wp-mode"][value="' + (['shop','preorder'].includes(s.watchesMode) ? s.watchesMode : 'waitlist') + '"]');
    document.getElementById('wp-preorder-note').value=s.preorderFulfillmentNote||'';
    if (modeInput) modeInput.checked = true;
    document.getElementById('wp-preview-enabled').checked = s.watchPreviewEnabled === true;
    document.getElementById('wp-womens-enabled').checked = s.womensWatchEnabled !== false;
    document.getElementById('wp-womens-enabled').disabled = false;
    document.getElementById('wp-headline').value = s.watchHeadline || '';
    document.getElementById('wp-sub').value = s.watchSub || '';

    const list = document.getElementById('wp-specs-list');
    list.innerHTML = '';
    (s.watchSpecs || []).forEach(spec => list.appendChild(wpSpecRow(spec.label, spec.value)));

    // New feature fields
    document.getElementById('wp-countdown-enabled').checked = s.countdownEnabled !== false;
    document.getElementById('wp-drop-date').value = s.dropDate ? toLocalDatetime(s.dropDate) : '';
    document.getElementById('wp-drop-title').value = s.dropTitle || '';
    document.getElementById('wp-edition-total').value = s.editionTotal || 0;
    document.getElementById('wp-edition-claimed').value = s.editionClaimed || 0;
    document.getElementById('wp-early-access').checked = Boolean(s.earlyAccessEnabled);
    // Warn if shop mode is selected but the shop can't actually sell yet.
    updateWpModeNote();
  } catch (err) {
    showToast('Could not load watch page settings', true);
  }
}

async function updateWpModeNote() {
  const note = document.getElementById('wp-mode-note');
  if (!note) return;
  try {
    const health = await (await fetch('/api/health')).json();
    if (!health.paypalEnabled) {
      note.textContent = 'Checkout remains unavailable. Watch preview mode can hide prices while allowing visitors to save designs and cart items; it does not enable payments.';
      note.style.display = 'block';
    } else {
      note.style.display = 'none';
    }
  } catch (e) {}
}

document.getElementById('wp-add-spec-btn').addEventListener('click', () => {
  document.getElementById('wp-specs-list').appendChild(wpSpecRow('', ''));
});

document.getElementById('wp-save-btn').addEventListener('click', async () => {
  if (!watchPageLoaded) { showToast('Load Watch Page settings before saving. Reopen this tab to retry.', true); return; }
  const btn = document.getElementById('wp-save-btn');
  btn.disabled = true;
  btn.textContent = 'Saving...';
  try {
    const modeEl = document.querySelector('input[name="wp-mode"]:checked');
    const specs = [...document.querySelectorAll('#wp-specs-list .wp-spec-row')].map(row => ({
      label: row.querySelector('.wp-spec-label').value.trim(),
      value: row.querySelector('.wp-spec-value').value.trim(),
    })).filter(s => s.label || s.value);

    const res = await fetch('/api/admin/site-settings', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        watchesMode: modeEl ? modeEl.value : 'waitlist',
        preorderFulfillmentNote: document.getElementById('wp-preorder-note').value.trim(),
        watchPreviewEnabled: document.getElementById('wp-preview-enabled').checked,
        womensWatchEnabled: document.getElementById('wp-womens-enabled').checked,
        watchHeadline: document.getElementById('wp-headline').value.trim(),
        watchSub: document.getElementById('wp-sub').value.trim(),
        watchSpecs: specs,
        countdownEnabled: document.getElementById('wp-countdown-enabled').checked,
        dropDate: document.getElementById('wp-drop-date').value
          ? new Date(document.getElementById('wp-drop-date').value).toISOString() : '',
        dropTitle: document.getElementById('wp-drop-title').value.trim(),
        editionTotal: parseInt(document.getElementById('wp-edition-total').value, 10) || 0,
        editionClaimed: parseInt(document.getElementById('wp-edition-claimed').value, 10) || 0,
        earlyAccessEnabled: document.getElementById('wp-early-access').checked,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Save failed');
    }
    showToast('Watch page updated');
    const saved = await res.json();
    if (window.offerWatchAnnouncements) window.offerWatchAnnouncements(saved.announcementDrafts);
  } catch (err) {
    showToast(err.message || 'Save failed', true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Changes';
  }
});

// ─── Init ────────────────────────────────────────────────
loadProducts();
loadBudItems();
loadWaitlist();

// ─── Helpers for new Watch Page rows ─────────────────────
function toLocalDatetime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const pad = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function wpBundleRow(b) {
  const row = document.createElement('div');
  row.className = 'wp-spec-row wp-bundle-row';
  row.innerHTML =
    '<input type="text" class="wp-bundle-name" placeholder="Bundle name" maxlength="120">' +
    '<input type="text" class="wp-bundle-note" placeholder="Note (optional)" maxlength="200">' +
    '<input type="text" class="wp-bundle-prices" placeholder="Product price IDs, comma-separated (2+)" maxlength="600">' +
    '<button type="button" class="action-btn wp-spec-remove">Remove</button>';
  row.querySelector('.wp-bundle-name').value = (b && b.name) || '';
  row.querySelector('.wp-bundle-note').value = (b && b.note) || '';
  row.querySelector('.wp-bundle-prices').value = ((b && b.priceIds) || []).join(', ');
  row.querySelector('.wp-spec-remove').addEventListener('click', () => row.remove());
  return row;
}

document.getElementById('wp-add-bundle-btn').addEventListener('click', () =>
  document.getElementById('wp-bundles-list').appendChild(wpBundleRow(null)));


// ─── Orders ──────────────────────────────────────────────
function shippingControls(o, emailEnabled) {
  return (o.fulfillment || []).map(f => {
    const label = f.group === 'preorder' ? 'Preorder items' : 'Regular items';
    const notification = f.notification;
    const message = !notification ? 'Not notified' : notification.status === 'sent'
      ? 'Notification sent ' + new Date(notification.sentAt).toLocaleString()
      : 'Delivery pending or unconfirmed — check email provider; resend blocked.';
    return '<form class="shipping-form" data-order="' + escapeHtml(o.checkoutId) + '" data-group="' + escapeHtml(f.group) + '">' +
      '<fieldset style="margin:18px 0;padding:16px;min-width:0" ' + (o.paymentStatus !== 'paid' ? 'disabled' : '') + '><legend>' + label + ' — shipping</legend>' +
      '<label>Status <select name="status">' + ['unfulfilled','preparing','shipped','delivered'].map(s =>
        '<option value="' + s + '"' + (f.status === s ? ' selected' : '') + '>' + s + '</option>').join('') + '</select></label>' +
      ['carrier','trackingNumber','trackingUrl','notes'].map((key,i) => '<label style="display:block;margin:10px 0">' +
        ['Carrier','Tracking number','Tracking URL (HTTPS)','Internal fulfillment notes'][i] +
        '<input style="width:100%;box-sizing:border-box" name="' + key + '" maxlength="' + [100,200,2000,2000][i] + '" value="' + escapeHtml(f[key] || '') + '"></label>').join('') +
      '<p>' + escapeHtml(message) + '</p>' +
      '<button type="submit" class="btn-save">Save shipping</button> ' +
      '<button type="button" class="btn-save shipping-notify" ' + (!emailEnabled || notification || !['shipped','delivered'].includes(f.status) ? 'disabled' : '') + '>Notify customer</button>' +
      '<p class="shipping-result" role="status"></p></fieldset></form>';
  }).join('');
}
document.getElementById('orders-list').addEventListener('submit', async event => {
  const form = event.target.closest('.shipping-form');
  if (!form) return;
  event.preventDefault();
  await saveShipping(form, false);
});
document.getElementById('orders-list').addEventListener('click', async event => {
  if (!event.target.closest('.shipping-notify')) return;
  const form = event.target.closest('.shipping-form');
  if (!confirm('Send one shipping email for this item group using the saved tracking details? Save any changes first.')) return;
  await saveShipping(form, true);
});
async function saveShipping(form, notify) {
  const result = form.querySelector('.shipping-result');
  const buttons = [...form.querySelectorAll('button')];
  const previouslyDisabled = buttons.map(b=>b.disabled);
  buttons.forEach(b=>b.disabled=true);
  try {
    const response = await fetch('/api/admin/orders/' + encodeURIComponent(form.dataset.order) + '/fulfillment/' + encodeURIComponent(form.dataset.group) + (notify ? '/notify' : ''), {
      method:notify?'POST':'PUT',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(notify?{}:Object.fromEntries(new FormData(form))),
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || 'Shipping update failed.');
    showToast(notify ? (data.notification.status === 'sent' ? 'Shipping notification sent' : 'Delivery unconfirmed — check email provider') : 'Shipping details saved');
    await loadOrders();
  } catch(e) {
    result.textContent = e.message;
    buttons.forEach((b,i)=>b.disabled=previouslyDisabled[i]);
  }
}
async function loadOrders() {
  ordersLoaded = true;
  const list = document.getElementById('orders-list');
  const abandonedList = document.getElementById('abandoned-list');
  const reliabilityNote = document.getElementById('payment-reliability-status');
  try {
    const response = await fetch('/api/admin/payment-reliability');
    if (!response.ok) throw Error('Status unavailable');
    const status = await response.json();
    reliabilityNote.textContent = 'Automatic payment checks: ' + (status.enabled ? 'on' : 'off — activation required') +
      '. Order confirmation emails: ' + (status.emailEnabled && status.enabled ? 'on' : 'off — email setup/activation required') +
      (status.lastSuccessAt ? '. Last completed check: ' + new Date(status.lastSuccessAt).toLocaleString() : '. No completed background check yet.') +
      (status.lastError ? ' ' + status.lastError : '');
  } catch { reliabilityNote.textContent = 'Could not load automatic payment and email status.'; }
  try {
    const response = await fetch('/api/admin/orders');
    const data = await response.json();
    if (!response.ok) throw Error(data.error || 'Could not load orders.');
    if (data.paymentEnabled === false && !(data.data || []).length) {
      list.innerHTML = '<p class="loading-text">Payments are turned off — orders will appear here once checkout is live.</p>';
      abandonedList.innerHTML = '<p class="loading-text">—</p>';
      return;
    }
    const orders = data.data || [];
    document.getElementById('orders-revenue').textContent =
      orders.length + ' order' + (orders.length === 1 ? '' : 's') + ' · ' + formatPrice(data.revenue || 0) + ' revenue';
    list.innerHTML = orders.length === 0
      ? '<p class="loading-text">No orders yet.</p>'
      : orders.map(o =>
          '<div class="waitlist-row"><span>' + escapeHtml(o.email || o.name || 'Customer') + '</span>' +
          '<span>' + formatPrice(o.amount || 0) + '</span>' +
          '<span class="waitlist-date">' + new Date(o.created * 1000).toLocaleDateString() + '</span></div>' +
          '<p>' + escapeHtml(o.id) + ' · Payment: ' + escapeHtml(o.paymentStatus || '') + '</p>' +
          (o.items ? '<p>'+o.items.map(i=>escapeHtml(i.quantity+' × '+i.name+(i.baseName?' (base '+i.baseName+')':'')+(i.fulfillmentNote?' — '+i.fulfillmentNote:''))).join('<br>')+'</p>':'') +
          (o.shipping ? '<p>Ship to: '+escapeHtml([o.shipping.name,o.shipping.line1,o.shipping.line2,o.shipping.city,o.shipping.region,o.shipping.postalCode,o.shipping.country].filter(Boolean).join(', '))+'</p>':'') +
          '<p class="loading-text">Payment check: ' + escapeHtml(o.paymentCheck?.status || 'not checked in background') +
          ' · Confirmation email: ' + escapeHtml(o.confirmation?.status || 'not scheduled') +
          (o.paymentCheck?.status === 'needs_review' ? ' — verify with PayPal before releasing stock or taking another payment.' : '') +
          (o.confirmation?.status === 'needs_review' ? ' — review email delivery before resending.' : '') + '</p>' +
          shippingControls(o, data.shippingEmailEnabled)
        ).join('');
    if (!data.shippingEmailEnabled) list.insertAdjacentHTML('afterbegin','<p class="loading-text">Shipping emails are disabled. Configure Resend and a verified sender, then enable shipping notifications. Saving shipping never sends email.</p>');
  } catch (e) {
    list.innerHTML = '<p class="loading-text">Could not load orders.</p>';
  }
  try {
    const ab = await (await fetch('/api/admin/abandoned')).json();
    const items = ab.data || [];
    window.__abandonedEmails = items.map(i => i.email);
    document.getElementById('abandoned-send-btn').disabled = ab.supported === false || !items.length;
    if (ab.supported === false) {
      abandonedList.innerHTML = '<p class="loading-text">Abandoned-checkout recovery is not available for PayPal.</p>';
      return;
    }
    abandonedList.innerHTML = items.length === 0
      ? '<p class="loading-text">No abandoned checkouts.</p>'
      : items.map(i =>
          '<div class="waitlist-row"><span>' + escapeHtml(i.email) + '</span>' +
          '<span>' + formatPrice(i.amount || 0) + '</span>' +
          '<span class="waitlist-date">' + new Date(i.created * 1000).toLocaleDateString() + '</span></div>'
        ).join('');
    if (ab.emailConfigured === false && items.length > 0) {
      abandonedList.innerHTML += '<p class="loading-text">Configure Resend and a verified sender before sending email.</p>';
    }
  } catch (e) {
    abandonedList.innerHTML = '<p class="loading-text">Could not load abandoned checkouts.</p>';
  }
}

document.getElementById('abandoned-send-btn').addEventListener('click', async function () {
  const emails = window.__abandonedEmails || [];
  if (emails.length === 0) return showToast('No abandoned checkouts to email', true);
  if (!confirm('Send a recovery email to ' + emails.length + ' shopper(s)?')) return;
  this.disabled = true;
  try {
    const res = await fetch('/api/admin/abandoned/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails }),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || 'Send failed');
    showToast('Sent ' + d.sent + ' of ' + d.total + ' emails');
  } catch (e) {
    showToast(e.message, true);
  } finally {
    this.disabled = false;
  }
});

// ─── Reviews moderation ──────────────────────────────────
async function loadAdminReviews() {
  reviewsLoaded = true;
  const list = document.getElementById('admin-reviews-list');
  try {
    const data = await (await fetch('/api/admin/reviews')).json();
    const reviews = data.data || [];
    if (reviews.length === 0) {
      list.innerHTML = '<p class="loading-text">No reviews yet.</p>';
      return;
    }
    list.innerHTML = reviews.map(r =>
      '<div class="waitlist-row" style="flex-wrap:wrap; gap:0.5rem;">' +
        '<span style="flex:1; min-width:200px;"><strong style="color:#d4af37;">' + '★'.repeat(r.rating || 5) + '</strong> ' +
        escapeHtml(r.name) + ' — ' + escapeHtml((r.text || '').slice(0, 140)) + '</span>' +
        '<span class="waitlist-date">' + (r.approved ? 'Live' : 'Pending') + '</span>' +
        '<button class="action-btn" data-review-approve="' + r.id + '" data-approved="' + (r.approved ? '0' : '1') + '">' +
          (r.approved ? 'Hide' : 'Approve') + '</button>' +
        '<button class="action-btn" data-review-delete="' + r.id + '">Delete</button>' +
      '</div>'
    ).join('');
    list.querySelectorAll('[data-review-approve]').forEach(btn => btn.addEventListener('click', async () => {
      await fetch('/api/admin/reviews/' + btn.dataset.reviewApprove, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: btn.dataset.approved === '1' }),
      });
      reviewsLoaded = false; loadAdminReviews();
    }));
    list.querySelectorAll('[data-review-delete]').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Delete this review?')) return;
      await fetch('/api/admin/reviews/' + btn.dataset.reviewDelete, { method: 'DELETE' });
      reviewsLoaded = false; loadAdminReviews();
    }));
  } catch (e) {
    list.innerHTML = '<p class="loading-text">Could not load reviews.</p>';
  }
}

// ─── Marketing: email blast + QR ─────────────────────────
async function initMarketing() {
  marketingLoaded = true;
  const qrTarget = 'https://www.samedietdimanche.com/watches.html';
  const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=440x440&data=' + encodeURIComponent(qrTarget);
  document.getElementById('qr-img').src = qrUrl;
  document.getElementById('qr-download').href = qrUrl;
  if (window.initCampaignComposer) window.initCampaignComposer();
}

// ─── Analytics on Overview ───────────────────────────────
(async function loadAnalytics() {
  const setText = (id, v) => { const n = document.getElementById(id); if (n) n.textContent = v; };
  try {
    const res = await fetch('/api/admin/analytics?days=30');
    if (!res.ok) throw new Error('Analytics returned ' + res.status);
    const a = await res.json();
    setText('stat-views', a.totalViews || 0);
    const today = new Date().toISOString().slice(0, 10);
    setText('stat-views-today', (a.byDay && a.byDay[today]) || 0);
    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    let signups30 = 0;
    Object.keys(a.signupsByDay || {}).forEach(d => { if (d >= since) signups30 += a.signupsByDay[d]; });
    setText('stat-signups-30', signups30);
    const paths = Object.entries(a.byPath || {}).sort((x, y) => y[1] - x[1]).slice(0, 6);
    document.getElementById('analytics-paths').innerHTML = paths.length === 0
      ? '<p class="loading-text">No traffic recorded yet — data appears once visitors browse the site.</p>'
      : paths.map(p => '<div class="waitlist-row"><span>' + escapeHtml(p[0]) + '</span><span>' + p[1] + ' views</span></div>').join('');
  } catch (e) {
    setText('stat-views', '0');
    setText('stat-views-today', '0');
    setText('stat-signups-30', '0');
    document.getElementById('analytics-paths').innerHTML =
      '<p class="loading-text">No analytics data yet — tracking will populate as visitors browse the site.</p>';
  }
})();
