import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export async function initWaitlistTable() {
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
}

export async function addToWaitlist(email, category = 'watches') {
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedCategory = (category || 'watches').toLowerCase().trim();
  const result = await pool.query(
    `INSERT INTO waitlist_emails (email, category) VALUES ($1, $2)
     ON CONFLICT (email, category) DO NOTHING RETURNING *`,
    [normalizedEmail, normalizedCategory]
  );
  return { added: result.rows.length > 0, email: normalizedEmail, category: normalizedCategory };
}

export async function getWaitlist() {
  const result = await pool.query('SELECT * FROM waitlist_emails ORDER BY created_at DESC');
  return result.rows;
}
