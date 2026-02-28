let MENU_ITEMS = [];

const grid = document.getElementById('menu-grid');
const modal = document.getElementById('strain-modal');
const filterBtns = document.querySelectorAll('.filter-btn');
let currentFilter = 'all';

function getBadgeClass(strain, category) {
  if (category === 'edible') return 'badge-edible';
  if (category === 'concentrate') return 'badge-concentrate';
  if (category === 'vape') return 'badge-vape';
  if (strain === 'Sativa') return 'badge-sativa';
  if (strain === 'Indica') return 'badge-indica';
  return 'badge-hybrid';
}

function getBadgeLabel(strain, category) {
  if (category === 'edible') return 'Edible';
  if (category === 'concentrate') return 'Concentrate';
  if (category === 'vape') return 'Vape';
  if (category === 'preroll') return 'Pre-Roll';
  return strain;
}

function renderMenu(filter) {
  grid.innerHTML = '';
  const items = filter === 'all' ? MENU_ITEMS : MENU_ITEMS.filter(item => item.category === filter);

  items.forEach((item, i) => {
    const badgeClass = getBadgeClass(item.strain, item.category);
    const badgeLabel = getBadgeLabel(item.strain, item.category);

    const card = document.createElement('div');
    card.className = 'menu-card animate-in';
    card.style.setProperty('--delay', (0.3 + i * 0.06) + 's');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');

    card.innerHTML =
      '<div class="card-image-wrap">' +
        '<img src="' + (item.image || '') + '" alt="' + item.name + '" class="card-image" onerror="this.style.opacity=\'0.3\'">' +
        '<span class="card-type-badge ' + badgeClass + '">' + badgeLabel + '</span>' +
        '<span class="card-thc">THC ' + item.thc + '</span>' +
      '</div>' +
      '<div class="card-info">' +
        '<h3 class="card-name">' + item.name + '</h3>' +
        '<p class="card-strain">' + item.strain + '</p>' +
        '<div class="card-bottom">' +
          '<span class="card-price">' + item.price + '</span>' +
          '<span class="card-weight">' + item.weight + '</span>' +
        '</div>' +
      '</div>';

    card.addEventListener('click', () => openModal(item));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') openModal(item);
    });

    grid.appendChild(card);
  });

  if (items.length === 0) {
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;font-family:var(--font-sans);font-size:0.6rem;font-weight:300;letter-spacing:0.2em;text-transform:uppercase;color:var(--gold);opacity:0.5;padding:3rem 0;">Coming soon</p>';
  }
}

function openModal(item) {
  const badgeClass = getBadgeClass(item.strain, item.category);
  const badgeLabel = getBadgeLabel(item.strain, item.category);

  document.getElementById('modal-image').src = item.image || '';
  document.getElementById('modal-image').alt = item.name;
  document.getElementById('modal-name').textContent = item.name;
  document.getElementById('modal-strain').textContent = item.strain;
  document.getElementById('modal-description').textContent = item.description;
  document.getElementById('modal-thc').textContent = item.thc;
  document.getElementById('modal-cbd').textContent = item.cbd;
  document.getElementById('modal-terpenes').textContent = item.terpenes;
  document.getElementById('modal-price').textContent = item.price;

  const badge = document.getElementById('modal-type-badge');
  badge.textContent = badgeLabel;
  badge.className = 'type-badge ' + badgeClass;

  const effectsList = document.getElementById('modal-effects-list');
  effectsList.innerHTML = '';
  (item.effects || []).forEach(effect => {
    const tag = document.createElement('span');
    tag.className = 'effect-tag';
    tag.textContent = effect;
    effectsList.appendChild(tag);
  });

  modal.style.display = 'flex';
  requestAnimationFrame(() => { modal.classList.add('modal-active'); });
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modal.classList.remove('modal-active');
  setTimeout(() => { modal.style.display = 'none'; }, 300);
  document.body.style.overflow = '';
}

document.getElementById('modal-close').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal.style.display !== 'none') closeModal();
});

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderMenu(currentFilter);
  });
});

async function loadMenu() {
  try {
    const res = await fetch('/api/bud-menu');
    const data = await res.json();
    MENU_ITEMS = data.data || [];
    renderMenu(currentFilter);
  } catch (err) {
    console.error('Failed to load menu:', err);
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;font-family:var(--font-sans);font-size:0.6rem;font-weight:300;letter-spacing:0.2em;text-transform:uppercase;color:var(--gold);opacity:0.5;padding:3rem 0;">Unable to load menu</p>';
  }
}

loadMenu();
