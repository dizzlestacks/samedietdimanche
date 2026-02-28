import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { runMigrations } from 'stripe-replit-sync';
import { getStripeSync, getUncachableStripeClient, getStripePublishableKey } from './stripeClient.js';
import { WebhookHandlers } from './webhookHandlers.js';
import { initBudMenuTable, getAllBudMenuItems, getActiveBudMenuItems, createBudMenuItem, updateBudMenuItem, deleteBudMenuItem, seedBudMenuItems } from './budMenuDb.js';

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
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

const app = express();
const PORT = 5000;

app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      if (!Buffer.isBuffer(req.body)) {
        console.error('STRIPE WEBHOOK ERROR: req.body is not a Buffer');
        return res.status(500).json({ error: 'Webhook processing error' });
      }
      await WebhookHandlers.processWebhook(req.body, sig);
      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Webhook error:', error.message);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

app.use(express.json());

app.get('/api/config', async (req, res) => {
  try {
    const publishableKey = await getStripePublishableKey();
    res.json({ publishableKey });
  } catch (error) {
    console.error('Error getting config:', error);
    res.status(500).json({ error: 'Failed to get config' });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const stripe = await getUncachableStripeClient();
    const products = await stripe.products.list({ active: true, limit: 20 });
    const prices = await stripe.prices.list({ active: true, limit: 100 });

    const productsWithPrices = products.data.map(product => {
      const productPrices = prices.data.filter(p => p.product === product.id);
      return {
        id: product.id,
        name: product.name,
        description: product.description,
        images: product.images,
        metadata: product.metadata,
        prices: productPrices.map(p => ({
          id: p.id,
          unit_amount: p.unit_amount,
          currency: p.currency,
        }))
      };
    });

    res.json({ data: productsWithPrices });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.post('/api/checkout', async (req, res) => {
  try {
    const { priceId, quantity = 1 } = req.body;

    if (!priceId || typeof priceId !== 'string') {
      return res.status(400).json({ error: 'priceId is required' });
    }

    const qty = Math.max(1, Math.min(10, Math.floor(Number(quantity))));
    if (isNaN(qty)) {
      return res.status(400).json({ error: 'Invalid quantity' });
    }

    const stripe = await getUncachableStripeClient();

    const price = await stripe.prices.retrieve(priceId);
    if (!price || !price.active) {
      return res.status(400).json({ error: 'Invalid or inactive price' });
    }

    const product = await stripe.products.retrieve(price.product);
    if (!product || !product.active) {
      return res.status(400).json({ error: 'Product is unavailable' });
    }

    const domain = process.env.REPLIT_DOMAINS?.split(',')[0];
    const baseUrl = domain ? `https://${domain}` : 'http://localhost:5000';

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: priceId, quantity: qty }],
      mode: 'payment',
      success_url: `${baseUrl}/shop.html?success=true`,
      cancel_url: `${baseUrl}/shop.html?canceled=true`,
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB'],
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

app.get('/api/admin/products', async (req, res) => {
  try {
    const stripe = await getUncachableStripeClient();
    const products = await stripe.products.list({ limit: 100 });
    const prices = await stripe.prices.list({ limit: 100 });

    const productsWithPrices = products.data.map(product => {
      const productPrices = prices.data.filter(p => p.product === product.id);
      return {
        id: product.id,
        name: product.name,
        description: product.description,
        active: product.active,
        images: product.images,
        metadata: product.metadata,
        prices: productPrices.map(p => ({
          id: p.id,
          unit_amount: p.unit_amount,
          currency: p.currency,
          active: p.active,
        }))
      };
    });

    res.json({ data: productsWithPrices });
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
    const { name, description, price, badge, image } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Product name is required' });
    }
    if (!price || isNaN(Number(price)) || Number(price) <= 0) {
      return res.status(400).json({ error: 'Valid price is required' });
    }

    const stripe = await getUncachableStripeClient();

    const metadata = {};
    if (badge) metadata.badge = badge;

    const createParams = {
      name: name.trim(),
      description: description?.trim() || '',
      metadata,
    };
    if (image) createParams.images = [image];

    const product = await stripe.products.create(createParams);

    const stripePrice = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(Number(price) * 100),
      currency: 'usd',
    });

    res.json({
      id: product.id,
      name: product.name,
      description: product.description,
      active: product.active,
      metadata: product.metadata,
      prices: [{
        id: stripePrice.id,
        unit_amount: stripePrice.unit_amount,
        currency: stripePrice.currency,
        active: stripePrice.active,
      }]
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

app.put('/api/admin/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, active, badge, price, image } = req.body;

    const stripe = await getUncachableStripeClient();

    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description.trim();
    if (active !== undefined) updates.active = Boolean(active);
    if (badge !== undefined) updates.metadata = { badge: badge || '' };
    if (image !== undefined) updates.images = image ? [image] : [];

    const product = await stripe.products.update(id, updates);

    let newPrice = null;
    if (price !== undefined && !isNaN(Number(price)) && Number(price) > 0) {
      const existingPrices = await stripe.prices.list({ product: id, active: true });
      for (const p of existingPrices.data) {
        await stripe.prices.update(p.id, { active: false });
      }

      newPrice = await stripe.prices.create({
        product: id,
        unit_amount: Math.round(Number(price) * 100),
        currency: 'usd',
      });
    }

    const activePrices = await stripe.prices.list({ product: id, active: true });

    res.json({
      id: product.id,
      name: product.name,
      description: product.description,
      active: product.active,
      metadata: product.metadata,
      prices: activePrices.data.map(p => ({
        id: p.id,
        unit_amount: p.unit_amount,
        currency: p.currency,
        active: p.active,
      }))
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

app.delete('/api/admin/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const stripe = await getUncachableStripeClient();

    await stripe.products.update(id, { active: false });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deactivating product:', error);
    res.status(500).json({ error: 'Failed to deactivate product' });
  }
});

app.get('/api/bud-menu', async (req, res) => {
  try {
    const items = await getActiveBudMenuItems();
    res.json({ data: items });
  } catch (error) {
    console.error('Error fetching bud menu:', error);
    res.status(500).json({ error: 'Failed to fetch menu' });
  }
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

app.use(express.static(ROOT_DIR, {
  extensions: ['html'],
}));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);

  initBudMenu().catch(err => {
    console.error('Bud menu init error:', err.message);
  });

  initStripe().catch(err => {
    console.error('Stripe initialization error:', err.message);
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

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not set — skipping Stripe schema init');
    return;
  }

  console.log('Initializing Stripe schema...');
  await runMigrations({ databaseUrl, schema: 'stripe' });
  console.log('Stripe schema ready');

  const stripeSync = await getStripeSync();

  console.log('Setting up managed webhook...');
  const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
  const webhookResult = await stripeSync.findOrCreateManagedWebhook(
    `${webhookBaseUrl}/api/stripe/webhook`
  );
  console.log('Webhook configured:', webhookResult?.webhook?.url || 'done');

  console.log('Syncing Stripe data...');
  stripeSync.syncBackfill()
    .then(() => console.log('Stripe data synced'))
    .catch((err) => console.error('Error syncing Stripe data:', err));
}
