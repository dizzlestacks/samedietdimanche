const FALLBACK_MENU = [
  { name: 'Purple Haze', strain: 'Sativa', category: 'flower', thc: '22%', cbd: '0.5%', terpenes: 'Myrcene, Terpinolene', effects: ['Euphoric', 'Creative', 'Energizing'], description: 'A legendary sativa with a sweet berry aroma and earthy undertones. Known for its dreamy cerebral high and vibrant energy.', price: '$45 / 3.5g', weight: '3.5g', image: 'img/bud/bud1.png' },
  { name: 'Northern Lights', strain: 'Indica', category: 'flower', thc: '26%', cbd: '1.0%', terpenes: 'Myrcene, Caryophyllene', effects: ['Relaxing', 'Sleepy', 'Pain Relief'], description: 'Pure indica royalty. Resinous buds with a sweet, spicy aroma. Delivers a deeply relaxing full-body experience.', price: '$50 / 3.5g', weight: '3.5g', image: 'img/bud/bud2.png' },
  { name: 'Blue Dream', strain: 'Hybrid', category: 'flower', thc: '24%', cbd: '0.8%', terpenes: 'Myrcene, Pinene, Caryophyllene', effects: ['Balanced', 'Happy', 'Creative'], description: 'The perfect hybrid balance. Sweet berry aroma from Blueberry parent, with full-body relaxation and gentle cerebral invigoration.', price: '$48 / 3.5g', weight: '3.5g', image: 'img/bud/bud3.png' },
  { name: 'Gelato 41', strain: 'Hybrid', category: 'flower', thc: '28%', cbd: '0.3%', terpenes: 'Limonene, Caryophyllene', effects: ['Euphoric', 'Relaxing', 'Uplifted'], description: 'A dessert-like experience. Dense, colorful buds with a sweet citrus and cream profile. Heavy-hitting potency with a smooth finish.', price: '$55 / 3.5g', weight: '3.5g', image: 'img/bud/bud4.png' },
  { name: 'Weekend Rolls', strain: 'Hybrid', category: 'preroll', thc: '25%', cbd: '0.5%', terpenes: 'Limonene, Linalool', effects: ['Social', 'Uplifted', 'Calm'], description: 'Hand-rolled premium pre-rolls. A curated hybrid blend designed for effortless enjoyment. Pack of 5 half-gram joints.', price: '$38 / 5-pack', weight: '2.5g total', image: 'img/bud/bud5.png' },
  { name: 'Midnight Gummies', strain: 'Indica', category: 'edible', thc: '10mg each', cbd: '5mg each', terpenes: 'Natural fruit terpenes', effects: ['Relaxing', 'Sleepy', 'Calm'], description: 'Artisan blackberry and lavender gummies infused with full-spectrum indica extract. 10 pieces per tin, micro-dose friendly.', price: '$32 / 10-pack', weight: '100mg total', image: 'img/bud/bud6.png' },
  { name: 'Live Rosin', strain: 'Sativa', category: 'concentrate', thc: '78%', cbd: '1.2%', terpenes: 'Terpinolene, Ocimene', effects: ['Energizing', 'Creative', 'Focused'], description: 'Solventless hash rosin pressed from fresh-frozen flower. Full terpene profile preserved for an authentic, clean experience.', price: '$65 / 1g', weight: '1g', image: 'img/bud/bud7.png' },
  { name: 'Cloud Nine', strain: 'Hybrid', category: 'vape', thc: '85%', cbd: '2.0%', terpenes: 'Limonene, Myrcene', effects: ['Euphoric', 'Happy', 'Relaxing'], description: 'Premium live resin cartridge. Ceramic coil technology for smooth, flavorful draws. Compatible with standard 510 batteries.', price: '$52 / 1g cart', weight: '1g', image: 'img/bud/bud8.png' },
  { name: 'OG Kush', strain: 'Indica', category: 'flower', thc: '25%', cbd: '0.6%', terpenes: 'Myrcene, Limonene, Linalool', effects: ['Heavy', 'Relaxing', 'Euphoric'], description: 'The cornerstone strain. Earthy pine and sour lemon aroma. Delivers a complex mix of cerebral euphoria and heavy body relaxation.', price: '$52 / 3.5g', weight: '3.5g', image: 'img/bud/bud9.png' },
];

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
    if (!res.ok) throw new Error('API returned ' + res.status);
    const data = await res.json();
    MENU_ITEMS = data.data || [];
    if (MENU_ITEMS.length === 0) MENU_ITEMS = FALLBACK_MENU;
  } catch (err) {
    console.warn('API unavailable, using local fallback menu:', err.message);
    MENU_ITEMS = FALLBACK_MENU;
  }
  renderMenu(currentFilter);
}

loadMenu();
