import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { initBudMenuTable, getAllBudMenuItems, getActiveBudMenuItems, createBudMenuItem, updateBudMenuItem, deleteBudMenuItem, seedBudMenuItems } from './budMenuDb.js';
import { initWaitlistTable, addToWaitlist, getWaitlist, waitlistStorageMode, findByRefCode, getReferralStatus } from './waitlistDb.js';
import { initSettingsTable, getSettings, updateSettings } from './settingsDb.js';
import { initReviewsTable, addReview, getReviews, setReviewApproval, deleteReview } from './reviewsDb.js';
import { initAnalyticsTable, trackView, getAnalytics } from './analyticsDb.js';
import { initProductsTable, listProducts, createProduct, updateProduct, deleteProduct, validateProductImages, validateProductVariants } from './productsDb.js';
import { isEmailConfigured, sendEmail, brandTemplate } from './email.js';
import { timingSafeEqual } from 'crypto';
import { registerWatchRoutes } from './watchRoutes.js';
import { registerCartRoutes } from './cartPricing.js';
import { publicWatchSettings, publicWatchProducts } from './watchPricing.js';
import { protectPrivateFiles } from './publicFiles.js';
import { registerPayPalRoutes } from './paypalRoutes.js';
import { createPaymentReliability } from './paymentReliability.js';
import { isPayPalConfigured } from './paypalClient.js';
import { accessSettings, createEarlyToken, verifyEarlyToken } from './earlyAccess.js';
import { preorderAccess, registerPreorderRoutes } from './preorders.js';
import { registerWaitlistImport } from './waitlistImport.js';
import { registerPreorderInvitations } from './preorderInvitations.js';
import { unsubscribeMarketing } from './waitlistDb.js';
import { registerEmailCampaigns } from './emailCampaigns.js';
import { watchAnnouncements, buildWatchAnnouncement } from './watchAnnouncements.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');

const uploadsDir = path.join(ROOT_DIR, 'img', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.webm', '.mov'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only image or video files are allowed'));
    }
  },
});

const app = express();
const PORT = process.env.PORT || 5000;

function getPublicBaseUrl() {
  if (process.env.PUBLIC_URL) {
    return process.env.PUBLIC_URL.replace(/\/$/, '');
  }
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  const replitDomain = process.env.REPLIT_DOMAINS?.split(',')[0];
  if (replitDomain) {
    return `https://${replitDomain}`;
  }
  return `http://localhost:${PORT}`;
}

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_USER = 'admin';

function timingSafeEqualStr(a, b) {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  if (A.length !== B.length) return false;
  return timingSafeEqual(A, B);
}

function adminAuth(req, res, next) {
  if (!ADMIN_PASSWORD) {
    return res.status(503).send('Admin password not configured on server.');
  }
  const header = req.headers.authorization || '';
  if (header.startsWith('Basic ')) {
    try {
      const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
      const idx = decoded.indexOf(':');
      const user = decoded.slice(0, idx);
      const pass = decoded.slice(idx + 1);
      if (user === ADMIN_USER && timingSafeEqualStr(pass, ADMIN_PASSWORD)) {
        return next();
      }
    } catch (e) {}
  }
  res.set('WWW-Authenticate', 'Basic realm="Samedi Et Dimanche Admin", charset="UTF-8"');
  return res.status(401).send('Authentication required');
}

app.use(['/admin', '/admin.html', '/api/admin'], adminAuth);
app.use('/api/admin/', adminAuth);

