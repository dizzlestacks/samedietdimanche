import pg from 'pg';
import fs from 'node:fs/promises';
import path from 'node:path';

// Never silently downgrade a configured database to ephemeral files for payments.
const url = [process.env.DATABASE_URL,process.env.DATABASE_PRIVATE_URL,process.env.DATABASE_PUBLIC_URL,process.env.POSTGRES_URL,process.env.PG_URL]
  .find(value => typeof value === 'string' && /^postgres(ql)?:\/\//.test(value.trim().replace(/^["']|["']$/g,'')));
const pool = url ? new pg.Pool({connectionString:url.trim().replace(/^["']|["']$/g,''), connectionTimeoutMillis:5000}) : null;
const file = path.resolve(process.env.DATA_DIR || 'data', 'paypal-orders.json');
let initialized;
let queue = Promise.resolve();
async function init() {
  if (pool) {
    initialized ||= pool.query('CREATE TABLE IF NOT EXISTS paypal_orders (id TEXT PRIMARY KEY, payload JSONB NOT NULL)');
    try { await initialized; } catch (e) { initialized = null; throw e; }
  }
}
async function read() {
  try { return JSON.parse(await fs.readFile(file,'utf8')); }
  catch(e) { if (e.code === 'ENOENT') return {}; throw e; }
}
export const paymentStore = {
  async get(id) {
    await init();
    if (pool) return (await pool.query('SELECT payload FROM paypal_orders WHERE id=$1',[id])).rows[0]?.payload;
    await queue;
    return (await read())[id];
  },
  async transact(id, fn) {
    await init();
    if (pool) {
      const db = await pool.connect();
      try {
        await db.query('BEGIN');
        await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[id]);
        const current = (await db.query('SELECT payload FROM paypal_orders WHERE id=$1',[id])).rows[0]?.payload;
        const next = await fn(current);
        await db.query('INSERT INTO paypal_orders(id,payload) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload',[id,JSON.stringify(next)]);
        await db.query('COMMIT');
        return next;
      } catch(e) { await db.query('ROLLBACK'); throw e; } finally { db.release(); }
    }
    const operation = queue.then(async()=>{
      const orders = await read(), next = await fn(orders[id]);
      orders[id] = next;
      await fs.mkdir(path.dirname(file),{recursive:true});
      await fs.writeFile(file+'.tmp',JSON.stringify(orders),{mode:0o600});
      await fs.rename(file+'.tmp',file);
      return next;
    });
    queue = operation.catch(()=>{});
    return operation;
  },
  async list() {
    await init();
    if (pool) return (await pool.query("SELECT payload FROM paypal_orders ORDER BY (payload->>'created') DESC LIMIT 100")).rows.map(r=>r.payload);
    return Object.values(await read()).sort((a,b)=>b.created-a.created).slice(0,100);
  },
  async workItems(now = Date.now(), limit = 25) {
    await init();
    // Independent of the admin's newest-100 list; old pending payments cannot starve.
    if (pool) return (await pool.query(`SELECT payload FROM paypal_orders
      WHERE (payload->>'status' IN ('created','pending') OR
        (payload->>'status'='paid' AND payload->>'confirmationEligible'='true'
          AND NOT (payload ? 'confirmation')))
      AND COALESCE((payload->>'nextCheckAt')::bigint,0) <= $1
      ORDER BY COALESCE((payload->>'nextCheckAt')::bigint,0), id LIMIT $2`,
    [now,limit])).rows.map(r=>r.payload);
    await queue;
    return Object.values(await read()).filter(o =>
      (['created','pending'].includes(o.status) || (o.status==='paid' && o.confirmationEligible && !o.confirmation)) &&
      (o.nextCheckAt || 0) <= now
    ).sort((a,b)=>(a.nextCheckAt||0)-(b.nextCheckAt||0)||a.id.localeCompare(b.id)).slice(0,limit);
  },
};
