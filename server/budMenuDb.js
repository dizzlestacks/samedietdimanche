import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export async function initBudMenuTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bud_menu_items (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      strain VARCHAR(50) NOT NULL DEFAULT 'Hybrid',
      category VARCHAR(50) NOT NULL DEFAULT 'flower',
      thc VARCHAR(50) NOT NULL DEFAULT '',
      cbd VARCHAR(50) NOT NULL DEFAULT '',
      terpenes VARCHAR(255) NOT NULL DEFAULT '',
      effects TEXT NOT NULL DEFAULT '[]',
      description TEXT NOT NULL DEFAULT '',
      price VARCHAR(100) NOT NULL DEFAULT '',
      weight VARCHAR(50) NOT NULL DEFAULT '',
      image VARCHAR(500) NOT NULL DEFAULT '',
      active BOOLEAN NOT NULL DEFAULT true,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

export async function getAllBudMenuItems() {
  const result = await pool.query('SELECT * FROM bud_menu_items ORDER BY sort_order ASC, id ASC');
  return result.rows.map(parseRow);
}

export async function getActiveBudMenuItems() {
  const result = await pool.query('SELECT * FROM bud_menu_items WHERE active = true ORDER BY sort_order ASC, id ASC');
  return result.rows.map(parseRow);
}

export async function createBudMenuItem(item) {
  const result = await pool.query(
    `INSERT INTO bud_menu_items (name, strain, category, thc, cbd, terpenes, effects, description, price, weight, image, active, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
    [item.name, item.strain, item.category, item.thc, item.cbd, item.terpenes,
     JSON.stringify(item.effects || []), item.description, item.price, item.weight,
     item.image || '', item.active !== false, item.sort_order || 0]
  );
  return parseRow(result.rows[0]);
}

export async function updateBudMenuItem(id, updates) {
  const fields = [];
  const values = [];
  let idx = 1;

  if (Object.keys(updates).length === 0) {
    const existing = await pool.query('SELECT * FROM bud_menu_items WHERE id = $1', [id]);
    return existing.rows[0] ? parseRow(existing.rows[0]) : null;
  }

  for (const [key, value] of Object.entries(updates)) {
    if (key === 'effects') {
      fields.push(`${key} = $${idx++}`);
      values.push(JSON.stringify(value));
    } else {
      fields.push(`${key} = $${idx++}`);
      values.push(value);
    }
  }

  values.push(id);
  const result = await pool.query(
    `UPDATE bud_menu_items SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] ? parseRow(result.rows[0]) : null;
}

export async function deleteBudMenuItem(id) {
  await pool.query('DELETE FROM bud_menu_items WHERE id = $1', [id]);
}

function parseRow(row) {
  let effects = [];
  try {
    effects = typeof row.effects === 'string' ? JSON.parse(row.effects) : row.effects;
  } catch (e) {
    effects = [];
  }
  return { ...row, effects };
}

export async function seedBudMenuItems(items) {
  const existing = await pool.query('SELECT COUNT(*) FROM bud_menu_items');
  if (parseInt(existing.rows[0].count) > 0) return false;

  for (let i = 0; i < items.length; i++) {
    await createBudMenuItem({ ...items[i], sort_order: i });
  }
  return true;
}
