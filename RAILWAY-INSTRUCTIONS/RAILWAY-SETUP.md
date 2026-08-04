# Deploying Samedi Et Dimanche to Railway

This guide gets the site live on **Railway** from scratch. Everything the
server needs is already configured (`railway.json`, `Procfile`, `package.json`),
so deployment is mostly clicking through the Railway dashboard.

> The actual site files live in the folder **next to** this one. This
> `RAILWAY-INSTRUCTIONS/` folder is documentation only — you do **not** deploy
> this folder, you deploy the site files around it.

---

## Before you start

You need:

- A **Railway account** → https://railway.com
- A **GitHub account** (Railway deploys from a GitHub repo)
- A strong **admin password** you choose yourself
- (Optional) Your **Stripe API keys** (from https://dashboard.stripe.com/apikeys)
  — only needed if you want the clothing shop and checkout live. Without them,
  the site runs fine and the shop simply shows "Collection coming soon".

---

## Step 1 — Put the site on GitHub

1. Create a new repository on GitHub (e.g. `samedi-et-dimanche`).
2. Copy all the site files (everything in the folder next to this one) into it.
3. Commit and push.

> A `.gitignore` is already included, so secrets, `node_modules`, and large
> archives are automatically kept out of your repo.

---

## Step 2 — Create the Railway project

1. On Railway, click **New Project → Deploy from GitHub repo**.
2. Select the repo you just pushed.
3. Railway reads `railway.json` automatically and starts the first build.

---

## Step 3 — Add the database (and CONNECT it — this is the step people miss)

1. Inside your Railway project, click **New → Database → PostgreSQL**. This adds a
   Postgres service to your project.
2. **IMPORTANT:** Adding the database does **not** automatically give your website
   access to it. You must connect them:
   - Click your **website service** (not the database) → open the **Variables** tab.
   - Click **New Variable** → name it exactly `DATABASE_URL`.
   - For the value, type `${{Postgres.DATABASE_URL}}` (this is a Railway
     "reference" — it pulls the connection string from your Postgres service).
     If your database service has a different name, use that name instead of
     `Postgres`. Railway will usually autocomplete it for you.
   - Save. Railway redeploys automatically.
3. On first boot the app creates its own tables — no manual SQL needed.

> **How to tell it worked:** in the deploy logs you should see
> `Bud menu table ready`, NOT `DATABASE_URL not set` or
> `ECONNREFUSED ... 5432`. Seeing `ECONNREFUSED` on port 5432 means the
> database is still not connected — redo this step.

---

## Step 4 — Add your environment variables

In your service, open the **Variables** tab and add:

| Variable                 | Required | Value |
|--------------------------|----------|-------|
| `ADMIN_PASSWORD`         | yes      | A strong password for the `/admin` page |
| `STRIPE_SECRET_KEY`      | optional | `sk_live_...` (or `sk_test_...`) — only if you want the shop live |
| `STRIPE_PUBLISHABLE_KEY` | optional | `pk_live_...` (or `pk_test_...`) — only if you want the shop live |
| `STRIPE_WEBHOOK_SECRET`  | optional | `whsec_...` (see Step 6) |

> **No Stripe yet? No problem.** Skip the Stripe variables entirely. The site
> works normally — the clothing page just shows "Collection coming soon" and
> checkout stays off. Add the keys later whenever you're ready to sell.

> **No database yet? Emails can still survive redeploys.** Add a **Volume** to
> your website service (right-click the service → **Attach Volume**, mount path
> `/data`), then add a variable `DATA_DIR` = `/data`. Signups and settings are
> then written to that persistent disk instead of the app folder, so uploads
> and redeploys never wipe them. (The database is still the best long-term home
> — everything auto-imports into it once `DATABASE_URL` works.)

You set `DATABASE_URL` in Step 3 (as a reference to your Postgres service). You do
**not** need to set `PORT` (Railway provides it) or `PUBLIC_URL` (auto-detected
from your Railway domain).

After adding variables, Railway redeploys automatically.

---

## Step 5 — Generate your public domain

1. Open **Settings → Networking**.
2. Click **Generate Domain**.
3. Visit the URL — the site is live.

The admin panel is at **`/admin`** (username `admin`, password = whatever you
set for `ADMIN_PASSWORD`).

---

## Step 6 — Stripe webhook (optional but recommended)

This keeps your store in sync with Stripe (payments, refunds, etc.).

1. In the Stripe dashboard go to **Developers → Webhooks → Add endpoint**.
2. Endpoint URL: `https://YOUR-RAILWAY-DOMAIN/api/stripe/webhook`
3. Copy the **Signing secret** it shows (`whsec_...`).
4. Back on Railway, add it as the `STRIPE_WEBHOOK_SECRET` variable.

---

## Step 7 — (Optional) Seed starter products

If you want the example clothing products created in Stripe, run this once
locally (with your Stripe key set):

```bash
npm install
npm run seed
```

Or just add products yourself from the **Shop Products** tab in `/admin`.

---

## Updating the site later

Push a new commit to GitHub — Railway redeploys automatically. No extra steps.

---

## Troubleshooting

- **Site loads but products are empty:** make sure your Stripe keys are set and
  you've created products (Stripe dashboard or `/admin`).
- **`/admin` keeps asking for a password:** the username is `admin`; the
  password is your `ADMIN_PASSWORD` value exactly.
- **Uploaded images disappear after a redeploy:** Railway storage is ephemeral.
  For permanent image hosting, use an object store (S3 / Cloudflare R2). Day to
  day this is fine; just re-upload if needed after a redeploy.
- **Build fails:** confirm `package.json`, `railway.json`, and `Procfile` are in
  the repo root (not inside a subfolder).
