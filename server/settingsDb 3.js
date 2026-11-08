import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { emptyWatchPrices, validateWatchPrices, defaultWatchPricing, validateWatchPricing } from './watchPricing.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// DATA_DIR can point at a persistent disk (e.g. a Railway Volume mounted at
// /data) so settings survive redeploys even without a database.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const FILE_PATH = path.join(DATA_DIR, 'settings.json');

export const DEFAULT_SETTINGS = {
  preorderWatchesEnabled: false,
  preorderShopEnabled: false,
  shopWaitlistEnabled: false,
  preorderFulfillmentNote: '',
  preorderWatchesRevision: 'initial',
  preorderShopRevision: 'initial',
  salesTaxEnabled: true,
  watchComponentPrices: emptyWatchPrices(),
  watchPricing: defaultWatchPricing(), // Legacy component maps are preserved but no longer used to quote.
  watchesMode: 'waitlist', // 'waitlist' | 'shop' | 'preorder'
  watchPreviewEnabled: false,
  womensWatchEnabled: true,
  watchHeadline: 'Be First to Know',
  watchSub: 'Exclusive early access for waitlist members',
  // Per-page waitlist settings (defaults match the current live pages)
  shopEnabled: true, // clothing shop: true = open, false = "coming soon"
  budWaitlistEnabled: true,
  budWaitlistHeadline: 'Be First to Know',
  budWaitlistSub: 'Exclusive early access for waitlist members',
  budWaitlistButton: 'Join the List',
  watchesWaitlistEnabled: true,
  watchesWaitlistButton: 'Join the List',
  // Drop hype
  dropDate: '',              // ISO date/time for countdown; empty = hidden
  countdownEnabled: true,
  editionTotal: 0,           // e.g. 100 numbered pieces; 0 = hidden
  editionClaimed: 0,         // manually updated (or bump from sales)
  earlyAccessEnabled: false, // waitlist members get a private shop link
  heroVideo: '',             // uploaded video URL for cinematic hero
  dialImages: [
    { name: 'Red', image: '' },
    { name: 'Navy', image: '' },
    { name: 'Forest', image: '' },
    { name: 'Midnight', image: '' },
  ],
  rotationFrames: [],        // ordered frame URLs for 360 viewer
  // Site-wide
  announcementText: '',
  announcementEnabled: false,
  dropTitle: 'The Drop',
  // Homepage tabs
  tabWatchesEnabled: true,
  tabBudEnabled: true,
  tabLookbookEnabled: false,
  // Homepage nav links — one source of truth for the index.html nav.
  // Order = array order. Seeded lazily from the tab flags in getSettings()
  // so older saved settings keep working (see buildDefaultHomepageLinks).
  homepageLinks: null,
  weekendThemeEnabled: true, // Samedi/Dimanche theme shifts on weekends
  tickSoundEnabled: true,
  // Commerce
  bundlesEnabled: false,
  bundles: [],               // [{ name, priceIds: [], note }]
  // Lookbook
  lookbook: [],              // [{ image, caption, link }]
  instagramUrl: 'https://www.instagram.com/samedietdimanche.official',
  // Socials page links — order = array order
  socialLinks: null,         // seeded lazily in getSettings()
  watchSpecs: [
    { label: 'Movement', value: 'Automatic · Japanese NH35' },
    { label: 'Case & Finish', value: '316L Stainless · 40mm · Stainless · 14k Gold · Pure Silver' },
    { label: 'Crystal', value: 'Sapphire · Anti-Reflective' },
    { label: 'Dials', value: 'Red · Navy · Forest · Midnight' },
    { label: 'Edition', value: 'Limited — Numbered Pieces' },
  ],
};

// Only allow http(s) URLs or same-site relative paths — blocks javascript: etc.
function safeUrl(value) {
  const s = String(value || '').trim().slice(0, 500);
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  if (/^\/?[a-z0-9_\-./]+$/i.test(s) && !s.includes('..') && !s.includes('//')) return s;
  return '';
}

function findDatabaseUrl() {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.DATABASE_PRIVATE_URL,
    process.env.DATABASE_PUBLIC_URL,
    process.env.POSTGRES_URL,
    process.env.PG_URL,
  ];
  for (let raw of candidates) {
    if (!raw) continue;
    const cleaned = raw.trim().replace(/^["']|["']$/g, '');
    if (cleaned.startsWith('postgres://') || cleaned.startsWith('postgresql://')) {
      return cleaned;
    }
  }
  return null;
}

const databaseUrl = findDatabaseUrl();
const pool = databaseUrl ? new pg.Pool({ connectionString: databaseUrl }) : null;
let dbReady = false;

function readFileStore() {
  try {
    if (!fs.existsSync(FILE_PATH)) return {};
    const parsed = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    try {
      fs.copyFileSync(FILE_PATH, FILE_PATH + '.corrupt-' + Date.now());
      console.error('Settings file was corrupted — backed it up:', e.message);
    } catch (_) {}
    return {};
  }
}

function writeFileStore(obj) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = FILE_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, FILE_PATH);
}

