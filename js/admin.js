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
let budCurrentImageUrl = '';

function showToast(message, isError) {
  toast.textContent = message;
  toast.className = 'toast' + (isError ? ' toast-error' : '') + ' toast-visible';
  setTimeout(() => { toast.className = 'toast'; }, 3500);
}

function formatPrice(cents) {
  return '$' + (cents / 100).toFixed(2);
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => { p.classList.remove('active'); p.style.display = 'none'; });
    btn.classList.add('active');
    const panel = document.getElementById('tab-' + btn.dataset.tab);
    panel.classList.add('active');
    panel.style.display = 'block';
  });
});

function setImagePreview(url) {
  currentImageUrl = url || '';
  if (url) {
    imagePreview.src = url;
    imagePreview.style.display = 'block';
    imagePlaceholder.style.display = 'none';
    removeImageBtn.style.display = 'inline-block';
  } else {
    imagePreview.src = '';
    imagePreview.style.display = 'none';
    imagePlaceholder.style.display = 'flex';
    removeImageBtn.style.display = 'none';
  }
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
  const file = e.target.files[0];
  if (!file) return;
  const uploadText = imagePlaceholder.querySelector('.upload-text');
  uploadText.textContent = 'Uploading...';
  await handleImageUpload(file, setImagePreview);
  uploadText.textContent = 'Click to upload image';
  imageInput.value = '';
});

removeImageBtn.addEventListener('click', () => setImagePreview(''));

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

function renderProducts(items) {
  productList.innerHTML = '';
  if (items.length === 0) {
    productList.innerHTML = '<p class="loading-text">No products yet. Click "+ Add Product" to create one.</p>';
    return;
  }
  items.forEach(product => {
    const price = product.prices.find(p => p.active !== false);
    const badge = product.metadata?.badge || '';
    const isActive = product.active;
    const thumb = product.images && product.images[0];
    const row = document.createElement('div');
    row.className = 'product-row' + (isActive ? '' : ' product-inactive');
    row.innerHTML =
      (thumb ? '<img src="' + thumb + '" alt="" class="row-thumb">' : '<div class="row-thumb-empty"></div>') +
      '<div class="row-info">' +
        '<div class="row-name">' + product.name +
          (badge ? ' <span class="row-badge">' + badge + '</span>' : '') +
          (!isActive ? ' <span class="row-status">Inactive</span>' : '') +
        '</div>' +
        '<div class="row-description">' + (product.description || 'No description') + '</div>' +
      '</div>' +
      '<div class="row-price">' + (price ? formatPrice(price.unit_amount) : '—') + '</div>' +
      '<div class="row-actions">' +
        '<button class="action-btn edit-btn">Edit</button>' +
        (isActive
          ? '<button class="action-btn deactivate-btn">Deactivate</button>'
          : '<button class="action-btn activate-btn">Activate</button>') +
      '</div>';
    row.querySelector('.edit-btn').addEventListener('click', () => openEdit(product));
    const toggleBtn = row.querySelector('.deactivate-btn') || row.querySelector('.activate-btn');
    toggleBtn.addEventListener('click', () => toggleProduct(product.id, !isActive));
    productList.appendChild(row);
  });
}

function openEdit(product) {
  editingId = product ? product.id : null;
  document.getElementById('modal-title').textContent = product ? 'Edit Product' : 'Add Product';
  document.getElementById('form-id').value = product ? product.id : '';
  document.getElementById('form-name').value = product ? product.name : '';
  document.getElementById('form-description').value = product ? (product.description || '') : '';
  const price = product ? product.prices.find(p => p.active !== false) : null;
  document.getElementById('form-price').value = price ? (price.unit_amount / 100).toFixed(2) : '';
  document.getElementById('form-badge').value = product?.metadata?.badge || '';
  setImagePreview(product?.images?.[0] || '');
  document.getElementById('save-btn').textContent = product ? 'Save Changes' : 'Create Product';
  editModal.style.display = 'flex';
  requestAnimationFrame(() => editModal.classList.add('modal-active'));
}

function closeModal() {
  editModal.classList.remove('modal-active');
  setTimeout(() => { editModal.style.display = 'none'; }, 300);
  editingId = null;
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('cancel-btn').addEventListener('click', closeModal);
editModal.addEventListener('click', (e) => { if (e.target === editModal) closeModal(); });
document.getElementById('add-btn').addEventListener('click', () => openEdit(null));

productForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const saveBtn = document.getElementById('save-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';
  const name = document.getElementById('form-name').value;
  const description = document.getElementById('form-description').value;
  const price = document.getElementById('form-price').value;
  const badge = document.getElementById('form-badge').value;
  const image = currentImageUrl;
  try {
    let res;
    if (editingId) {
      res = await fetch('/api/admin/products/' + editingId, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, price: Number(price), badge, image }),
      });
    } else {
      res = await fetch('/api/admin/products', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, price: Number(price), badge, image }),
      });
    }
    const data = await res.json();
    if (res.ok) {
      showToast(editingId ? 'Product updated' : 'Product created');
      closeModal();
      loadProducts();
    } else {
      showToast(data.error || 'Something went wrong', true);
    }
  } catch (err) {
    showToast('Connection error', true);
  }
  saveBtn.disabled = false;
  saveBtn.textContent = editingId ? 'Save Changes' : 'Create Product';
});

async function toggleProduct(id, active) {
  try {
    const res = await fetch('/api/admin/products/' + id, {
      method: active ? 'PUT' : 'DELETE',
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
    renderProducts(products);
  } catch (err) {
    productList.innerHTML = '<p class="loading-text">Failed to load products</p>';
  }
}

function getStrainClass(strain) {
  if (strain === 'Sativa') return 'strain-sativa';
  if (strain === 'Indica') return 'strain-indica';
  return 'strain-hybrid';
}

function renderBudItems(items) {
  budList.innerHTML = '';
  if (items.length === 0) {
    budList.innerHTML = '<p class="loading-text">No menu items yet. Click "+ Add Item" to create one.</p>';
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

async function loadBudItems() {
  try {
    const res = await fetch('/api/admin/bud-menu');
    if (!res.ok) throw new Error('Server returned ' + res.status);
    const data = await res.json();
    budItems = data.data || [];
    renderBudItems(budItems);
  } catch (err) {
    budList.innerHTML = '<p class="loading-text">Failed to load menu items</p>';
  }
}

loadProducts();
loadBudItems();

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
        <tr><th>Email</th><th>Category</th><th>Joined</th></tr>
      </thead>
      <tbody>
        ${rows.map(e => `
          <tr>
            <td class="wl-email-cell">${escapeHtml(e.email)}</td>
            <td><span class="wl-cat-badge wl-cat-${escapeHtml(e.category)}">${escapeHtml(e.category)}</span></td>
            <td class="wl-date-cell">${escapeHtml(formatDate(e.created_at))}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
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
    waitlistEntries = await res.json();
    waitlistLoaded = true;
    renderWaitlist();
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

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.tab === 'waitlist' && !waitlistLoaded) loadWaitlist();
  });
});
