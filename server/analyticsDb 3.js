// Lightweight, privacy-friendly page-view analytics.
// Counts are aggregated per (day, path) — no cookies, no personal data.
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const FILE_PATH = path.join(DATA_DIR, 'analytics.json');

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
    if (cleaned.startsWith('postgres://') || cleaned.startsWith('postgresql://')) return cleaned;
  }
  return null;
}

const databaseUrl = findDatabaseUrl();
const pool = databaseUrl ? new pg.Pool({ connectionString: databaseUrl }) : null;
let dbReady = false;

// In-memory buffer flushed periodically so we never do a write per page view.
const buffer = new Map(); // key: day|path -> count

function readFileStore() {
  try {
    if (!fs.existsSync(FILE_PATH)) return {};
    const parsed = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) { return {}; }
}

function writeFileStore(obj) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = FILE_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj));
  fs.renameSync(tmp, FILE_PATH);
}

export async function initAnalyticsTable() {
  if (pool) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS page_views (
          day DATE NOT NULL,
          path VARCHAR(200) NOT NULL,
          views INT NOT NULL DEFAULT 0,
          PRIMARY KEY (day, path)
        )
      `);
      dbReady = true;
      console.log('Analytics table ready');
    } catch (e) {
      console.error('Analytics DB unavailable, using file storage:', e.message);
    }
  }
  setInterval(flush, 30000).unref();
}

export function trackView(reqPath) {
  let p = String(reqPath || '/').split('?')[0].toLowerCase();
  if (p === '/index.html' || p === '') p = '/';
  if (p.length > 100) return;
  const day = new Date().toISOString().slice(0, 10);
  const key = day + '|' + p;
  buffer.set(key, (buffer.get(key) || 0) + 1);
}

export async function flush() {
  if (buffer.size === 0) return;
  const entries = [...buffer.entries()];
  buffer.clear();
  if (dbReady) {
    try {
      for (const [key, count] of entries) {
        const [day, p] = key.split('|');
        await pool.query(
          `INSERT INTO page_views (day, path, views) VALUES ($1, $2, $3)
           ON CONFLICT (day, path) DO UPDATE SET views = page_views.views + $3`,
          [day, p, count]
        );
      }
      return;
    } catch (e) {
      console.error('Analytics DB flush failed, using file:', e.message);
    }
  }
  const store = readFileStore();
  for (const [key, count] of entries) {
    store[key] = (store[key] || 0) + count;
  }
  writeFileStore(store);
}

export async function getAnalytics(days = 30) {
  await flush().catch(() => {});
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const byDay = {};
  const byPath = {};

  if (dbReady) {
    try {
      const result = await pool.query('SELECT day, path, views FROM page_views WHERE day >= $1', [since]);
      for (const row of result.rows) {
        const day = new Date(row.day).toISOString().slice(0, 10);
        byDay[day] = (byDay[day] || 0) + row.views;
        byPath[row.path] = (byPath[row.path] || 0) + row.views;
      }
    } catch (e) {
      console.error('Analytics DB read failed:', e.message);
    }
  }
  const store = readFileStore();
  for (const key of Object.keys(store)) {
    const [day, p] = key.split('|');
    if (day >= since) {
      byDay[day] = (byDay[day] || 0) + store[key];
      byPath[p] = (byPath[p] || 0) + store[key];
    }
  }
  const totalViews = Object.values(byDay).reduce((a, b) => a + b, 0);
  return { byDay, byPath, totalViews, days };
}
