const IMAGE_MAP = {
  'Essential Tee': 'img/product1.png',
  'Logo Hoodie': 'img/product2.png',
  'Classic Cap': 'img/product3.png',
  'Essential Joggers': 'img/product4.png',
  'Crewneck': 'img/product5.png',
  'Canvas Tote': 'img/product6.png',
};

const BADGE_ITEMS = ['Essential Tee', 'Essential Joggers'];

let products = [];
let selectedProduct = null;
let quantity = 1;

const grid = document.getElementById('product-grid');
const modal = document.getElementById('product-modal');
const toast = document.getElementById('toast');

function formatPrice(amount, currency) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'usd',
  }).format(amount / 100);
}

function showToast(message, isError) {
  toast.textContent = message;
  toast.className = 'toast' + (isError ? ' toast-error' : '') + ' toast-visible';
  setTimeout(() => { toast.className = 'toast'; }, 3500);
}

function renderProducts(items) {
  grid.innerHTML = '';

  items.forEach((product, i) => {
    const price = product.prices[0];
    if (!price) return;

    const img = (product.images && product.images[0]) || IMAGE_MAP[product.name] || 'img/product1.png';
    const hasBadge = (product.metadata && product.metadata.badge) || BADGE_ITEMS.includes(product.name);

    const card = document.createElement('div');
    card.className = 'product-card animate-in';
    card.style.setProperty('--delay', (0.3 + i * 0.08) + 's');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');

    card.innerHTML =
      '<div class="product-image-wrap">' +
        '<img src="' + img + '" alt="' + product.name + '" class="product-image">' +
        (hasBadge ? '<span class="product-badge">New</span>' : '') +
      '</div>' +
      '<div class="product-info">' +
        '<h3 class="product-name">' + product.name + '</h3>' +
        '<p class="product-price">' + formatPrice(price.unit_amount, price.currency) + '</p>' +
      '</div>';

    card.addEventListener('click', () => openModal(product, img));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') openModal(product, img);
    });

    grid.appendChild(card);
  });
}

const zoomOverlay = document.getElementById('zoom-overlay');
const zoomImage = document.getElementById('zoom-image');
const zoomContainer = document.getElementById('zoom-container');
let zoomScale = 1;
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let imgOffset = { x: 0, y: 0 };

function openModal(product, img) {
  selectedProduct = product;
  quantity = 1;

  const price = product.prices[0];
  const modalImgWrap = document.querySelector('.modal-image-wrap');
  document.getElementById('modal-image').src = img;
  document.getElementById('modal-image').alt = product.name;
  document.getElementById('modal-name').textContent = product.name;
  document.getElementById('modal-description').textContent = product.description || '';
  document.getElementById('modal-price').textContent = formatPrice(price.unit_amount, price.currency);
  document.getElementById('qty-value').textContent = '1';
  document.getElementById('buy-btn').disabled = false;
  document.getElementById('buy-btn').textContent = 'Purchase';

  if (!modalImgWrap.querySelector('.zoom-hint')) {
    const hint = document.createElement('span');
    hint.className = 'zoom-hint';
    hint.textContent = 'Click to zoom';
    modalImgWrap.appendChild(hint);
  }

  modal.style.display = 'flex';
  requestAnimationFrame(() => { modal.classList.add('modal-active'); });
}

function closeModal() {
  modal.classList.remove('modal-active');
  setTimeout(() => { modal.style.display = 'none'; }, 300);
}

function openZoom(src, alt) {
  zoomImage.src = src;
  zoomImage.alt = alt || '';
  zoomScale = 1;
  imgOffset = { x: 0, y: 0 };
  zoomImage.classList.remove('zoomed-in', 'zoom-dragging');
  zoomImage.style.transform = '';
  zoomOverlay.style.display = 'block';
  requestAnimationFrame(() => { zoomOverlay.classList.add('zoom-active'); });
  document.body.style.overflow = 'hidden';
}

function closeZoom() {
  zoomOverlay.classList.remove('zoom-active');
  setTimeout(() => {
    zoomOverlay.style.display = 'none';
    zoomImage.src = '';
    zoomImage.classList.remove('zoomed-in', 'zoom-dragging');
    zoomImage.style.transform = '';
    zoomScale = 1;
    imgOffset = { x: 0, y: 0 };
  }, 300);
  document.body.style.overflow = '';
}

function updateZoomTransform() {
  zoomImage.style.transform = 'scale(' + zoomScale + ') translate(' + imgOffset.x + 'px, ' + imgOffset.y + 'px)';
}

document.querySelector('.modal-image-wrap').addEventListener('click', (e) => {
  e.stopPropagation();
  const src = document.getElementById('modal-image').src;
  const alt = document.getElementById('modal-image').alt;
  if (src) openZoom(src, alt);
});

document.getElementById('zoom-close').addEventListener('click', (e) => {
  e.stopPropagation();
  closeZoom();
});

zoomContainer.addEventListener('click', (e) => {
  if (e.target === zoomContainer) {
    closeZoom();
  }
});

