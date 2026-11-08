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
function readFileStore(strict = false) {
  try {
    if (!fs.existsSync(FILE_PATH)) return [];
    const raw = fs.readFileSync(FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) && strict) throw Error('Invalid waitlist file.');
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    if (strict) throw new Error('Waitlist file unavailable. Sending is paused.');
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
    await pool.query(`ALTER TABLE waitlist_emails ADD COLUMN IF NOT EXISTS ref_code VARCHAR(16)`);
    await pool.query(`ALTER TABLE waitlist_emails ADD COLUMN IF NOT EXISTS referred_by VARCHAR(16)`);
    await pool.query(`ALTER TABLE waitlist_emails ADD COLUMN IF NOT EXISTS referral_count INT NOT NULL DEFAULT 0`);
    await pool.query(`ALTER TABLE waitlist_emails ADD COLUMN IF NOT EXISTS invitation_consent BOOLEAN NOT NULL DEFAULT FALSE`);
    await pool.query(`ALTER TABLE waitlist_emails ADD COLUMN IF NOT EXISTS marketing_unsubscribed BOOLEAN NOT NULL DEFAULT FALSE`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS waitlist_emails_ref_code_unique ON waitlist_emails (ref_code)`);
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
            `INSERT INTO waitlist_emails (email, category, created_at, ref_code, referred_by, referral_count, invitation_consent, marketing_unsubscribed)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (email, category) DO UPDATE SET invitation_consent = waitlist_emails.invitation_consent OR EXCLUDED.invitation_consent, marketing_unsubscribed = waitlist_emails.marketing_unsubscribed OR EXCLUDED.marketing_unsubscribed`,
            [item.email, item.category || 'watches', item.created_at || new Date(),
             item.ref_code || null, item.referred_by || null, item.referral_count || 0, item.invitation_consent === true, item.marketing_unsubscribed === true]
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

// ---------- referral helpers ----------
import { randomBytes } from 'crypto';
function newRefCode() {
  return randomBytes(4).toString('hex'); // 8 chars
}

// Waitlist ranking: earlier signups first, each referral moves you up a day.
function score(entry) {
  const t = new Date(entry.created_at || Date.now()).getTime();
  return t - (entry.referral_count || 0) * 86400000;
}

async function computePosition(refCode, category) {
  const all = (await getWaitlist()).filter(e => (e.category || 'watches') === category);
  const sorted = all.sort((a, b) => score(a) - score(b));
  const idx = sorted.findIndex(e => e.ref_code === refCode);
  return { position: idx >= 0 ? idx + 1 : null, total: sorted.length };
}

// ---------- add ----------
export async function addToWaitlist(email, category = 'watches', referredBy = null, invitationConsent = false) {
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedCategory = (category || 'watches').toLowerCase().trim();
  const refBy = referredBy ? String(referredBy).slice(0, 16) : null;
  const refCode = newRefCode();

  let outcome = null;

  if (dbReady) {
    try {
      const result = await pool.query(
        `INSERT INTO waitlist_emails (email, category, ref_code, referred_by, invitation_consent) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email, category) DO NOTHING RETURNING *`,
        [normalizedEmail, normalizedCategory, refCode, refBy, invitationConsent === true]
      );
      if (result.rows.length > 0) {
        if (refBy) {
          await pool.query(
            `UPDATE waitlist_emails SET referral_count = referral_count + 1 WHERE ref_code = $1 AND ref_code IS DISTINCT FROM $2`,
            [refBy, refCode]
          ).catch(() => {});
        }
        outcome = { added: true, refCode };
      } else {
        if (invitationConsent === true) {
          await pool.query(`UPDATE waitlist_emails SET invitation_consent = TRUE WHERE email = $1 AND category = $2`, [normalizedEmail, normalizedCategory]);
        }
        const existing = await pool.query(
          `SELECT ref_code FROM waitlist_emails WHERE email = $1 AND category = $2`,
          [normalizedEmail, normalizedCategory]
        );
        let code = existing.rows[0] && existing.rows[0].ref_code;
        if (!code) {
          // Older signups predate ref codes — assign one now.
          code = refCode;
          await pool.query(`UPDATE waitlist_emails SET ref_code = $1 WHERE email = $2 AND category = $3`,
            [code, normalizedEmail, normalizedCategory]).catch(() => {});
        }
        outcome = { added: false, refCode: code };
      }
    } catch (e) {
      console.error('Waitlist DB insert failed, saving to file instead:', e.message);
    }
  }

  if (!outcome) {
    // File fallback — never lose a signup. Serialized so concurrent writes don't clobber.
    outcome = await withFileStore(() => {
      const items = readFileStore();
      const existing = items.find(i => i.email === normalizedEmail && (i.category || 'watches') === normalizedCategory);
      if (existing) {
        if (invitationConsent === true) { existing.invitation_consent = true; writeFileStore(items); }
        if (!existing.ref_code) { existing.ref_code = refCode; writeFileStore(items); }
        return { added: false, refCode: existing.ref_code };
      }
      items.push({
        email: normalizedEmail, category: normalizedCategory,
        created_at: new Date().toISOString(), ref_code: refCode,
        referred_by: refBy, referral_count: 0,
        invitation_consent: invitationConsent === true,
      });
      if (refBy) {
        const referrer = items.find(i => i.ref_code === refBy);
        if (referrer && referrer.ref_code !== refCode) referrer.referral_count = (referrer.referral_count || 0) + 1;
      }
      writeFileStore(items);
      return { added: true, refCode };
    });
  }

  const { position, total } = await computePosition(outcome.refCode, normalizedCategory).catch(() => ({ position: null, total: null }));
  return { added: outcome.added, email: normalizedEmail, category: normalizedCategory, refCode: outcome.refCode, position, total };
}

// ---------- referral lookups ----------
export async function findByRefCode(refCode) {
  const code = String(refCode || '').slice(0, 16);
  if (!code) return null;
  const all = await getWaitlist();
  return all.find(e => e.ref_code === code) || null;
}

export async function getReferralStatus(refCode) {
  const entry = await findByRefCode(refCode);
  if (!entry) return null;
  const { position, total } = await computePosition(entry.ref_code, entry.category || 'watches');
  return { position, total, referralCount: entry.referral_count || 0, category: entry.category || 'watches' };
}

// ---------- list ----------
export async function getWaitlist({ strict = false } = {}) {
  if (strict && pool && !dbReady) throw new Error('Waitlist database unavailable. Sending is paused.');
  let rows = [];
  if (dbReady) {
    try {
      const result = await pool.query('SELECT * FROM waitlist_emails ORDER BY created_at DESC');
      rows = result.rows;
    } catch (e) {
      if (strict) throw new Error('Waitlist database unavailable. Sending is paused.');
      console.error('Waitlist DB read failed:', e.message);
    }
  }
  const fileItems = readFileStore(strict).map((i, idx) => ({
    id: 'file-' + idx,
    email: i.email,
    category: i.category || 'watches',
    created_at: i.created_at,
    ref_code: i.ref_code || null,
    referred_by: i.referred_by || null,
    referral_count: i.referral_count || 0,
    invitation_consent: i.invitation_consent === true,
    marketing_unsubscribed: i.marketing_unsubscribed === true,
  }));
  return [...fileItems, ...rows];
}

// Unsubscribe all categories for this address; future imports/signups must not
// erase this flag. Keep the entry/history instead of deleting the subscriber.
export async function unsubscribeMarketing(email) {
  if (pool && !dbReady) throw new Error('Please try again shortly; subscription storage is unavailable.');
  if (dbReady) await pool.query('UPDATE waitlist_emails SET marketing_unsubscribed = TRUE WHERE lower(email) = $1', [email.toLowerCase()]);
  await withFileStore(() => {
    const items = readFileStore(true);
    for (const item of items) if (item.email.toLowerCase() === email.toLowerCase()) item.marketing_unsubscribed = true;
    writeFileStore(items);
  });
}
