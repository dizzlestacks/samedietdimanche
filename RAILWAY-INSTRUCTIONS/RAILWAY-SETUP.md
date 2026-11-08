# Railway Environment Variables Setup

This guide shows you exactly how to wire up the four environment variables that
make the live site fully functional: database, admin panel, and Stripe checkout.

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

## 4 — Add Stripe keys

Get these from your [Stripe Dashboard → API keys](https://dashboard.stripe.com/apikeys).

| Name | Value |
|------|-------|
| `STRIPE_SECRET_KEY` | `sk_live_…` |
| `STRIPE_PUBLISHABLE_KEY` | `pk_live_…` |

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
  "stripeEnabled": true,
  "adminConfigured": true,
  "env": {
    "DATABASE_URL": "set",
    "ADMIN_PASSWORD": "set",
    "STRIPE_SECRET_KEY": "set",
    "STRIPE_PUBLISHABLE_KEY": "set"
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

## Troubleshooting

- **`/admin` keeps asking for a password:** the username is `admin`; the
  password is your `ADMIN_PASSWORD` value exactly.
- **Uploaded images disappear after a redeploy:** Railway storage is ephemeral.
  For permanent image hosting, use an object store (S3 / Cloudflare R2).
- **Build fails:** confirm `package.json`, `railway.json`, and `Procfile` are in
  the repo root (not inside a subfolder).

---

## Quick reference — all variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes (for DB features) | PostgreSQL connection; use `${{Postgres.DATABASE_URL}}` |
| `ADMIN_PASSWORD` | Yes (for /admin) | Basic-auth password for the admin panel |
| `STRIPE_SECRET_KEY` | Yes (for checkout) | Stripe server-side key (`sk_live_…`) |
| `STRIPE_PUBLISHABLE_KEY` | Yes (for checkout) | Stripe client-side key (`pk_live_…`) |
| `RESEND_API_KEY` | No | Enables transactional email |
| `EMAIL_FROM` | No | From-address for emails |
| `PUBLIC_URL` | No | Override public URL (Railway sets this automatically) |
| `DATA_DIR` | No | Path to a Railway Volume mount for file-fallback persistence |
