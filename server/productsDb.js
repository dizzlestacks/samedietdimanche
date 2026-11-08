// Local product catalog — lets the admin add products without any payment
// provider connected. Postgres when available, atomic JSON file fallback in
// data/ (or DATA_DIR) otherwise. Same resilience pattern as the other modules.
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const FILE_PATH = path.join(DATA_DIR, 'products.json');

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

function safeImage(url) {
  if (!url || typeof url !== 'string') return '';
  const t = url.trim().slice(0, 500);
  // Reject anything that could break out of an HTML attribute
  if (/["'<>`\s\\]/.test(t)) return '';
  if (t.startsWith('https://') || t.startsWith('http://') || (t.startsWith('/') && !t.startsWith('//'))) return t;
  return '';
}

function safeCategory(c) {
  return c === 'watch' ? 'watch' : 'shop';
}

export function validateProductImages(images) {
  if (!Array.isArray(images) || images.length > 12) throw new Error('Provide up to 12 product photos.');
  const clean = images.map(image => safeImage(image));
  if (clean.some(image => !image)) throw new Error('Each product photo must be a valid image URL.');
  return [...new Set(clean)];
}

export function validateProductVariants(variants) {
  if (!Array.isArray(variants) || variants.length > 100) throw new Error('Provide up to 100 clothing variants.');
  const ids = new Set(), options = new Set();
  return variants.map(v => {
    if (!v || typeof v !== 'object' || Array.isArray(v) ||
        Object.keys(v).some(k => !['id','size','color','stock','active'].includes(k)) ||
        typeof v.size !== 'string' || !v.size.trim() || v.size.trim().length > 60 ||
        typeof v.color !== 'string' || !v.color.trim() || v.color.trim().length > 60 ||
        !Number.isSafeInteger(v.stock) || v.stock < 0 || v.stock > 100000 ||
        (v.active !== undefined && typeof v.active !== 'boolean')) throw new Error('Each variant needs a size, color and whole-number stock from 0 to 100000.');
    const id = v.id === undefined ? 'var_' + crypto.randomBytes(12).toString('hex') : v.id;
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id) || ids.has(id)) throw new Error('Variant IDs must be valid and unique.');
    const key = JSON.stringify([v.size.trim().toLowerCase(), v.color.trim().toLowerCase()]);
    if (options.has(key)) throw new Error('Each size and color combination must be unique.');
    ids.add(id); options.add(key);
    return {id,size:v.size.trim(),color:v.color.trim(),stock:v.stock,active:v.active !== false};
  });
}

function inventoryRevision(r) {
  return crypto.createHash('sha256').update(JSON.stringify(r.variants || [])).digest('hex');
}
function checkInventoryRevision(row, patch) {
  if (patch.variants !== undefined && patch.inventoryRevision !== inventoryRevision(row)) {
    const error = new Error('Stock or options changed while this form was open. Close and reopen the product before saving.');
    error.status = 409;
    throw error;
  }
}
function rowToProduct(r, inventoryOrderId) {
  return {
    id: r.id,
    inventoryRevision: inventoryRevision(r),
    name: r.name,
    category: safeCategory(r.category),
    description: r.description || '',
    active: Boolean(r.active),
    images: Array.isArray(r.images) ? r.images : r.image ? [r.image] : [],
    variants: (Array.isArray(r.variants) ? r.variants : []).map(v => ({
      ...v, stock:v.stock + (Object.hasOwn(r.inventory_claims?.[inventoryOrderId] || {}, v.id) ? r.inventory_claims[inventoryOrderId][v.id] : 0),
    })),
    metadata: { badge: r.badge || '' },
    prices: [{
      id: 'local_' + r.id,
      unit_amount: Number(r.unit_amount) || 0,
      currency: 'cad',
      active: Boolean(r.active),
    }],
    createdAt: r.created_at || r.createdAt || null,
  };
}