app.set('trust proxy', true);
app.use('/api/admin/waitlist/import',express.json({limit:'256kb'}));
app.use(express.json());
app.use('/email/unsubscribe', express.urlencoded({ extended: false, limit: '4kb' }));
registerEmailCampaigns(app, { getWaitlist, unsubscribeMarketing, getPublicBaseUrl, isEmailConfigured, sendEmail });
const customerSettings = preorderAccess(accessSettings(getSettings, findByRefCode));
registerPreorderRoutes(app,{getSettings,updateSettings});
registerWaitlistImport(app,{addToWaitlist});
registerPreorderInvitations(app,{getSettings,getWaitlist,getPublicBaseUrl,isEmailConfigured,sendEmail});
registerWatchRoutes(app, { getSettings, customerSettings, updateSettings, adminAuth });
registerCartRoutes(app, { getSettings: customerSettings, listProducts });
registerPayPalRoutes(app, { getSettings: customerSettings, listProducts });
const paymentReliability = createPaymentReliability();
app.get('/api/admin/payment-reliability', (req,res) => {
  res.set('Cache-Control','no-store').json(paymentReliability.status());
});

// Page-view analytics (aggregate counts only — no cookies, no personal data)
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/admin')
      && !req.path.includes('.') || req.path.endsWith('.html')) {
    if (!req.path.startsWith('/admin')) trackView(req.path);
  }
  next();
});

const geoCache = new Map();
const GEO_CACHE_TTL = 600000;

async function getCountry(ip) {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return 'LOCAL';

  const cached = geoCache.get(ip);
  if (cached && Date.now() - cached.ts < GEO_CACHE_TTL) return cached.country;

  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode`);
    const data = await res.json();
    const country = data.countryCode || 'UNKNOWN';
    geoCache.set(ip, { country, ts: Date.now() });
    return country;
  } catch (err) {
    console.error('Geo lookup failed:', err.message);
    return 'UNKNOWN';
  }
}

const GEO_BLOCKED_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SAMEDI ET DIMANCHE</title>
  <link rel="icon" type="image/png" sizes="32x32" href="/img/favicon-32.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Montserrat:wght@200;300;400&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/index.css">
  <style>
    .geo-block { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; text-align:center; padding:2rem; }
    .geo-block .logo { width:100px; margin-bottom:2rem; }
    .geo-msg { font-family:'Montserrat',sans-serif; font-size:0.55rem; font-weight:200; letter-spacing:0.3em; text-transform:uppercase; color:#C9A96E; opacity:0.7; line-height:2; max-width:400px; }
    .geo-back { display:inline-block; margin-top:2.5rem; font-family:'Montserrat',sans-serif; font-size:0.45rem; font-weight:300; letter-spacing:0.25em; text-transform:uppercase; color:#f0ece4; opacity:0.4; text-decoration:none; border:1px solid rgba(240,236,228,0.15); padding:0.6rem 1.5rem; transition:all 0.3s ease; }
    .geo-back:hover { opacity:0.8; border-color:rgba(201,169,110,0.4); color:#C9A96E; }
  </style>
</head>
<body>
  <div class="noise"></div>
  <div class="geo-block">
    <img src="/img/newlogo.png" alt="Samedi Et Dimanche" class="logo">
    <p class="geo-msg">Sorry, this content is not available in your country.</p>
    <a href="/index.html" class="geo-back">Return Home</a>
  </div>
</body>
</html>`;

async function budGeoBlock(req, res, next) {
  const ip = req.ip || req.connection?.remoteAddress;
  const country = await getCountry(ip);
  if (country === 'CA' || country === 'LOCAL') {
    return next();
  }
  res.status(403).send(GEO_BLOCKED_HTML);
}

app.get('/budmenu.html', budGeoBlock);
app.get('/budmenu', budGeoBlock);

app.get('/api/config', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ provider: 'paypal', checkoutEnabled: isPayPalConfigured() });
});