let fileQueue = Promise.resolve();
function withFileStore(fn) {
  const run = fileQueue.then(() => fn());
  fileQueue = run.catch(() => {});
  return run;
}

export async function initSettingsTable() {
  if (!pool) {
    console.log('Settings: no database connected — using data/settings.json.');
    return;
  }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS site_settings (
        key VARCHAR(64) PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    dbReady = true;
    // Import any settings saved to file while the DB was down.
    await replayFileToDb();
    console.log('Site settings table ready');
  } catch (e) {
    console.error('Settings DB unavailable, falling back to file storage:', e.message);
  }
}

// Replay any file-backed settings (written while the DB was unreachable)
// into the DB, clearing the file only for keys that made it in.
async function replayFileToDb() {
  if (!dbReady) return;
  await withFileStore(async () => {
    const fileSettings = readFileStore();
    const keys = Object.keys(fileSettings);
    if (keys.length === 0) return;
    const synced = [];
    for (const key of keys) {
      try {
        await pool.query(
          `INSERT INTO site_settings (key, value, updated_at) VALUES ($1, $2, NOW())
           ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
          [key, JSON.stringify(fileSettings[key])]
        );
        synced.push(key);
      } catch (e) {
        break; // DB still down — keep everything in the file
      }
    }
    if (synced.length > 0) {
      const remaining = readFileStore();
      for (const key of synced) delete remaining[key];
      writeFileStore(remaining);
      console.log(`Settings: synced ${synced.length} file-backed setting(s) into the database.`);
    }
  });
}

export async function getSettings() {
  let stored = {};
  if (dbReady) {
    await replayFileToDb().catch(() => {});
    try {
      const result = await pool.query('SELECT key, value FROM site_settings');
      for (const row of result.rows) stored[row.key] = row.value;
    } catch (e) {
      console.error('Settings DB read failed, using file:', e.message);
    }
  }
  // File-backed writes are always newest — they only exist when a DB write failed.
  stored = { ...stored, ...readFileStore() };
  const merged = { ...DEFAULT_SETTINGS, ...stored };
  // Migrate: absorb the legacy per-tab flags into the unified links list.
  if (!Array.isArray(merged.homepageLinks)) {
    merged.homepageLinks = buildDefaultHomepageLinks(merged);
  }
  // Lookbook was removed from the site — scrub any stored link to it.
  merged.homepageLinks = merged.homepageLinks.filter(l => !l || !/lookbook\.html$/.test(String(l.url || '')));
  if (!Array.isArray(merged.socialLinks)) {
    merged.socialLinks = [
      { label: 'Instagram', sublabel: '@samedietdimanche.ca', url: merged.instagramUrl || 'https://www.instagram.com/samedietdimanche.ca', enabled: true },
      { label: 'Website', sublabel: 'samedietdimanche.ca', url: 'https://www.samedietdimanche.ca', enabled: true },
    ];
  }
  return merged;
}

// Default homepage nav links, honoring legacy tab enable flags so settings
// saved before homepageLinks existed keep behaving the same.
export function buildDefaultHomepageLinks(s) {
  return [
    { label: 'Watches', sublabel: 'Automatic \u00b7 Limited', url: 'watches.html', enabled: s.tabWatchesEnabled !== false },
    { label: 'Bud', sublabel: 'The Bud Collection', url: 'bud.html', enabled: s.tabBudEnabled !== false },
    { label: 'Shop', sublabel: 'The Collection', url: 'shop.html', enabled: true },
    { label: 'Socials', sublabel: 'Follow Along', url: 'socials.html', enabled: true },
  ];
}

export async function updateSettings(patch) {
  if (Object.hasOwn(patch, 'womensWatchEnabled') && typeof patch.womensWatchEnabled !== 'boolean') {
    throw new Error('womensWatchEnabled must be a boolean.');
  }
  const clean = {};
  if (Object.hasOwn(patch, 'womensWatchEnabled')) clean.womensWatchEnabled = patch.womensWatchEnabled;
  if (Object.hasOwn(patch, 'watchPreviewEnabled')) {
    if (typeof patch.watchPreviewEnabled !== 'boolean') throw new Error('watchPreviewEnabled must be a boolean.');
    clean.watchPreviewEnabled = patch.watchPreviewEnabled;
  }
  if (patch.watchPricing !== undefined) clean.watchPricing = validateWatchPricing(patch.watchPricing);
  if (patch.watchComponentPrices !== undefined) clean.watchComponentPrices = validateWatchPrices(patch.watchComponentPrices);
  if (patch.watchesMode !== undefined) {
    if(!['waitlist','shop','preorder'].includes(patch.watchesMode))throw Error('Choose Waitlist, Shop or Pre-order.');
    clean.watchesMode = patch.watchesMode;
  }
  if (patch.watchHeadline !== undefined) {
    clean.watchHeadline = String(patch.watchHeadline).slice(0, 200);
  }
  if (patch.watchSub !== undefined) {
    clean.watchSub = String(patch.watchSub).slice(0, 300);
  }
  if (patch.shopEnabled !== undefined) clean.shopEnabled = Boolean(patch.shopEnabled);
  for(const key of ['preorderWatchesEnabled','preorderShopEnabled','shopWaitlistEnabled']){
    if(patch[key]!==undefined){
      if(typeof patch[key]!=='boolean')throw Error('Preorder and waitlist switches must be on or off.');
      clean[key]=patch[key];
    }
  }
  if(patch.preorderFulfillmentNote!==undefined){
    if(typeof patch.preorderFulfillmentNote!=='string'||patch.preorderFulfillmentNote.trim().length>300)throw Error('Use a shipping estimate of at most 300 characters.');
    clean.preorderFulfillmentNote=patch.preorderFulfillmentNote.trim();
  }
  for(const key of ['preorderWatchesRevision','preorderShopRevision']){
    if(patch[key]!==undefined){
      if(typeof patch[key]!=='string'||!/^[a-f0-9-]{36}$/.test(patch[key]))throw Error('Invalid preorder link revision.');
      clean[key]=patch[key];
    }
  }
  if(patch.watchesMode!==undefined||patch.preorderWatchesEnabled!==undefined||patch.preorderShopEnabled!==undefined||patch.preorderFulfillmentNote!==undefined){
    const next={...await getSettings(),...clean};
    if((next.watchesMode==='preorder'||next.preorderWatchesEnabled||next.preorderShopEnabled)&&!next.preorderFulfillmentNote)throw Error('Add an expected shipping timeframe before enabling preorders.');
  }
  if (patch.salesTaxEnabled !== undefined) {
    if (typeof patch.salesTaxEnabled !== 'boolean') throw new Error('Sales tax must be on or off.');
    clean.salesTaxEnabled = patch.salesTaxEnabled;
  }
  if (patch.budWaitlistEnabled !== undefined) clean.budWaitlistEnabled = Boolean(patch.budWaitlistEnabled);
  if (patch.budWaitlistHeadline !== undefined) clean.budWaitlistHeadline = String(patch.budWaitlistHeadline).slice(0, 200);
  if (patch.budWaitlistSub !== undefined) clean.budWaitlistSub = String(patch.budWaitlistSub).slice(0, 300);
  if (patch.budWaitlistButton !== undefined) clean.budWaitlistButton = String(patch.budWaitlistButton).slice(0, 60);
  if (patch.watchesWaitlistEnabled !== undefined) clean.watchesWaitlistEnabled = Boolean(patch.watchesWaitlistEnabled);
  if (patch.watchesWaitlistButton !== undefined) clean.watchesWaitlistButton = String(patch.watchesWaitlistButton).slice(0, 60);
  if (patch.dropDate !== undefined) {
    const d = String(patch.dropDate).slice(0, 40);
    clean.dropDate = d && !isNaN(new Date(d).getTime()) ? d : '';
  }
  if (patch.editionTotal !== undefined) {
    clean.editionTotal = Math.max(0, Math.min(1000000, parseInt(patch.editionTotal, 10) || 0));
  }
  if (patch.editionClaimed !== undefined) {
    clean.editionClaimed = Math.max(0, Math.min(1000000, parseInt(patch.editionClaimed, 10) || 0));
  }
  if (patch.earlyAccessEnabled !== undefined) clean.earlyAccessEnabled = Boolean(patch.earlyAccessEnabled);
  if (patch.countdownEnabled !== undefined) {
    if (typeof patch.countdownEnabled !== 'boolean') throw new Error('countdownEnabled must be a boolean.');
    clean.countdownEnabled = patch.countdownEnabled;
  }
  if (patch.heroVideo !== undefined) clean.heroVideo = safeUrl(patch.heroVideo);
  if (patch.dialImages !== undefined) {
    if (!Array.isArray(patch.dialImages)) throw new Error('dialImages must be a list');
    clean.dialImages = patch.dialImages.slice(0, 12).map(d => ({
      name: String((d && d.name) || '').slice(0, 60),
      image: safeUrl(d && d.image),
      frames: Array.isArray(d && d.frames)
        ? d.frames.slice(0, 72).map(safeUrl).filter(Boolean)
        : [],
    })).filter(d => d.name);
  }
  if (patch.rotationFrames !== undefined) {
    if (!Array.isArray(patch.rotationFrames)) throw new Error('rotationFrames must be a list');
    clean.rotationFrames = patch.rotationFrames.slice(0, 72).map(safeUrl).filter(Boolean);
  }
  if (patch.announcementText !== undefined) clean.announcementText = String(patch.announcementText).slice(0, 300);
  if (patch.announcementEnabled !== undefined) clean.announcementEnabled = Boolean(patch.announcementEnabled);
  if (patch.dropTitle !== undefined) clean.dropTitle = String(patch.dropTitle).slice(0, 80);
  if (patch.homepageLinks !== undefined) {
    if (!Array.isArray(patch.homepageLinks)) throw new Error('homepageLinks must be a list');
    clean.homepageLinks = patch.homepageLinks.slice(0, 30).map(l => ({
      label: String((l && l.label) || '').slice(0, 60),
      sublabel: String((l && l.sublabel) || '').slice(0, 100),
      url: safeUrl(l && l.url),
      enabled: !l || l.enabled !== false,
    })).filter(l => l.label && l.url);
    // Keep the legacy per-tab flags in sync so any old cached frontend
    // (or old saved settings) can't disagree with the unified list.
    for (const link of clean.homepageLinks) {
      const u = link.url.replace(/^\//, '');
      if (u === 'watches.html') clean.tabWatchesEnabled = link.enabled;
      else if (u === 'bud.html') clean.tabBudEnabled = link.enabled;
    }
  }
  if (patch.tabWatchesEnabled !== undefined) clean.tabWatchesEnabled = Boolean(patch.tabWatchesEnabled);
  if (patch.tabBudEnabled !== undefined) clean.tabBudEnabled = Boolean(patch.tabBudEnabled);
  if (patch.tabLookbookEnabled !== undefined) clean.tabLookbookEnabled = Boolean(patch.tabLookbookEnabled);
  if (patch.weekendThemeEnabled !== undefined) clean.weekendThemeEnabled = Boolean(patch.weekendThemeEnabled);
  if (patch.tickSoundEnabled !== undefined) clean.tickSoundEnabled = Boolean(patch.tickSoundEnabled);
  if (patch.bundlesEnabled !== undefined) clean.bundlesEnabled = Boolean(patch.bundlesEnabled);
  if (patch.bundles !== undefined) {
    if (!Array.isArray(patch.bundles)) throw new Error('bundles must be a list');
    clean.bundles = patch.bundles.slice(0, 20).map(b => ({
      name: String((b && b.name) || '').slice(0, 120),
      priceIds: Array.isArray(b && b.priceIds) ? b.priceIds.slice(0, 10).map(p => String(p).slice(0, 100)) : [],
      note: String((b && b.note) || '').slice(0, 300),
    })).filter(b => b.name && b.priceIds.length > 0);
  }
  if (patch.lookbook !== undefined) {
    if (!Array.isArray(patch.lookbook)) throw new Error('lookbook must be a list');
    clean.lookbook = patch.lookbook.slice(0, 60).map(l => ({
      image: safeUrl(l && l.image),
      caption: String((l && l.caption) || '').slice(0, 300),
      link: safeUrl(l && l.link),
    })).filter(l => l.image);
  }
  if (patch.instagramUrl !== undefined) clean.instagramUrl = safeUrl(patch.instagramUrl).slice(0, 300);
  if (patch.socialLinks !== undefined) {
    if (!Array.isArray(patch.socialLinks)) throw new Error('socialLinks must be a list');
    clean.socialLinks = patch.socialLinks.slice(0, 20).map(l => ({
      label: String((l && l.label) || '').slice(0, 60),
      sublabel: String((l && l.sublabel) || '').slice(0, 100),
      url: safeUrl(l && l.url),
      enabled: !l || l.enabled !== false,
    })).filter(l => l.label && l.url);
  }
  if (patch.watchSpecs !== undefined) {
    if (!Array.isArray(patch.watchSpecs)) throw new Error('watchSpecs must be a list');
    clean.watchSpecs = patch.watchSpecs
      .filter(s => s && (String(s.label || '').trim() || String(s.value || '').trim()))
      .slice(0, 20)
      .map(s => ({ label: String(s.label || '').slice(0, 100), value: String(s.value || '').slice(0, 300) }));
  }

  if (dbReady) {
    try {
      for (const key of Object.keys(clean)) {
        await pool.query(
          `INSERT INTO site_settings (key, value, updated_at) VALUES ($1, $2, NOW())
           ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
          [key, JSON.stringify(clean[key])]
        );
      }
      return getSettings();
    } catch (e) {
      console.error('Settings DB write failed, saving to file:', e.message);
    }
  }

  await withFileStore(() => {
    const current = readFileStore();
    writeFileStore({ ...current, ...clean });
  });
  return getSettings();
}
