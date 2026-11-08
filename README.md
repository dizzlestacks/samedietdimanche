# Samedi Et Dimanche — LIVE bundle

This folder is a self-contained, copy-pasteable copy of the site, ready
to run on any host that supports Node.js (Render, Railway, Fly.io, a VPS,
your own server, etc.).

> **Tagline:** *Where the week ends.*

---

## What's inside

```
LIVE/
├─ index.html            Landing page (WATCHES)
├─ bud.html              Bud waitlist
├─ watches.html          Watches waitlist (with collapsible specs)
├─ budmenu.html          Cannabis menu (Canada-only)
├─ shop.html             Shop hub

├─ socials.html          Socials
├─ admin.html            Admin panel (password-protected)
├─ css/                  All stylesheets
├─ js/                   All client scripts
├─ img/                  Logo, petals, products, backgrounds
│   └─ uploads/          User-uploaded product images (writable at runtime)
├─ server/
│   ├─ index.js          Express server (port 5000 by default)

│   ├─ webhookHandlers.js
│   ├─ budMenuDb.js      PostgreSQL bud-menu CRUD
│   ├─ waitlistDb.js     PostgreSQL waitlist storage

├─ package.json
├─ package-lock.json
├─ railway.json          Railway deploy config (builder + start + healthcheck)
├─ Procfile              Start command for Heroku-style hosts
├─ .gitignore            Keeps secrets / node_modules out of git
├─ .env.example          Copy to .env and fill in
└─ README.md             This file
```

---

## 1. Requirements

- **Node.js 20+**
- **PostgreSQL** (any provider: Neon, Supabase, Railway, RDS, self-hosted)

  "Collection coming soon".

---

## 2. Set up environment variables

Copy `.env.example` to `.env` and fill in real values. The variables are:

| Variable                 | Required | What it is |
|--------------------------|----------|------------|
| `DATABASE_URL`           | ✅       | Postgres connection string |
| `ADMIN_PASSWORD`         | ✅       | Password for `/admin` (username is `admin`) |

| `PORT`                   | optional | Defaults to `5000` |
| `DATA_DIR`               | optional | Folder for file-backed waitlist/settings storage (point it at a persistent disk/volume, e.g. `/data`, to survive redeploys without a database) |

Most hosts (Render / Railway / Fly / Vercel-server / etc.) let you paste
these into a dashboard instead of using a `.env` file.

---

## 3. Install & run

```bash
npm install
npm start
```

The site will be live on `http://localhost:5000`. The server automatically:

- Creates the `waitlist_emails` and `bud_menu_items` tables on first boot

- Serves all static HTML/CSS/JS/images from the bundle root

---

```bash
npm run seed
```

---

## 5. Admin panel

- Navigate to **`/admin`** in your browser
- Username: **`admin`**
- Password: whatever you set as `ADMIN_PASSWORD`

The admin has four tabs:

1. **Overview** — dashboard with stat cards (waitlist totals, signups by category, active products, bud items), a recent-signups list, and quick-action shortcuts

3. **Bud Menu** — manage the cannabis menu (CRUD on the PostgreSQL `bud_menu_items` table); live search
4. **Waitlist** — view, filter (All / Bud / Watches), export CSV, copy as plaintext

---

```

```

---

## 7. Deploying to common hosts

### Render
1. New → Web Service → connect this folder
2. Build command: `npm install`
3. Start command: `npm start`
4. Add all the env vars from step 2

### Railway (recommended for this app)
1. **New Project → Deploy from GitHub repo** (select this repo)
2. **Add a database AND connect it:** click **New → Database → PostgreSQL**, then
   open your **website service → Variables**, add a variable named `DATABASE_URL`
   with the value `${{Postgres.DATABASE_URL}}` (a reference to the Postgres
   service). Adding the database alone does NOT connect it — this reference is
   required, or you'll see `ECONNREFUSED ... 5432` errors and a broken site.
3. **Add the other variables** under your service's **Variables** tab:
   - `ADMIN_PASSWORD`

   - `PUBLIC_URL` is optional on Railway — it auto-detects the public domain.
4. Railway auto-detects `npm start` from `package.json`. The server binds to
   the port Railway provides automatically (no PORT setting needed).
5. Under **Settings → Networking**, generate a public domain. Done.

> Note: pushing new commits to GitHub auto-redeploys on Railway.

### Fly.io
Same idea — set start command to `npm start`, attach a Postgres, paste env vars,
and set `PUBLIC_URL` to your fly.dev domain.

### Your own VPS
```bash
npm install
PORT=5000 npm start
```
Then put nginx or Caddy in front for TLS and a real domain.

---

## Notes

- `img/uploads/` is written to at runtime when admins upload product
  images. On ephemeral hosts (Heroku-style), use an object store (S3,
  Cloudflare R2) — otherwise uploads disappear on redeploy.
- The admin routes (`/admin`, `/admin.html`, `/api/admin/*`) are all
  protected by HTTP Basic Auth. Never share your `ADMIN_PASSWORD`.


> Payments are currently disabled site-wide. The shop shows "coming soon" and the watch page runs in waitlist mode until a new payment method is added.
