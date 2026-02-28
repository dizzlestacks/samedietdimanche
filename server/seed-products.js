import { getUncachableStripeClient } from './stripeClient.js';

const PRODUCTS = [
  {
    name: 'Essential Tee',
    description: 'Premium heavyweight cotton tee with minimal branding. Oversized fit.',
    price: 8500,
    image: 'img/product1.png',
    metadata: { category: 'tops', badge: 'new' }
  },
  {
    name: 'Logo Hoodie',
    description: 'Luxury embroidered hoodie. French terry cotton, relaxed drop shoulder.',
    price: 16500,
    image: 'img/product2.png',
    metadata: { category: 'tops' }
  },
  {
    name: 'Classic Cap',
    description: 'Structured six-panel cap with tonal logo patch. Adjustable strap.',
    price: 4500,
    image: 'img/product3.png',
    metadata: { category: 'accessories' }
  },
  {
    name: 'Essential Joggers',
    description: 'Tapered joggers in premium French terry. Elastic waist with drawcord.',
    price: 12000,
    image: 'img/product4.png',
    metadata: { category: 'bottoms', badge: 'new' }
  },
  {
    name: 'Crewneck',
    description: 'Classic crewneck sweatshirt. Heavyweight brushed fleece, ribbed trims.',
    price: 13500,
    image: 'img/product5.png',
    metadata: { category: 'tops' }
  },
  {
    name: 'Canvas Tote',
    description: '16oz washed canvas tote with interior pocket. Reinforced handles.',
    price: 5500,
    image: 'img/product6.png',
    metadata: { category: 'accessories' }
  }
];

async function seedProducts() {
  const stripe = await getUncachableStripeClient();

  const existing = await stripe.products.list({ limit: 100 });

  for (const product of PRODUCTS) {
    const found = existing.data.find(p => p.name === product.name);
    if (found) {
      console.log(`Skipping "${product.name}" — already exists (${found.id})`);
      continue;
    }

    const created = await stripe.products.create({
      name: product.name,
      description: product.description,
      metadata: product.metadata,
    });

    const price = await stripe.prices.create({
      product: created.id,
      unit_amount: product.price,
      currency: 'usd',
    });

    console.log(`Created "${product.name}" → ${created.id} / ${price.id} ($${(product.price / 100).toFixed(2)})`);
  }

  console.log('Done seeding products.');
}

seedProducts().catch(console.error);
