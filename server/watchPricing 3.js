export const FACE_IDS = Object.freeze(['black', 'red', 'blue', 'green']);
export const BAND_IDS = Object.freeze(['black', 'red', 'blue', 'green', 'camouflage']);
export const MAX_COMPONENT_CENTS = 1000000; // CAD 10,000 per component.
export const MAX_QUANTITY = 20;
export const WATCH_MODELS = Object.freeze([
  Object.freeze({ id: 'black-black', name: 'Black / Black', face: 'black', band: 'black', cents: 75000 }),
  Object.freeze({ id: 'black-camouflage', name: 'Black / Camouflage', face: 'black', band: 'camouflage', cents: 100000 }),
  Object.freeze({ id: 'red-red', name: 'Red / Red', face: 'red', band: 'red', cents: 200000 }),
  Object.freeze({ id: 'blue-blue', name: 'Blue / Blue', face: 'blue', band: 'blue', cents: 200000 }),
  Object.freeze({ id: 'green-green', name: 'Green / Green', face: 'green', band: 'green', cents: 200000 })
]);
const name = id => id[0].toUpperCase() + id.slice(1);
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
export function defaultWatchPricing() {
  return { bases: Object.fromEntries(WATCH_MODELS.map(m => [m.id, m.cents])), fees: { face: 25000, band: 15000 } };
}
export function validateWatchPricing(value) {
  const defaults = defaultWatchPricing();
  if (!object(value) || Object.keys(value).length !== 2 || !Object.hasOwn(value, 'bases') || !Object.hasOwn(value, 'fees')) throw new Error('Provide only bases and fees price maps.');
  for (const kind of ['bases', 'fees']) {
    const ids = Object.keys(defaults[kind]), map = value[kind];
    if (!object(map) || Object.keys(map).length !== ids.length || ids.some(id => !Object.hasOwn(map, id))) throw new Error(`Provide all ${kind} prices.`);
    for (const id of ids) {
      const cents = map[id];
      if (cents !== null && (!Number.isSafeInteger(cents) || cents < 0 || cents > MAX_COMPONENT_CENTS)) throw new Error(`${id}: use null or integer cents from 0 to ${MAX_COMPONENT_CENTS}.`);
      defaults[kind][id] = cents;
    }
  }
  return defaults;
}
export function inferWatchBase(face, band) {
  return WATCH_MODELS.find(m => m.face === face && m.band === band)?.id || 'black-black';
}
export function emptyWatchPrices() {
  return { face: Object.fromEntries(FACE_IDS.map(id => [id, null])), band: Object.fromEntries(BAND_IDS.map(id => [id, null])) };
}
export function validateWatchPrices(value) {
  if (!object(value) || Object.keys(value).length !== 2 || !Object.hasOwn(value, 'face') || !Object.hasOwn(value, 'band')) throw new Error('Provide face and band price maps.');
  const clean = emptyWatchPrices();
  for (const [kind, ids] of [['face', FACE_IDS], ['band', BAND_IDS]]) {
    const map = value[kind];
    if (!object(map) || Object.keys(map).length !== ids.length || ids.some(id => !Object.hasOwn(map, id))) throw new Error(`Provide all ${kind} prices; use null for unpriced components.`);
    for (const id of ids) {
      const cents = map[id];
      if (cents !== null && (!Number.isSafeInteger(cents) || cents < 0 || cents > MAX_COMPONENT_CENTS)) throw new Error(`${kind} ${id}: price must be null or integer cents from 0 to ${MAX_COMPONENT_CENTS}.`);
      clean[kind][id] = cents;
    }
  }
  return clean;
}
export function publicWatchSettings(settings) {
  const { watchPricing, watchComponentPrices, preorderWatchesRevision, preorderShopRevision, ...publicSettings } = settings;
  return publicSettings;
}
export function publicWatchProducts(products, settings) {
  return products.map(product => {
    if (settings.watchPreviewEnabled !== true || product.category !== 'watch') return product;
    return { id: product.id, name: product.name, category: product.category,
      description: product.description, active: product.active, images: product.images,
      metadata: { badge: product.metadata?.badge || '' }, createdAt: product.createdAt,
      prices: [], priceHidden: true };
  });
}
export function watchCatalog(settings, { admin = false } = {}) {
  let prices;
  try { prices = settings.watchPricing === undefined ? defaultWatchPricing() : validateWatchPricing(settings.watchPricing); }
  catch { prices = { bases: Object.fromEntries(WATCH_MODELS.map(m => [m.id, null])), fees: { face: null, band: null } }; }
  const hidden = settings.watchPreviewEnabled === true && !admin;
  return {
    previewEnabled: settings.watchPreviewEnabled === true, priceHidden: hidden,
    currency: 'CAD', checkoutEnabled: false, watchesMode: settings.watchesMode === 'shop' ? 'shop' : 'waitlist',
    maxQuantity: MAX_QUANTITY, maxComponentCents: hidden ? null : MAX_COMPONENT_CENTS, pricingPolicy: 'base-plus-changes',
    models: WATCH_MODELS.map(m => ({ id: m.id, name: m.name, face: m.face, band: m.band, cents: hidden ? null : prices.bases[m.id] })),
    fees: hidden ? { face: null, band: null } : prices.fees,
    face: FACE_IDS.map(id => ({ id, name: name(id) })),
    band: BAND_IDS.map(id => ({ id, name: name(id) }))
  };
}
export function canonicalWatchItems(items) {
  if (!Array.isArray(items) || items.length > 100) throw new Error('Cart must be a list of at most 100 entries.');
  const pairs = new Map();
  for (const item of items) {
    if (!object(item) || Object.keys(item).some(k => !['baseId', 'face', 'band', 'quantity'].includes(k)) ||
        !WATCH_MODELS.some(m => m.id === item.baseId) ||
        !FACE_IDS.includes(item.face) || !BAND_IDS.includes(item.band) ||
        !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY) throw new Error('Invalid watch pair or quantity (1–20).');
    const key = `${item.baseId}:${item.face}:${item.band}`;
    const quantity = (pairs.get(key)?.quantity || 0) + item.quantity;
    if (quantity > MAX_QUANTITY) throw new Error('Maximum quantity is 20 for each exact pair.');
    pairs.set(key, { baseId: item.baseId, face: item.face, band: item.band, quantity });
  }
  return [...pairs.values()];
}
export function quoteWatches(items, settings) {
  const catalog = watchCatalog(settings);
  const lines = canonicalWatchItems(items).map(item => {
    const face = catalog.face.find(x => x.id === item.face), band = catalog.band.find(x => x.id === item.band);
    const model = catalog.models.find(m => m.id === item.baseId);
    const faceChanged = item.face !== model.face, bandChanged = item.band !== model.band;
    const priceHidden = catalog.priceHidden;
    const faceChangeCents = priceHidden ? null : faceChanged ? catalog.fees.face : 0, bandChangeCents = priceHidden ? null : bandChanged ? catalog.fees.band : 0;
    const available = priceHidden || (model.cents !== null && faceChangeCents !== null && bandChangeCents !== null);
    const unitCents = available && !priceHidden ? model.cents + faceChangeCents + bandChangeCents : null;
    return { ...item, baseName: model.name, originalFace: model.face, originalBand: model.band,
      faceName: face.name, bandName: band.name, baseCents: model.cents, faceChanged, bandChanged, faceChangeCents, bandChangeCents,
      available, priceHidden, saleAvailable: !priceHidden && available && catalog.watchesMode === 'shop', unitCents, lineCents: unitCents === null ? null : unitCents * item.quantity };
  });
  const available = lines.every(x => x.available);
  return { currency: 'CAD', checkoutEnabled: false, informational: true, lines, available, priceHidden: catalog.priceHidden,
    totalCents: available && !catalog.priceHidden ? lines.reduce((sum, x) => sum + x.lineCents, 0) : null,
    quantity: lines.reduce((sum, x) => sum + x.quantity, 0) };
}