export async function initProductsTable() {
  if (!pool) {
    console.log('Products: no database connected — using data/products.json.');
    return;
  }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS local_products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        unit_amount INTEGER NOT NULL DEFAULT 0,
        image TEXT DEFAULT '',
        badge TEXT DEFAULT '',
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`ALTER TABLE local_products ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'shop'`);
    await pool.query(`ALTER TABLE local_products ADD COLUMN IF NOT EXISTS images JSONB`);
    await pool.query(`ALTER TABLE local_products ADD COLUMN IF NOT EXISTS variants JSONB NOT NULL DEFAULT '[]'`);
    await pool.query(`ALTER TABLE local_products ADD COLUMN IF NOT EXISTS inventory_claims JSONB NOT NULL DEFAULT '{}'`);
    dbReady = true;
    // Import any file-fallback products created while the DB was away
    const fileItems = readFileStore();
    if (fileItems.length > 0) {
      for (const it of fileItems) {
        await pool.query(
          `INSERT INTO local_products (id, name, description, unit_amount, image, badge, active, category, created_at, images, variants, inventory_claims)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9, NOW()),$10,$11,$12) ON CONFLICT (id) DO NOTHING`,
          [it.id, it.name, it.description || '', it.unit_amount || 0, it.image || '', it.badge || '', it.active !== false, safeCategory(it.category), it.createdAt || null, JSON.stringify(it.images || (it.image ? [it.image] : [])), JSON.stringify(it.variants || []), JSON.stringify(it.inventory_claims || {})]
        );
      }
      await withFileStore(() => writeFileStore([]));
      console.log(`Products: imported ${fileItems.length} product(s) from file into database.`);
    }
    console.log('Products table ready (database).');
  } catch (e) {
    console.error('Products table init failed — using file fallback:', e.message);
  }
}

export async function listProducts({ activeOnly = false, category = null, inventoryOrderId } = {}) {
  const cat = category ? safeCategory(category) : null;
  if (pool && dbReady) {
    try {
      const conds = [];
      const params = [];
      if (activeOnly) conds.push('active = TRUE');
      if (cat) {
        params.push(cat);
        conds.push(`COALESCE(category, 'shop') = $${params.length}`);
      }
      const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
      const r = await pool.query(`SELECT * FROM local_products ${where} ORDER BY created_at ASC`, params);
      return r.rows.map(r => rowToProduct(r, inventoryOrderId));
    } catch (e) {
      console.error('Products list DB error:', e.message);
      throw new Error('Database temporarily unavailable');
    }
  }
  const items = readFileStore();
  return items
    .filter(it => !activeOnly || it.active !== false)
    .filter(it => !cat || safeCategory(it.category) === cat)
    .map(it => rowToProduct({ ...it, created_at: it.createdAt }, inventoryOrderId));
}

// Stock and the idempotency claim live in the same transaction/file replacement.
// Keep claims on ambiguous provider failures: retry/cancel must reconcile PayPal first.
export async function clothingInventory(orderId, items, release = false) {
  const wanted = new Map();
  for (const item of items) if (item.type === 'shop' && item.variantId) {
    const variants = wanted.get(item.productId) || Object.create(null);
    variants[item.variantId] = (variants[item.variantId] || 0) + item.quantity;
    wanted.set(item.productId, variants);
  }
  if (!wanted.size) return;
  if (pool && !dbReady) throw new Error('Inventory database is unavailable.');
  function change(rows) {
    for (const [productId, amounts] of wanted) {
      const row = rows.find(r => r.id === productId);
      if (!row) { if (release) continue; throw new Error('This clothing item is no longer available.'); }
      row.inventory_claims ||= {};
      const claimed = row.inventory_claims[orderId];
      // A durable claim is written before contacting the capture endpoint.
      // Even an APPROVED provider snapshot cannot prove a timed-out capture
      // will not complete. Ordinary cancellation must never release this claim.
      if (release === 'cancel') {
        if (claimed) throw new Error('Payment capture may still be processing. Check payment status or contact the store; reserved stock cannot be released yet.');
        continue;
      }
      if (release) {
        if (!claimed) continue;
        for (const v of row.variants || []) v.stock += Object.hasOwn(claimed,v.id) ? claimed[v.id] : 0;
        delete row.inventory_claims[orderId];
      } else {
        if (claimed) {
          if (JSON.stringify(claimed) !== JSON.stringify(amounts)) throw new Error('Inventory selection changed.');
          continue;
        }
        if (row.active === false || safeCategory(row.category) !== 'shop') throw new Error('Clothing item unavailable.');
        for (const [variantId, qty] of Object.entries(amounts)) {
          const v = row.variants?.find(v => v.id === variantId);
          if (!v || v.active !== true || !Number.isSafeInteger(v.stock) || v.stock < qty) throw new Error('Selected size/color has insufficient stock. Refresh your cart.');
          v.stock -= qty;
        }
        row.inventory_claims[orderId] = amounts;
      }
    }
  }
  if (pool) {
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      const rows = (await db.query('SELECT * FROM local_products WHERE id = ANY($1::text[]) ORDER BY id FOR UPDATE', [[...wanted.keys()]])).rows;
      change(rows);
      for (const r of rows) await db.query('UPDATE local_products SET variants=$2, inventory_claims=$3 WHERE id=$1',
        [r.id,JSON.stringify(r.variants),JSON.stringify(r.inventory_claims)]);
      await db.query('COMMIT');
    } catch (e) { await db.query('ROLLBACK'); throw e; } finally { db.release(); }
  } else {
    await withFileStore(() => {
      // Unlike catalog reads, inventory must never silently recover corrupt data.
      const rows = fs.existsSync(FILE_PATH) ? JSON.parse(fs.readFileSync(FILE_PATH,'utf8')) : [];
      change(rows); writeFileStore(rows);
    });
  }
}