zoomImage.addEventListener('click', (e) => {
  e.stopPropagation();
  if (zoomScale > 1) {
    zoomScale = 1;
    imgOffset = { x: 0, y: 0 };
    zoomImage.classList.remove('zoomed-in');
  } else {
    zoomScale = 2.5;
    zoomImage.classList.add('zoomed-in');
  }
  updateZoomTransform();
});

zoomImage.addEventListener('mousedown', (e) => {
  if (zoomScale <= 1) return;
  isDragging = true;
  dragStart = { x: e.clientX - imgOffset.x * zoomScale, y: e.clientY - imgOffset.y * zoomScale };
  zoomImage.classList.add('zoom-dragging');
  e.preventDefault();
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  imgOffset.x = (e.clientX - dragStart.x) / zoomScale;
  imgOffset.y = (e.clientY - dragStart.y) / zoomScale;
  updateZoomTransform();
});

window.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;
    zoomImage.classList.remove('zoom-dragging');
  }
});

zoomImage.addEventListener('wheel', (e) => {
  e.preventDefault();
  const delta = e.deltaY > 0 ? -0.3 : 0.3;
  zoomScale = Math.min(5, Math.max(1, zoomScale + delta));
  if (zoomScale <= 1) {
    imgOffset = { x: 0, y: 0 };
    zoomImage.classList.remove('zoomed-in');
  } else {
    zoomImage.classList.add('zoomed-in');
  }
  updateZoomTransform();
}, { passive: false });

let touchStart = null;
let touchDist = 0;

zoomImage.addEventListener('touchstart', (e) => {
  if (e.touches.length === 1 && zoomScale > 1) {
    isDragging = true;
    dragStart = { x: e.touches[0].clientX - imgOffset.x * zoomScale, y: e.touches[0].clientY - imgOffset.y * zoomScale };
  }
  if (e.touches.length === 2) {
    isDragging = false;
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    touchDist = Math.sqrt(dx * dx + dy * dy);
  }
}, { passive: true });

zoomImage.addEventListener('touchmove', (e) => {
  if (e.touches.length === 1 && isDragging) {
    imgOffset.x = (e.touches[0].clientX - dragStart.x) / zoomScale;
    imgOffset.y = (e.touches[0].clientY - dragStart.y) / zoomScale;
    updateZoomTransform();
    e.preventDefault();
  }
  if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const ratio = dist / touchDist;
    zoomScale = Math.min(5, Math.max(1, zoomScale * ratio));
    touchDist = dist;
    if (zoomScale <= 1) {
      imgOffset = { x: 0, y: 0 };
      zoomImage.classList.remove('zoomed-in');
    } else {
      zoomImage.classList.add('zoomed-in');
    }
    updateZoomTransform();
    e.preventDefault();
  }
}, { passive: false });

zoomImage.addEventListener('touchend', () => {
  isDragging = false;
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (zoomOverlay.style.display !== 'none') {
      closeZoom();
    } else if (modal.style.display !== 'none') {
      closeModal();
    }
  }
});

document.getElementById('modal-close').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});

document.getElementById('qty-minus').addEventListener('click', () => {
  if (quantity > 1) {
    quantity--;
    document.getElementById('qty-value').textContent = quantity;
  }
});

document.getElementById('qty-plus').addEventListener('click', () => {
  if (quantity < 10) {
    quantity++;
    document.getElementById('qty-value').textContent = quantity;
  }
});

document.getElementById('buy-btn').addEventListener('click', async () => {
  if (!selectedProduct) return;

  const btn = document.getElementById('buy-btn');
  btn.disabled = true;
  btn.textContent = 'Redirecting...';

  try {
    const priceId = selectedProduct.prices[0].id;
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId, quantity }),
    });
    const data = await res.json();

    if (data.url) {
      window.location.href = data.url;
    } else {
      showToast('Something went wrong. Please try again.', true);
      btn.disabled = false;
      btn.textContent = 'Purchase';
    }
  } catch (err) {
    console.error('Checkout error:', err);
    showToast('Connection error. Please try again.', true);
    btn.disabled = false;
    btn.textContent = 'Purchase';
  }
});

async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    const data = await res.json();

    if (data.data && data.data.length > 0) {
      products = data.data;
      renderProducts(products);
    } else {
      grid.innerHTML =
        '<div class="loading-indicator">' +
          '<p class="loading-text">Collection coming soon</p>' +
        '</div>';
    }
  } catch (err) {
    console.error('Failed to load products:', err);
    grid.innerHTML =
      '<div class="loading-indicator">' +
        '<p class="loading-text">Unable to load collection</p>' +
      '</div>';
  }
}

const params = new URLSearchParams(window.location.search);
if (params.get('success') === 'true') {
  showToast('Order placed successfully!');
  window.history.replaceState({}, '', '/shop.html');
}
if (params.get('canceled') === 'true') {
  showToast('Order was canceled.', true);
  window.history.replaceState({}, '', '/shop.html');
}

loadProducts();
