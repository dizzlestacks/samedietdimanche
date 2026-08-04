import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// DATA_DIR can point at a persistent disk (e.g. a Railway Volume mounted at
// /data) so file-backed signups survive redeploys even without a database.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const FILE_PATH = path.join(DATA_DIR, 'waitlist.json');

// Railway/other hosts expose the connection string under different names,
// and users sometimes paste values with quotes/whitespace. Be forgiving.
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
    // Guard against an unresolved Railway reference pasted literally
    if (cleaned.startsWith('postgres://') || cleaned.startsWith('postgresql://')) {
      return cleaned;
    }
  }
  return null;
}

const databaseUrl = findDatabaseUrl();
const pool = databaseUrl ? new pg.Pool({ connectionString: databaseUrl }) : null;
let dbReady = false;

export function waitlistStorageMode() {
  return dbReady ? 'database' : 'file';
}

// ---------- file fallback ----------
function readFileStore() {
  try {
    if (!fs.existsSync(FILE_PATH)) return [];
    const raw = fs.readFileSync(FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    // Corrupted file (e.g. crash mid-write): keep a backup instead of silently losing it.
    try {
      fs.copyFileSync(FILE_PATH, FILE_PATH + '.corrupt-' + Date.now());
      console.error('Waitlist file was corrupted — backed it up and starting fresh:', e.message);
    } catch (_) {}
    return [];
  }
}

// Atomic write: write to a temp file then rename, so a crash never truncates the store.
function writeFileStore(items) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = FILE_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(items, null, 2));
  fs.renameSync(tmp, FILE_PATH);
}

// Serialize all read-modify-write cycles so concurrent signups can't clobber each other.
let fileQueue = Promise.resolve();
function withFileStore(fn) {
  const run = fileQueue.then(() => fn());
  fileQueue = run.catch(() => {});
  return run;
}

// ---------- init ----------
export async function initWaitlistTable() {
  if (!pool) {
    console.log('Waitlist: no database connected — emails will be saved to data/waitlist.json instead.');
    return;
  }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS waitlist_emails (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        category VARCHAR(32) NOT NULL DEFAULT 'watches',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`ALTER TABLE waitlist_emails ADD COLUMN IF NOT EXISTS category VARCHAR(32) NOT NULL DEFAULT 'watches'`);
    await pool.query(`ALTER TABLE waitlist_emails DROP CONSTRAINT IF EXISTS waitlist_emails_email_key`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS waitlist_emails_email_category_unique ON waitlist_emails (email, category)`);
    dbReady = true;
    // Import any emails that were captured to file while the DB was down.
    // Runs inside the file queue so concurrent signups can't be erased,
    // and only removes the entries that were successfully imported.
    await withFileStore(async () => {
      const fileItems = readFileStore();
      if (fileItems.length === 0) return;
      const imported = new Set();
      for (const item of fileItems) {
        try {
          await pool.query(
            `INSERT INTO waitlist_emails (email, category, created_at) VALUES ($1, $2, $3)
             ON CONFLICT (email, category) DO NOTHING`,
            [item.email, item.category || 'watches', item.created_at || new Date()]
          );
          imported.add(item.email + '|' + (item.category || 'watches'));
        } catch (e) {
          console.error('Waitlist import of', item.email, 'failed, keeping it in the file:', e.message);
        }
      }
      const remaining = readFileStore().filter(
        i => !imported.has(i.email + '|' + (i.category || 'watches'))
      );
      writeFileStore(remaining);
      console.log(`Waitlist: imported ${imported.size} email(s) from file into the database.`);
    });
    console.log('Waitlist table ready');
  } catch (e) {
    console.error('Waitlist DB unavailable, falling back to file storage:', e.message);
  }
}

// ---------- add ----------
export async function addToWaitlist(email, category = 'watches') {
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedCategory = (category || 'watches').toLowerCase().trim();

  if (dbReady) {
    try {
      const result = await pool.query(
        `INSERT INTO waitlist_emails (email, category) VALUES ($1, $2)
         ON CONFLICT (email, category) DO NOTHING RETURNING *`,
        [normalizedEmail, normalizedCategory]
      );
      return { added: result.rows.length > 0, email: normalizedEmail, category: normalizedCategory };
    } catch (e) {
      console.error('Waitlist DB insert failed, saving to file instead:', e.message);
    }
  }

  // File fallback — never lose a signup. Serialized so concurrent writes don't clobber.
  return withFileStore(() => {
    const items = readFileStore();
    const exists = items.some(i => i.email === normalizedEmail && (i.category || 'watches') === normalizedCategory);
    if (!exists) {
      items.push({ email: normalizedEmail, category: normalizedCategory, created_at: new Date().toISOString() });
      writeFileStore(items);
    }
    return { added: !exists, email: normalizedEmail, category: normalizedCategory };
  });
}

// ---------- list ----------
export async function getWaitlist() {
  let rows = [];
  if (dbReady) {
    try {
      const result = await pool.query('SELECT * FROM waitlist_emails ORDER BY created_at DESC');
      rows = result.rows;
    } catch (e) {
      console.error('Waitlist DB read failed:', e.message);
    }
  }
  const fileItems = readFileStore().map((i, idx) => ({
    id: 'file-' + idx,
    email: i.email,
    category: i.category || 'watches',
    created_at: i.created_at,
  }));
  return [...fileItems, ...rows];
}
