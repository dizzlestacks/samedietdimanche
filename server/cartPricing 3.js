import { canonicalWatchItems, quoteWatches, MAX_QUANTITY } from './watchPricing.js';
const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
export function canonicalCartItems(items) {
  if (!Array.isArray(items) || items.length > 100) throw new Error('Provide at most 100 cart entries.');
  const merged = new Map();
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item) ||
        !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY) throw new Error('Quantity must be an integer from 1 to 20.');
    let clean;
    if (item.type === 'watch' && Object.keys(item).every(k => ['type','baseId','face','band','quantity'].includes(k))) {
      clean = { type:'watch', ...canonicalWatchItems([{baseId:item.baseId,face:item.face,band:item.band,quantity:item.quantity}])[0] };
    } else if (item.type === 'shop' && Object.keys(item).every(k => ['type','productId','priceId','variantId','quantity'].includes(k)) && id(item.productId) && id(item.priceId) && (item.variantId === undefined || id(item.variantId))) {
      clean = {type:'shop',productId:item.productId,priceId:item.priceId,...(item.variantId === undefined ? {} : {variantId:item.variantId}),quantity:item.quantity};
    } else throw new Error('Invalid cart type, identifiers or fields. Prices and sizes cannot be supplied.');
    const key = clean.type === 'watch' ? `watch:${clean.baseId}:${clean.face}:${clean.band}` : `shop:${clean.productId}:${clean.priceId}:${clean.variantId || ''}`;
    clean.quantity += merged.get(key)?.quantity || 0;
    if (clean.quantity > MAX_QUANTITY) throw new Error('Maximum quantity is 20 per exact item.');
    merged.set(key,clean);
  }
  return [...merged.values()];
}
export function quoteCart(items, settings, products) {
  const canonical = canonicalCartItems(items);
  const demanded = new Map();
  for (const item of canonical) if (item.variantId) {
    const key = `${item.productId}:${item.variantId}`;
    demanded.set(key, (demanded.get(key) || 0) + item.quantity);
  }
  const lines = canonical.map(item => {
    if (item.type === 'watch') {
      const line = quoteWatches([{baseId:item.baseId,face:item.face,band:item.band,quantity:item.quantity}],settings).lines[0];
      return {...line,type:'watch',name:`${line.faceName} face / ${line.bandName} band`, reason:line.available ? '' : 'The base watch or an applicable change fee is unpriced.'};
    }
    // Preserve discontinued/deleted identifiers without leaking closed-shop data.
    const product = settings.shopEnabled === false ? null : products.find(p => p.category === 'shop' && p.active === true && p.id === item.productId);
    const price = product?.prices?.find(p => p.id === item.priceId && p.active === true);
    const variant = product?.variants?.find(v => v.id === item.variantId);
    const needsVariant = !!product?.variants?.length || item.variantId !== undefined;
    const variantAvailable = !needsVariant || !!variant && variant.active === true && Number.isSafeInteger(variant.stock) && variant.stock >= demanded.get(`${item.productId}:${item.variantId}`);
    const available = variantAvailable && !!price && String(price.currency).toLowerCase() === 'cad' && Number.isSafeInteger(price.unit_amount) && price.unit_amount > 0 && price.unit_amount <= 1000000;
    return {...item,...(variant ? {size:variant.size,color:variant.color} : {}),
      name:product ? product.name + (variant ? ` — Size: ${variant.size} / Color: ${variant.color}` : '') : 'Shop item unavailable',image:product?.images?.[0] || '',
      available,unitCents:available ? price.unit_amount : null,lineCents:available ? price.unit_amount * item.quantity : null,
      reason:available ? '' : product && !variantAvailable ? 'Choose an available size and color with enough stock.' : 'This product or price is no longer available.'};
  });
  const available = lines.every(l => l.available);
  for(const line of lines){
    if(line.type==='watch'?settings.preorderWatchesActive===true:settings.preorderShopActive===true){
      line.preorder=true;
      line.fulfillmentNote=settings.preorderFulfillmentNote;
    }
  }
  const priceHidden = lines.some(l => l.priceHidden);
  return {currency:'CAD',checkoutEnabled:false,informational:true,available,priceHidden,lines,quantity:lines.reduce((s,l)=>s+l.quantity,0),
    totalCents:available && !priceHidden ? lines.reduce((s,l)=>s+l.lineCents,0) : null};
}
export function registerCartRoutes(app,{getSettings,listProducts}) {
  app.post('/api/cart-quote',async(req,res)=>{
    res.set('Cache-Control','no-store');
    if (!req.body || Array.isArray(req.body) || Object.keys(req.body).length !== 1 || !Object.hasOwn(req.body,'items')) return res.status(400).json({error:'Provide only cart items. Prices are server calculated.'});
    let items;
    try { items=canonicalCartItems(req.body.items); } catch(e) { return res.status(400).json({error:e.message}); }
    try {
      const settings=await getSettings(req);
      const products=settings.shopEnabled === false || !items.some(i=>i.type==='shop') ? [] : await listProducts({category:'shop',activeOnly:false});
      res.json(quoteCart(items,settings,products));
    } catch { res.status(503).json({error:'Current cart pricing is unavailable. Please retry.'}); }
  });
}
