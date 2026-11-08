import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const FILE_PATH = path.join(DATA_DIR, 'reviews.json');

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

function readFileStore() {
  try {
    if (!fs.existsSync(FILE_PATH)) return [];
    const parsed = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    try { fs.copyFileSync(FILE_PATH, FILE_PATH + '.corrupt-' + Date.now()); } catch (_) {}
    return [];
  }
}

function writeFileStore(items) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = FILE_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(items, null, 2));
  fs.renameSync(tmp, FILE_PATH);
}

let fileQueue = Promise.resolve();
function withFileStore(fn) {
  const run = fileQueue.then(() => fn());
  fileQueue = run.catch(() => {});
  return run;
}

export async function initReviewsTable() {
  if (!pool) {
    console.log('Reviews: no database connected — using data/reviews.json.');
    return;
  }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        rating INT NOT NULL DEFAULT 5,
        text TEXT NOT NULL DEFAULT '',
        photo VARCHAR(500) DEFAULT '',
        product VARCHAR(200) DEFAULT '',
        approved BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    dbReady = true;
    await withFileStore(async () => {
      const items = readFileStore();
      if (items.length === 0) return;
      const kept = [];
      for (const r of items) {
        try {
          await pool.query(
            `INSERT INTO reviews (name, rating, text, photo, product, approved, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [r.name, r.rating, r.text, r.photo || '', r.product || '', Boolean(r.approved), r.created_at || new Date()]
          );
        } catch (e) { kept.push(r); }
      }
      writeFileStore(kept);
    });
    console.log('Reviews table ready');
  } catch (e) {
    console.error('Reviews DB unavailable, using file storage:', e.message);
  }
}

function cleanReview(input) {
  const rating = Math.max(1, Math.min(5, parseInt(input.rating, 10) || 5));
  return {
    name: String(input.name || '').trim().slice(0, 120),
    rating,
    text: String(input.text || '').trim().slice(0, 2000),
    photo: String(input.photo || '').slice(0, 500),
    product: String(input.product || '').slice(0, 200),
  };
}

export async function addReview(input) {
  const r = cleanReview(input);
  if (!r.name || !r.text) throw new Error('Name and review text are required');
  if (dbReady) {
    try {
      const result = await pool.query(
        `INSERT INTO reviews (name, rating, text, photo, product) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [r.name, r.rating, r.text, r.photo, r.product]
      );
      return { id: result.rows[0].id, pending: true };
    } catch (e) {
      console.error('Review DB insert failed, saving to file:', e.message);
    }
  }
  return withFileStore(() => {
    const items = readFileStore();
    const id = 'file-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    items.push({ ...r, id, approved: false, created_at: new Date().toISOString() });
    writeFileStore(items);
    return { id, pending: true };
  });
}

export async function getReviews({ approvedOnly = true } = {}) {
  let rows = [];
  if (dbReady) {
    try {
      const result = approvedOnly
        ? await pool.query('SELECT * FROM reviews WHERE approved = TRUE ORDER BY created_at DESC')
        : await pool.query('SELECT * FROM reviews ORDER BY created_at DESC');
      rows = result.rows;
    } catch (e) {
      console.error('Review DB read failed:', e.message);
    }
  }
  let fileItems = readFileStore();
  if (approvedOnly) fileItems = fileItems.filter(r => r.approved);
  return [...fileItems, ...rows];
}

export async function setReviewApproval(id, approved) {
  if (dbReady && !String(id).startsWith('file-')) {
    try {
      await pool.query('UPDATE reviews SET approved = $1 WHERE id = $2', [Boolean(approved), parseInt(id, 10)]);
      return { ok: true };
    } catch (e) {
      console.error('Review approval update failed:', e.message);
    }
  }
  return withFileStore(() => {
    const items = readFileStore();
    const r = items.find(i => String(i.id) === String(id));
    if (!r) throw new Error('Review not found');
    r.approved = Boolean(approved);
    writeFileStore(items);
    return { ok: true };
  });
}

export async function deleteReview(id) {
  if (dbReady && !String(id).startsWith('file-')) {
    try {
      await pool.query('DELETE FROM reviews WHERE id = $1', [parseInt(id, 10)]);
      return { ok: true };
    } catch (e) {
      console.error('Review delete failed:', e.message);
    }
  }
  return withFileStore(() => {
    const items = readFileStore().filter(i => String(i.id) !== String(id));
    writeFileStore(items);
    return { ok: true };
  });
}