app.get('/api/products', async (req, res) => {
  try {
    const category = req.query.category === 'watch' || req.query.category === 'shop' ? req.query.category : null;
    let products = await listProducts({ activeOnly: true, category });
    // When the clothing shop is closed, hide shop-category products publicly.
    const settings = await customerSettings(req);
    if (settings.shopEnabled === false) {
      products = products.filter(p => (p.category || 'shop') !== 'shop');
    }
    res.set('Cache-Control', 'no-store');
    res.json({ data: publicWatchProducts(products, settings), checkoutEnabled: isPayPalConfigured() });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.get('/api/admin/products', async (req, res) => {
  try {
    const products = await listProducts();
    res.json({ data: products, checkoutEnabled: isPayPalConfigured() });
  } catch (error) {
    console.error('Error fetching admin products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.post('/api/admin/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' });
  }
  const imageUrl = '/img/uploads/' + req.file.filename;
  res.json({ url: imageUrl });
});

app.post('/api/admin/products', async (req, res) => {
  try {
    const { name, description, price, badge, image, images, category, variants } = req.body;
    if (variants !== undefined) {
      try { validateProductVariants(variants); } catch (error) { return res.status(400).json({error:error.message}); }
    }
    if (images !== undefined) {
      try { validateProductImages(images); } catch (error) { return res.status(400).json({error:error.message}); }
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Product name is required' });
    }
    if (!price || isNaN(Number(price)) || Number(price) <= 0) {
      return res.status(400).json({ error: 'Valid price is required' });
    }

    const product = await createProduct({ name, description, price, badge, image, images, category, variants });
    res.json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

app.put('/api/admin/products/:id', async (req, res) => {
  if (req.body?.variants !== undefined) {
    try { validateProductVariants(req.body.variants); } catch (error) { return res.status(400).json({error:error.message}); }
  }
  if (req.body?.images !== undefined) {
    try { validateProductImages(req.body.images); } catch (error) { return res.status(400).json({error:error.message}); }
  }
  try {
    const product = await updateProduct(req.params.id, req.body || {});
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(error.status === 409 ? 409 : 500).json({ error: error.status === 409 ? error.message : 'Failed to update product' });
  }
});

app.delete('/api/admin/products/:id', async (req, res) => {
  try {
    await deleteProduct(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

app.post('/api/waitlist', async (req, res) => {
  try {
    const { email, category, ref } = req.body;
    if (typeof email !== 'string' || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    const cat = (category === 'bud' || category === 'watches' || category === 'shop') ? category : 'watches';

    const settings = await getSettings();
    if (settings) {
      const enabled = cat === 'bud'
        ? settings.budWaitlistEnabled !== false
        : cat === 'shop' ? settings.shopWaitlistEnabled === true
        : settings.watchPreviewEnabled === true || (settings.watchesMode === 'waitlist' && settings.watchesWaitlistEnabled !== false);
      if (!enabled) {
        return res.status(403).json({ error: 'The waitlist is currently closed.' });
      }
    }

    const result = await addToWaitlist(email, cat, ref, true);
    result.earlyAccessEnabled = cat === 'watches' && settings.watchPreviewEnabled !== true && Boolean(settings.earlyAccessEnabled);
    const earlyToken = result.earlyAccessEnabled ? createEarlyToken(result.refCode) : null;
    if (result.added && earlyToken) result.earlyAccessUrl = '/watches.html?early=' + encodeURIComponent(earlyToken);
    result.emailConfigured = isEmailConfigured();

    // Welcome email (fire-and-forget; never blocks the signup)
    if ((result.added || earlyToken) && isEmailConfigured()) {
      const baseUrl = getPublicBaseUrl();
      const waitlistPage = cat === 'shop' ? 'shop.html' : 'watches.html';
      const shareUrl = `${baseUrl}/${waitlistPage}?ref=${result.refCode}`;
      const early = earlyToken
        ? `<p style="margin:14px 0 0;">Your private early-access link (valid for 7 days):<br><a href="${baseUrl}/watches.html?early=${encodeURIComponent(earlyToken)}" style="color:#d4af37;">Open Early Access</a></p>`
        : '';
      sendEmail({
        to: result.email,
        subject: "You're on the list — Samedi Et Dimanche",
        html: brandTemplate({
          baseUrl,
          heading: "You're on the list.",
          bodyHtml: `<p style="margin:0;">You're <strong style="color:#d4af37;">#${result.position || '—'}</strong> in line for the drop.</p>
<p style="margin:14px 0 0;">Want to move up? Share your personal link — every signup moves you up the list:</p>
<p style="margin:10px 0 0;"><a href="${shareUrl}" style="color:#d4af37;word-break:break-all;">${shareUrl}</a></p>${early}`,
          ctaText: 'View the Drop',
          ctaUrl: `${baseUrl}/${waitlistPage}`,
        }),
      }).catch(() => {});
    }

    res.json(result);
  } catch (error) {
    console.error('Error adding to waitlist:', error);
    res.status(500).json({ error: 'Failed to join waitlist' });
  }
});

// Referral status: position, total, referral count
app.get('/api/referral/:code', async (req, res) => {
  try {
    const status = await getReferralStatus(req.params.code);
    if (!status) return res.status(404).json({ error: 'Unknown code' });
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch referral status' });
  }
});

// Early access: validate a waitlist member's code
app.get('/api/early-access/:code', async (req, res) => {
  try {
    const settings = await getSettings();
    if (!settings.earlyAccessEnabled) return res.json({ valid: false });
    const access = verifyEarlyToken(req.params.code);
    const entry = access ? await findByRefCode(access.code) : null;
    const valid = Boolean(entry && entry.category === 'watches' && settings.watchPreviewEnabled !== true);
    res.set('Cache-Control', 'no-store');
    if (valid) res.cookie('sd_early', req.params.code, { httpOnly: true, sameSite: 'lax', secure: req.secure || req.get('x-forwarded-proto') === 'https', maxAge: Math.max(0, access.expires - Date.now()), path: '/' });
    res.json({ valid });
  } catch (error) {
    res.status(500).json({ error: 'Failed to validate code' });
  }
});

// ─── Reviews ─────────────────────────────────────────────
app.get('/api/reviews', async (req, res) => {
  try {
    res.json({ data: await getReviews({ approvedOnly: true }) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

app.post('/api/reviews', async (req, res) => {
  try {
    const result = await addReview(req.body || {});
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to submit review' });
  }
});

app.get('/api/admin/reviews', async (req, res) => {
  try {
    res.json({ data: await getReviews({ approvedOnly: false }) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

app.put('/api/admin/reviews/:id', async (req, res) => {
  try {
    res.json(await setReviewApproval(req.params.id, req.body && req.body.approved));
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to update review' });
  }
});

app.delete('/api/admin/reviews/:id', async (req, res) => {
  try {
    res.json(await deleteReview(req.params.id));
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to delete review' });
  }
});

// ─── Admin: orders, analytics, email ─────────────────────
app.get('/api/admin/abandoned', async (req, res) => {
  res.json({ data: [], supported: false, emailConfigured: isEmailConfigured() });
});

app.post('/api/admin/abandoned/send', async (req, res) => {
  if (!isEmailConfigured()) return res.status(503).json({ error: 'Configure Resend and a verified sender address before sending email.' });
  try {
    const emails = Array.isArray(req.body && req.body.emails) ? req.body.emails.slice(0, 100) : [];
    if (emails.length === 0) return res.status(400).json({ error: 'No emails provided' });
    const baseUrl = getPublicBaseUrl();
    let sent = 0; const errors = [];
    for (const to of emails) {
      const r = await sendEmail({
        to,
        subject: 'Your order is waiting — Samedi Et Dimanche',
        html: brandTemplate({
          baseUrl,
          heading: 'Still thinking it over?',
          bodyHtml: '<p style="margin:0;">Your selection is still available — but not for long. Pieces are limited and numbered.</p>',
          ctaText: 'Complete Your Order',
          ctaUrl: `${baseUrl}/shop.html`,
        }),
      });
      if (r.sent) sent++; else errors.push(`${to}: ${r.error}`);
    }
    res.json({ sent, total: emails.length, errors });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send recovery emails' });
  }
});

app.get('/api/admin/analytics', async (req, res) => {
  try {
    const days = Math.max(1, Math.min(90, parseInt(req.query.days, 10) || 30));
    const analytics = await getAnalytics(days);
    const waitlist = await getWaitlist();
    const signupsByDay = {};
    for (const e of waitlist) {
      const day = e.created_at ? new Date(e.created_at).toISOString().slice(0, 10) : null;
      if (day) signupsByDay[day] = (signupsByDay[day] || 0) + 1;
    }
    res.json({ ...analytics, signupsByDay, totalSignups: waitlist.length });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

app.get('/api/health', (req, res) => {
  const dbUrl = process.env.DATABASE_URL || process.env.DATABASE_PRIVATE_URL || process.env.POSTGRES_URL || process.env.PG_URL;
  res.json({
    ok: true,
    waitlistStorage: waitlistStorageMode(),
    paypalEnabled: isPayPalConfigured(),
    adminConfigured: Boolean(process.env.ADMIN_PASSWORD),
    emailConfigured: isEmailConfigured(),
    // Railway diagnostics — tells you at a glance which env vars are wired up
    env: {
      DATABASE_URL: dbUrl ? 'set' : 'MISSING — waitlist & products use file fallback',
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ? 'set' : 'MISSING — /admin returns 503',
      EMAIL_DELIVERY: isEmailConfigured() ? 'configured' : 'Resend connection and verified sender required',
      PUBLIC_URL: process.env.PUBLIC_URL || process.env.RAILWAY_PUBLIC_DOMAIN || '(using auto-detected URL)',
    },
  });
});

app.get('/api/site-settings', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const settings = await customerSettings(req);
    res.json(publicWatchSettings(settings));
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.get('/api/admin/watch-announcement', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try { res.json({ draft: buildWatchAnnouncement(await getSettings(), { focus: typeof req.query.focus === 'string' ? req.query.focus : '' }) }); }
  catch { res.status(503).json({ error: 'Current watch settings could not be loaded. Your draft has not changed.' }); }
});
app.get('/api/admin/site-settings', async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  try { res.json(await getSettings()); }
  catch { res.status(503).json({ error: 'Settings could not be loaded.' }); }
});
app.put('/api/admin/site-settings', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const before = await getSettings();
    const settings = await updateSettings(req.body || {});
    res.json({ ...settings, announcementDrafts: watchAnnouncements(before, settings) });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(400).json({ error: error.message || 'Failed to update settings' });
  }
});

app.post('/api/admin/early-access', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const settings = await getSettings();
    if (!settings.earlyAccessEnabled) return res.status(400).json({error:'Enable member early access in Watch Page settings first.'});
    const entry = await findByRefCode(req.body?.code);
    if (!entry || entry.category !== 'watches') return res.status(404).json({error:'Watch member not found.'});
    const token = createEarlyToken(entry.ref_code);
    if (!token) return res.status(503).json({error:'Secure access is not configured.'});
    res.json({url:'/watches.html?early='+encodeURIComponent(token)});
  } catch { res.status(503).json({error:'Could not create an access link. Please retry.'}); }
});

app.get('/api/admin/waitlist', async (req, res) => {
  try {
    const emails = await getWaitlist();
    res.json({ data: emails, storage: waitlistStorageMode() });
  } catch (error) {
    console.error('Error fetching waitlist:', error);
    res.status(500).json({ error: 'Failed to fetch waitlist' });
  }
});

app.get('/api/bud-menu', budGeoBlock, async (req, res) => {
  try {
    const items = await getActiveBudMenuItems();
    res.json({ data: items, checkoutEnabled: false });
  } catch (error) {
    console.error('Error fetching bud menu:', error);
    res.status(500).json({ error: 'Failed to fetch menu' });
  }
});

// This category has no supported payment provider. Keep checkout disabled.
app.post('/api/bud-checkout', budGeoBlock, async (req, res) => {
  res.status(503).json({ error: 'Checkout is not available for this category.' });
});

app.get('/api/admin/bud-menu', async (req, res) => {
  try {
    const items = await getAllBudMenuItems();
    res.json({ data: items });
  } catch (error) {
    console.error('Error fetching admin bud menu:', error);
    res.status(500).json({ error: 'Failed to fetch menu items' });
  }
});

app.post('/api/admin/bud-menu', async (req, res) => {
  try {
    const { name, strain, category, thc, cbd, terpenes, effects, description, price, weight, image } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    const item = await createBudMenuItem({
      name: name.trim(), strain: strain || 'Hybrid', category: category || 'flower',
      thc: thc || '', cbd: cbd || '', terpenes: terpenes || '',
      effects: effects || [], description: description || '',
      price: price || '', weight: weight || '', image: image || '',
    });
    res.json(item);
  } catch (error) {
    console.error('Error creating bud menu item:', error);
    res.status(500).json({ error: 'Failed to create menu item' });
  }
});

app.put('/api/admin/bud-menu/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = ['name', 'strain', 'category', 'thc', 'cbd', 'terpenes', 'effects', 'description', 'price', 'weight', 'image', 'active', 'sort_order'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    const item = await updateBudMenuItem(id, updates);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch (error) {
    console.error('Error updating bud menu item:', error);
    res.status(500).json({ error: 'Failed to update menu item' });
  }
});

app.delete('/api/admin/bud-menu/:id', async (req, res) => {
  try {
    await deleteBudMenuItem(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting bud menu item:', error);
    res.status(500).json({ error: 'Failed to delete menu item' });
  }
});

app.use(protectPrivateFiles);
app.use(express.static(ROOT_DIR, {
  extensions: ['html'],
}));

app.listen(PORT, '0.0.0.0', () => {
  paymentReliability.start();
  console.log(`Server running on port ${PORT}`);

  // ── Startup configuration check ──────────────────────────────────────────
  // Logs which critical env vars are present so Railway deploy logs make it
  // immediately obvious when a variable is missing.
  const dbUrl = process.env.DATABASE_URL || process.env.DATABASE_PRIVATE_URL || process.env.POSTGRES_URL || process.env.PG_URL;
  const checks = [
    { name: 'DATABASE_URL',           ok: Boolean(dbUrl),                             fix: 'Set DATABASE_URL to ${{Postgres.DATABASE_URL}} in the Railway web service variables' },
    { name: 'ADMIN_PASSWORD',         ok: Boolean(process.env.ADMIN_PASSWORD),         fix: 'Set ADMIN_PASSWORD in Railway web service variables to protect /admin' },
  ];
  const missing = checks.filter(c => !c.ok);
  if (missing.length === 0) {
    console.log('✓ All critical environment variables are set.');
  } else {
    console.warn('⚠️  Missing environment variables — some features are disabled:');
    for (const { name, fix } of missing) {
      console.warn(`   ✗ ${name}: ${fix}`);
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  initBudMenu().catch(err => {
    console.error('Bud menu init error:', err.message);
  });

  initSettingsTable().catch(err => {
    console.error('Settings table init error:', err.message);
  });
  initReviewsTable().catch(err => {
    console.error('Reviews table init error:', err.message);
  });
  initProductsTable().catch(err => {
    console.error('Products init error:', err.message);
  });

  initAnalyticsTable().catch(err => {
    console.error('Analytics init error:', err.message);
  });
  initWaitlistTable().catch(err => {
    console.error('Waitlist table init error:', err.message);
  });

});

async function initBudMenu() {
  console.log('Initializing bud menu table...');
  await initBudMenuTable();
  console.log('Bud menu table ready');

  const seeded = await seedBudMenuItems([
    { name: 'Purple Haze', strain: 'Sativa', category: 'flower', thc: '22%', cbd: '0.5%', terpenes: 'Myrcene, Terpinolene', effects: ['Euphoric', 'Creative', 'Energizing'], description: 'A legendary sativa with a sweet berry aroma and earthy undertones. Known for its dreamy cerebral high and vibrant energy.', price: '$45 / 3.5g', weight: '3.5g', image: 'img/bud1.png' },
    { name: 'Northern Lights', strain: 'Indica', category: 'flower', thc: '26%', cbd: '1.0%', terpenes: 'Myrcene, Caryophyllene', effects: ['Relaxing', 'Sleepy', 'Pain Relief'], description: 'Pure indica royalty. Resinous buds with a sweet, spicy aroma. Delivers a deeply relaxing full-body experience.', price: '$50 / 3.5g', weight: '3.5g', image: 'img/bud2.png' },
    { name: 'Blue Dream', strain: 'Hybrid', category: 'flower', thc: '24%', cbd: '0.8%', terpenes: 'Myrcene, Pinene, Caryophyllene', effects: ['Balanced', 'Happy', 'Creative'], description: 'The perfect hybrid balance. Sweet berry aroma from Blueberry parent, with full-body relaxation and gentle cerebral invigoration.', price: '$48 / 3.5g', weight: '3.5g', image: 'img/bud3.png' },
    { name: 'Gelato 41', strain: 'Hybrid', category: 'flower', thc: '28%', cbd: '0.3%', terpenes: 'Limonene, Caryophyllene', effects: ['Euphoric', 'Relaxing', 'Uplifted'], description: 'A dessert-like experience. Dense, colorful buds with a sweet citrus and cream profile. Heavy-hitting potency with a smooth finish.', price: '$55 / 3.5g', weight: '3.5g', image: 'img/bud4.png' },
    { name: 'Weekend Rolls', strain: 'Hybrid', category: 'preroll', thc: '25%', cbd: '0.5%', terpenes: 'Limonene, Linalool', effects: ['Social', 'Uplifted', 'Calm'], description: 'Hand-rolled premium pre-rolls. A curated hybrid blend designed for effortless enjoyment. Pack of 5 half-gram joints.', price: '$38 / 5-pack', weight: '2.5g total', image: 'img/bud5.png' },
    { name: 'Midnight Gummies', strain: 'Indica', category: 'edible', thc: '10mg each', cbd: '5mg each', terpenes: 'Natural fruit terpenes', effects: ['Relaxing', 'Sleepy', 'Calm'], description: 'Artisan blackberry and lavender gummies infused with full-spectrum indica extract. 10 pieces per tin, micro-dose friendly.', price: '$32 / 10-pack', weight: '100mg total', image: 'img/bud6.png' },
    { name: 'Live Rosin', strain: 'Sativa', category: 'concentrate', thc: '78%', cbd: '1.2%', terpenes: 'Terpinolene, Ocimene', effects: ['Energizing', 'Creative', 'Focused'], description: 'Solventless hash rosin pressed from fresh-frozen flower. Full terpene profile preserved for an authentic, clean experience.', price: '$65 / 1g', weight: '1g', image: 'img/bud7.png' },
    { name: 'Cloud Nine', strain: 'Hybrid', category: 'vape', thc: '85%', cbd: '2.0%', terpenes: 'Limonene, Myrcene', effects: ['Euphoric', 'Happy', 'Relaxing'], description: 'Premium live resin cartridge. Ceramic coil technology for smooth, flavorful draws. Compatible with standard 510 batteries.', price: '$52 / 1g cart', weight: '1g', image: 'img/bud8.png' },
    { name: 'OG Kush', strain: 'Indica', category: 'flower', thc: '25%', cbd: '0.6%', terpenes: 'Myrcene, Limonene, Linalool', effects: ['Heavy', 'Relaxing', 'Euphoric'], description: 'The cornerstone strain. Earthy pine and sour lemon aroma. Delivers a complex mix of cerebral euphoria and heavy body relaxation.', price: '$52 / 3.5g', weight: '3.5g', image: 'img/bud9.png' },
  ]);
  if (seeded) console.log('Bud menu seeded with default items');
}

logPaymentStatus();
function logPaymentStatus() {
  if (isPayPalConfigured()) {
    console.log('PayPal checkout configured. Store and watch preview restrictions remain enforced.');
  } else {
    console.log('Payments disabled — shop runs in "coming soon" / waitlist mode.');
  }
}
