import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// DATA_DIR can point at a persistent disk (e.g. a Railway Volume mounted at
// /data) so settings survive redeploys even without a database.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const FILE_PATH = path.join(DATA_DIR, 'settings.json');

export const DEFAULT_SETTINGS = {
  watchesMode: 'waitlist', // 'waitlist' | 'shop'
  watchHeadline: 'Be First to Know',
  watchSub: 'Exclusive early access for waitlist members',
  watchSpecs: [
    { label: 'Movement', value: 'Automatic · Japanese NH35' },
    { label: 'Case & Finish', value: '316L Stainless · 40mm · Stainless · 14k Gold · Pure Silver' },
    { label: 'Crystal', value: 'Sapphire · Anti-Reflective' },
    { label: 'Dials', value: 'Red · Navy · Forest · Midnight' },
    { label: 'Edition', value: 'Limited — Numbered Pieces' },
  ],
};

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
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function updateSettings(patch) {
  const clean = {};
  if (patch.watchesMode !== undefined) {
    clean.watchesMode = patch.watchesMode === 'shop' ? 'shop' : 'waitlist';
  }
  if (patch.watchHeadline !== undefined) {
    clean.watchHeadline = String(patch.watchHeadline).slice(0, 200);
  }
  if (patch.watchSub !== undefined) {
    clean.watchSub = String(patch.watchSub).slice(0, 300);
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