export async function createProduct({ name, description, price, image, images, badge, category, variants = [] }) {
  const photos = images === undefined ? (safeImage(image) ? [safeImage(image)] : []) : validateProductImages(images);
  const id = 'prod_local_' + crypto.randomBytes(6).toString('hex');
  const item = {
    id,
    category: safeCategory(category),
    name: String(name).trim().slice(0, 200),
    description: String(description || '').trim().slice(0, 2000),
    unit_amount: Math.round(Number(price) * 100),
    image: photos[0] || '',
    images: photos,
    variants: validateProductVariants(variants),
    badge: String(badge || '').trim().slice(0, 60),
    active: true,
    createdAt: new Date().toISOString(),
  };
  if (pool && dbReady) {
    try {
      await pool.query(
        `INSERT INTO local_products (id, name, description, unit_amount, image, badge, category, images, variants, active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE)`,
        [item.id, item.name, item.description, item.unit_amount, item.image, item.badge, item.category, JSON.stringify(item.images), JSON.stringify(item.variants)]
      );
      return rowToProduct({ ...item, created_at: item.createdAt });
    } catch (e) {
      console.error('Product create DB error:', e.message);
      throw new Error('Database temporarily unavailable');
    }
  }
  await withFileStore(() => {
    const items = readFileStore();
    items.push(item);
    writeFileStore(items);
  });
  return rowToProduct({ ...item, created_at: item.createdAt });
}

export async function updateProduct(id, patch) {
  const clean = {};
  if (patch.variants !== undefined) clean.variants = validateProductVariants(patch.variants);
  if (patch.name !== undefined) clean.name = String(patch.name).trim().slice(0, 200);
  if (patch.description !== undefined) clean.description = String(patch.description).trim().slice(0, 2000);
  if (patch.price !== undefined && !isNaN(Number(patch.price)) && Number(patch.price) > 0) {
    clean.unit_amount = Math.round(Number(patch.price) * 100);
  }
  if (patch.images !== undefined) {
    clean.images = validateProductImages(patch.images);
    clean.image = clean.images[0] || '';
  } else if (patch.image !== undefined) {
    clean.image = safeImage(patch.image);
    clean.images = clean.image ? [clean.image] : [];
  }
  if (patch.badge !== undefined) clean.badge = String(patch.badge || '').trim().slice(0, 60);
  if (patch.active !== undefined) clean.active = Boolean(patch.active);
  if (patch.category !== undefined) clean.category = safeCategory(patch.category);

  if (pool && dbReady) {
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      const current = (await db.query('SELECT * FROM local_products WHERE id=$1 FOR UPDATE',[id])).rows[0];
      if (!current) { await db.query('COMMIT'); return null; }
      checkInventoryRevision(current, patch);
      const cols = Object.keys(clean);
      if (cols.length > 0) {
        const sets = cols.map((c, i) => `${c} = $${i + 2}`).join(', ');
        await db.query(`UPDATE local_products SET ${sets} WHERE id = $1`, [id, ...cols.map(c => ['images','variants'].includes(c) ? JSON.stringify(clean[c]) : clean[c])]);
      }
      const r = await db.query('SELECT * FROM local_products WHERE id = $1', [id]);
      await db.query('COMMIT');
      return r.rows[0] ? rowToProduct(r.rows[0]) : null;
    } catch (e) {
      await db.query('ROLLBACK');
      if (e.status === 409) throw e;
      console.error('Product update DB error:', e.message);
      throw new Error('Database temporarily unavailable');
    } finally { db.release(); }
  }
  return withFileStore(() => {
    const items = readFileStore();
    const it = items.find(x => x.id === id);
    if (!it) return null;
    checkInventoryRevision(it, patch);
    Object.assign(it, clean);
    writeFileStore(items);
    return rowToProduct({ ...it, created_at: it.createdAt });
  });
}

export async function deleteProduct(id) {
  if (pool && dbReady) {
    try {
      await pool.query('DELETE FROM local_products WHERE id = $1', [id]);
      return true;
    } catch (e) {
      console.error('Product delete DB error:', e.message);
      throw new Error('Database temporarily unavailable');
    }
  }
  await withFileStore(() => {
    const items = readFileStore().filter(x => x.id !== id);
    writeFileStore(items);
  });
  return true;
}
