# Fixing broken item photos on Railway (persistent uploads)

## Why photos break

Listing photos are saved as files inside an `uploads/` folder on the server.
On Railway, the server's filesystem is **ephemeral** — every time you push to
GitHub and Railway redeploys, it rebuilds the container from scratch and
**deletes everything that was written at runtime**, including all uploaded
photos. The images then 404 and the app shows the YARDEES logo instead.

The fix is to give Railway a **Volume** (permanent disk) and store uploads
there, so they survive every deploy.

---

## What the code change does

`server/routes.ts` now reads the uploads location from an env var:

```ts
const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.resolve(process.cwd(), "uploads"); // local dev fallback
```

- **Local dev:** nothing changes — it still uses `<project>/uploads`.
- **Production:** set `UPLOADS_DIR` to your mounted Volume path and photos persist.

---

## One-time Railway setup (in the Railway dashboard)

1. Open your **YARDEES** project on [railway.app](https://railway.app)
2. Click your **service** (the web app)
3. Go to the **Variables** tab → add a new variable:
   - **Name:** `UPLOADS_DIR`
   - **Value:** `/data/uploads`
4. Go to the **Settings** tab (or the **"+ Create" → Volume** option) and **add a Volume**:
   - **Mount path:** `/data`
   - Pick any size (1 GB is plenty to start; you can grow it later)
5. Click **Deploy** (or just push your next change). Railway redeploys with the Volume attached.

That's it. From now on every photo uploaded is written to `/data/uploads` on
the Volume and will **survive all future deploys**.

> Note: photos uploaded *before* this fix are already gone (they were on the
> old ephemeral disk). Sellers will need to re-upload them once. Everything
> uploaded after the Volume is attached stays permanently.

---

## How to verify it worked

1. After the Volume is attached and the app redeploys, upload a new listing photo
2. Push an unrelated small change to trigger a fresh Railway deploy
3. Reload the listing — the photo should **still be there** (before the fix it
   would have disappeared)
