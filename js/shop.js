let products = [];
let selectedProduct = null;
let shopAvailable = false;
let quantity = 1;

const grid = document.getElementById('product-grid');
const modal = document.getElementById('product-modal');
const toast = document.getElementById('toast');

function formatPrice(amount, currency) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: currency || 'cad',
    currencyDisplay: 'code',
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

    const img = (product.images && product.images[0]) || '';
    const hasBadge = product.metadata && product.metadata.badge;

    const card = document.createElement('div');
    card.className = 'product-card animate-in';
    card.style.setProperty('--delay', (0.3 + i * 0.08) + 's');

    card.innerHTML =
      '<div class="product-image-wrap">' +
        '<img alt="" class="product-image">' +
        (hasBadge ? '<span class="product-badge">New</span>' : '') +
      '</div>' +
      '<div class="product-info">' +
        '<h3 class="product-name"></h3>' +
        '<p class="product-price">' + formatPrice(price.unit_amount, price.currency) + '</p>' +
      '</div>';
    const imgEl = card.querySelector('.product-image');
    if(img)imgEl.src = img;
    else {imgEl.hidden=true;const empty=document.createElement('span');empty.textContent='Photograph unavailable';empty.className='loading-text';card.querySelector('.product-image-wrap').appendChild(empty);}
    imgEl.alt = product.name;
    card.querySelector('.product-name').textContent = product.name;
    if(hasBadge)card.querySelector('.product-badge').textContent=product.metadata.badge;

    const detailLink=document.createElement('a');
    detailLink.href='product.html?id='+encodeURIComponent(product.id);
    detailLink.className='product-card-link';
    detailLink.setAttribute('aria-label','View '+product.name);
    while(card.firstChild)detailLink.appendChild(card.firstChild);
    card.appendChild(detailLink);
    imgEl.onerror=()=>{imgEl.hidden=true;const empty=document.createElement('span');empty.textContent='Photograph unavailable';empty.className='loading-text';detailLink.querySelector('.product-image-wrap').appendChild(empty);};

    const favorite=document.createElement('button');
    favorite.type='button';favorite.className='buy-btn';
    function paintFavorite(){
      try {const ids=JSON.parse(localStorage.getItem('sd-shop-favorites-v1')||'[]');const on=ids.includes(product.id);favorite.textContent=on?'Favorited':'Favorite';favorite.setAttribute('aria-pressed',String(on));}
      catch(_){favorite.textContent='Favorite';}
    }
    paintFavorite();
    favorite.onclick=e=>{
      e.stopPropagation();
      try{
        const ids=JSON.parse(localStorage.getItem('sd-shop-favorites-v1')||'[]');
        localStorage.setItem('sd-shop-favorites-v1',JSON.stringify(ids.includes(product.id)?ids.filter(id=>id!==product.id):ids.concat(product.id)));
        paintFavorite();
      }catch(_){showToast('Favorites could not be saved. Enable browser storage.',true);}
    };
    card.appendChild(favorite);
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
  if (Array.isArray(product.variants) && product.variants.length) {
    location.href = 'product.html?id=' + encodeURIComponent(product.id); return;
  }
  selectedProduct = product;
  quantity = 1;

  const price = product.prices[0];
  const modalImgWrap = document.querySelector('.modal-image-wrap');
  if(img)document.getElementById('modal-image').src = img;
  else document.getElementById('modal-image').removeAttribute('src');
  document.getElementById('modal-image').alt = product.name;
  document.getElementById('modal-name').textContent = product.name;
  document.getElementById('modal-description').textContent = product.description || '';
  document.getElementById('modal-price').textContent = formatPrice(price.unit_amount, price.currency);
  document.getElementById('qty-value').textContent = '1';
  document.getElementById('buy-btn').disabled = !shopAvailable;
  document.getElementById('buy-btn').textContent = shopAvailable ? 'Add to cart' : 'Unavailable';

  if (!modalImgWrap.querySelector('.zoom-hint')) {
    const hint = document.createElement('span');
    hint.className = 'zoom-hint';
    hint.textContent = 'Click to zoom';
    modalImgWrap.appendChild(hint);
  }
  modalImgWrap.querySelector('.zoom-hint').hidden=!img;

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
  if (quantity < 20) {
    quantity++;
    document.getElementById('qty-value').textContent = quantity;
  }
});

