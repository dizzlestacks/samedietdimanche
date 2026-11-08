# Railway Environment Variables Setup

This guide shows you exactly how to wire up the four environment variables that

---

## 1 — Add a PostgreSQL database service

1. Open your project in [railway.app](https://railway.app).
2. Click **+ New** → **Database** → **Add PostgreSQL**.
3. Railway creates a separate Postgres service inside your project.

> The database service and the web service are **separate containers**. Adding
> the database does **not** automatically give the web service access — you must
> add a variable reference in step 2.

---

## 2 — Link DATABASE_URL to the web service

1. Click your **web service** (not the Postgres service).
2. Open the **Variables** tab.
3. Click **+ New Variable** and add:

   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |

   Replace `Postgres` with the exact name of your PostgreSQL service if you
   renamed it (Railway will auto-complete service names with `${{`).

4. Click **Add** → Railway redeploys automatically.

---

## 3 — Add ADMIN_PASSWORD

Still in **Variables** for the web service:

| Name | Value |
|------|-------|
| `ADMIN_PASSWORD` | `your-secure-password-here` |

Without this, hitting `/admin` or any `/api/admin/*` route returns **503**.

---

| Name | Value |
|------|-------|

Without these the shop shows **"Collection coming soon"** and the checkout
endpoint returns 503. Use `sk_test_` / `pk_test_` keys for staging.

---

## 5 — (Optional) Add Resend for email

| Name | Value |
|------|-------|
| `RESEND_API_KEY` | `re_…` |
| `EMAIL_FROM` | `hello@yourdomain.com` |

---

## 6 — Verify

After Railway finishes redeploying, open:

```
https://your-app.up.railway.app/api/health
```

You should see:

```json
{
  "ok": true,
  "waitlistStorage": "database",

  "adminConfigured": true,
  "env": {
    "DATABASE_URL": "set",
    "ADMIN_PASSWORD": "set",

  }
}
```

Any field that still says `"MISSING"` needs the corresponding variable added in
step 2–4 above.

You can also check the **deploy logs** in Railway — the server prints a startup
summary like:

```
✓ All critical environment variables are set.
```

or lists exactly which variables are missing and what to do.

---

## Quick reference — all variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes (for DB features) | PostgreSQL connection; use `${{Postgres.DATABASE_URL}}` |
| `ADMIN_PASSWORD` | Yes (for /admin) | Basic-auth password for the admin panel |

| `RESEND_API_KEY` | No | Enables transactional email |
| `EMAIL_FROM` | No | From-address for emails |
| `PUBLIC_URL` | No | Override public URL (Railway sets this automatically) |
| `DATA_DIR` | No | Path to a Railway Volume mount for file-fallback persistence |

> Payments are currently disabled site-wide until a new payment method is added.