document.getElementById('buy-btn').addEventListener('click', async () => {
  if (!selectedProduct || !shopAvailable) return;
  if (Array.isArray(selectedProduct.variants) && selectedProduct.variants.length) {
    location.href = 'product.html?id=' + encodeURIComponent(selectedProduct.id); return;
  }

  const btn = document.getElementById('buy-btn');
  btn.disabled = true;
  btn.textContent = 'Checking pricing…';

  try {
    const priceId = selectedProduct.prices[0].id;
    await SharedCart.add({type:'shop',productId:selectedProduct.id,priceId,quantity});
    showToast('Added to your shared cart.');
    let link=document.getElementById('modal-cart-link');
    if(!link){link=document.createElement('a');link.id='modal-cart-link';link.href='cart.html';link.textContent='View cart →';btn.after(link);}
  } catch (err) {
    showToast(err.message || 'Current cart pricing unavailable. Please retry.', true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Add to cart';
  }
});

async function loadProducts() {
  // Admin can close the shop entirely (Shop Page Mode toggle).
  try {
    const sRes = await fetch('/api/site-settings');
    if (sRes.ok) {
      const s = await sRes.json();
      if (s.shopEnabled === false) {
        shopAvailable=false;selectedProduct=null;closeModal();
        grid.innerHTML =
          '<div class="loading-indicator">' +
            '<p class="loading-text">Collection coming soon</p>' +
          '</div>';
        return;
      }
    }
  } catch (e) { /* The products API enforces the gate authoritatively. */ }
  try {
    const res = await fetch('/api/products?category=shop');
    const data = await res.json();
    if(!res.ok)throw Error('Catalogue unavailable');
    data.data=(data.data||[]).filter(p=>p.category==='shop'&&p.active===true&&p.prices&&p.prices[0]&&p.prices[0].active===true&&String(p.prices[0].currency).toLowerCase()==='cad'&&Number.isSafeInteger(p.prices[0].unit_amount)&&p.prices[0].unit_amount>0&&p.prices[0].unit_amount<=1000000);
    shopAvailable = true;

    if (data.data && data.data.length > 0) {
      products = data.data;
      renderProducts(products);
    } else {
      shopAvailable=false;selectedProduct=null;closeModal();
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
    const retry=document.createElement('button');retry.type='button';retry.className='buy-btn';retry.textContent='Retry collection';retry.onclick=loadProducts;grid.appendChild(retry);
  }
}

loadProducts();

// ─── Bundles ─────────────────────────────────────────────
async function loadBundles() {
  try {
    const s = window.__siteSettings || await (await fetch('/api/site-settings')).json();
    if (s.shopEnabled === false) return;
    if (!s.bundlesEnabled || !Array.isArray(s.bundles) || s.bundles.length === 0) return;
    // Need products loaded so we can show names/prices
    const res = await fetch('/api/products?category=shop');
    const data = await res.json();
    const all = data.data || [];
    const byPrice = {};
    all.forEach(p => (p.prices || []).forEach(pr => { byPrice[pr.id] = { product: p, price: pr }; }));

    const cards = s.bundles.map(b => {
      const items = (b.priceIds || []).map(id => byPrice[id]).filter(Boolean);
      if (items.length < 2) return '';
      const total = items.reduce((a, i) => a + (i.price.unit_amount || 0), 0);
      const currency = items[0].price.currency;
      const needsOptions = items.some(i => Array.isArray(i.product.variants) && i.product.variants.length);
      return '<div class="bundle-card">' +
        '<h3 class="bundle-name">' + escapeHtml(b.name || 'Bundle') + '</h3>' +
        (b.note ? '<p class="bundle-note">' + escapeHtml(b.note) + '</p>' : '') +
        '<p class="bundle-items">' + items.map(i => escapeHtml(i.product.name)).join('<br>') + '</p>' +
        '<p class="bundle-price">' + formatPrice(total, currency) + '</p>' +
        (needsOptions ? '<p class="bundle-note">Add each piece separately and choose its options:</p>' +
          items.map(i => '<p><a class="bundle-piece-link" href="product.html?id=' + encodeURIComponent(i.product.id) + '">' + escapeHtml(i.product.name) + ' — View &amp; choose</a></p>').join('') :
          '<button class="bundle-buy" data-items=\'' + escapeHtml(JSON.stringify((b.priceIds || []))) + '\'>Add pieces to cart</button>') +
      '</div>';
    }).filter(Boolean);

    if (cards.length === 0) return;
    document.getElementById('bundle-grid').innerHTML = cards.join('');
    document.getElementById('bundles-section').style.display = '';

    document.querySelectorAll('.bundle-buy').forEach(btn => {
      btn.addEventListener('click', async () => {
        const bundleIds = JSON.parse(btn.getAttribute('data-items'));
        btn.disabled = true;
        const orig = btn.textContent;
        btn.textContent = 'Checking pricing…';
        try {
          const ids = JSON.parse(btn.getAttribute('data-items'));
          for(const id of ids){
            const entry=byPrice[id];
            if(!entry||entry.product.category!=='shop'||!Number.isSafeInteger(entry.price.unit_amount)||entry.price.unit_amount<=0||String(entry.price.currency).toLowerCase()!=='cad')throw Error('A bundle piece is unavailable.');
            await SharedCart.add({type:'shop',productId:entry.product.id,priceId:entry.price.id,quantity:1});
          }
          showToast('Pieces added. Open your shared cart to review.');
        } catch (e) {
          showToast((e.message||'Current pricing unavailable.')+' Review your cart for any pieces already added.', true);
        }
        btn.disabled = false;
        btn.textContent = orig;
      });
    });
  } catch (e) { /* bundles are optional */ }
}

// ─── Reviews ─────────────────────────────────────────────
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

async function loadReviews() {
  const grid = document.getElementById('reviews-grid');
  if (!grid) return;
  try {
    const data = await (await fetch('/api/reviews')).json();
    const reviews = data.data || [];
    if (reviews.length === 0) {
      grid.innerHTML = '<p class="loading-text" style="text-align:center; grid-column:1/-1;">Be the first to leave a review.</p>';
      return;
    }
    grid.innerHTML = reviews.map(r => {
      const stars = '★'.repeat(Math.max(1, Math.min(5, r.rating || 5)));
      const photo = r.photo && /^https?:\/\//i.test(r.photo)
        ? '<img class="review-card-photo" src="' + escapeHtml(r.photo) + '" alt="Customer photo" loading="lazy">' : '';
      return '<div class="review-card">' + photo +
        '<div class="review-card-stars">' + stars + '</div>' +
        '<p class="review-card-text">' + escapeHtml(r.text) + '</p>' +
        '<span class="review-card-name">' + escapeHtml(r.name) + '</span>' +
      '</div>';
    }).join('');
  } catch (e) {
    grid.innerHTML = '';
  }
}

(function initReviewForm() {
  const toggle = document.getElementById('review-toggle');
  const form = document.getElementById('review-form');
  if (!toggle || !form) return;
  let rating = 5;
  const starBtns = document.querySelectorAll('#review-stars button');
  function paintStars() {
    starBtns.forEach(b => b.classList.toggle('on', parseInt(b.dataset.star, 10) <= rating));
  }
  paintStars();
  starBtns.forEach(b => b.addEventListener('click', () => { rating = parseInt(b.dataset.star, 10); paintStars(); }));
  toggle.addEventListener('click', () => {
    form.style.display = form.style.display === 'none' ? 'flex' : 'none';
  });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = document.getElementById('review-msg');
    msg.textContent = 'Submitting...';
    msg.style.color = '';
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: document.getElementById('review-name').value,
          rating,
          text: document.getElementById('review-text').value,
          photo: document.getElementById('review-photo').value,
        }),
      });
      const d = await res.json();
      if (res.ok) {
        msg.textContent = 'Thank you — your review will appear once approved.';
        msg.style.color = '#d4af37';
        form.reset(); rating = 5; paintStars();
      } else {
        msg.textContent = d.error || 'Could not submit review.';
        msg.style.color = '#c0392b';
      }
    } catch (err) {
      msg.textContent = 'Connection error. Please try again.';
      msg.style.color = '#c0392b';
    }
  });
})();

loadBundles();
loadReviews();
window.addEventListener('focus',loadProducts);
