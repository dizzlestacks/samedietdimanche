import { createHash } from 'node:crypto';
import { canonicalCartItems, quoteCart } from './cartPricing.js';
import { cleanAddress, totals, COUNTRIES, GST_HST } from './checkoutTaxes.js';
import { isPayPalConfigured, paypalRequest } from './paypalClient.js';
import { paymentStore } from './paymentStore.js';
import { clothingInventory } from './productsDb.js';
import { fulfillmentGroups, registerFulfillmentRoutes, shippingEmailEnabled } from './orderFulfillment.js';
const hash = value => createHash('sha256').update(value).digest('hex');
const money = cents => (cents / 100).toFixed(2);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function owner(req) {
  const key = req.get('X-Checkout-Key') || '';
  if (!/^[0-9a-f]{64}$/.test(key)) throw new Error('Checkout session is missing. Reload the cart.');
  return hash(key);
}
export function paymentBody(order) {
  const a = order.address, t = order.total;
  return {intent:'CAPTURE', purchase_units:[{
    reference_id:order.id, custom_id:order.id, invoice_id:order.id,
    amount:{currency_code:'CAD',value:money(t.totalCents),breakdown:{
      item_total:{currency_code:'CAD',value:money(t.subtotalCents)},
      tax_total:{currency_code:'CAD',value:money(t.taxCents)},shipping:{currency_code:'CAD',value:'0.00'},
    }},
    items:order.lines.map(l=>({name:((l.preorder?'PREORDER · ':'')+l.name).slice(0,127), quantity:String(l.quantity),category:'PHYSICAL_GOODS',
      description:(l.type==='watch' ? `Base: ${l.baseName}; Face: ${l.faceName}; Band: ${l.bandName}` : l.variantId ? `Size: ${l.size}; Color: ${l.color}` : l.name).slice(0,127),
      unit_amount:{currency_code:'CAD',value:money(l.unitCents)}})),
    shipping:{name:{full_name:a.name},address:{address_line_1:a.line1,...(a.line2?{address_line_2:a.line2}:{}),admin_area_2:a.city,
      ...(a.region?{admin_area_1:a.region}:{}),...(a.postalCode?{postal_code:a.postalCode}:{}),country_code:a.country}},
  }], payment_source:{paypal:{experience_context:{brand_name:'Samedi Et Dimanche',shipping_preference:'SET_PROVIDED_ADDRESS',user_action:'PAY_NOW'}}}};
}
export function validateProviderOrder(data, order) {
  const p = data.purchase_units?.[0];
  if (data.id !== order.paypalId || data.purchase_units?.length !== 1 || p?.custom_id !== order.id ||
      p.amount?.currency_code !== 'CAD' || p.amount?.value !== money(order.total.totalCents)) throw new Error('Payment verification failed. Contact the store before retrying.');
  const actual = p.shipping?.address, expected = paymentBody(order).purchase_units[0].shipping.address;
  for (const key of Object.keys(expected)) {
    const normalize = v => String(v||'').toUpperCase().replace(/\s+/g,'');
    if (normalize(actual?.[key]) !== normalize(expected[key])) throw new Error('Shipping address changed. Return to the cart to recalculate tax.');
  }
}
export function completedPayment(data, order) {
  validateProviderOrder(data, order);
  const captures = data.purchase_units?.[0]?.payments?.captures || [];
  const capture = captures[0];
  return data.status === 'COMPLETED' && captures.length === 1 &&
    capture?.status === 'COMPLETED' && typeof capture.id === 'string' &&
    capture.amount?.currency_code === 'CAD' && capture.amount.value === money(order.total.totalCents)
    ? capture : null;
}
export function registerPayPalRoutes(app, {getSettings,listProducts,store=paymentStore,paypal=paypalRequest,configured=isPayPalConfigured,inventory=clothingInventory,emailEnabled=shippingEmailEnabled,email}) {
  const attempts = new Map();
  app.use('/api/checkout', (req,res,next)=>{
    if (req.method !== 'POST') return next();
    const now=Date.now(), key=req.ip;
    if (attempts.size > 2000) for (const [k,v] of attempts) if (v.until<now) attempts.delete(k);
    const entry=attempts.get(key);
    if (!entry || entry.until<now) attempts.set(key,{count:1,until:now+60000});
    else if (++entry.count>40) return res.status(429).json({error:'Too many checkout requests. Wait a minute and retry.'});
    next();
  });
  async function calculate(items, address, req, inventoryOrderId) {
    const clean = canonicalCartItems(items);
    if (!clean.length || clean.length > 50) throw new Error('Checkout requires 1–50 distinct cart items.');
    const settings = await getSettings(req);
    if (clean.some(i=>i.type==='watch') && (settings.watchesMode !== 'shop' || settings.watchPreviewEnabled === true)) throw new Error('Watch checkout is unavailable in waitlist or preview mode.');
    if (clean.some(i=>i.type==='shop') && settings.shopEnabled === false) throw new Error('The clothing shop is closed.');
    const products = clean.some(i=>i.type==='shop') ? await listProducts({activeOnly:true,category:'shop',inventoryOrderId}) : [];
    const quote = quoteCart(clean,settings,products);
    if (!quote.available || quote.priceHidden || quote.totalCents === null) throw new Error('Some cart items are unavailable. Refresh your cart.');
    const destination = cleanAddress(address);
    return {items:clean, lines:quote.lines,address:destination,total:totals(quote.totalCents,destination,settings.salesTaxEnabled)};
  }
  const wrap = fn => async(req,res)=>{
    res.set('Cache-Control','no-store');
    try { await fn(req,res); } catch(e) {
      // Validation and provider errors are deliberately user-safe; storage internals aren't.
      const safe = e instanceof Error && !e.code && !/ECONN|relation |JSON|password|postgres|fetch failed/i.test(e.message);
      res.status(400).json({error:safe?e.message:'Checkout storage or payment service is unavailable. Please try again later.'});
    }
  };
  app.get('/api/paypal/config',wrap(async(req,res)=>{
    const settings = await getSettings(req);
    res.json({
    salesTaxEnabled: settings.salesTaxEnabled !== false,
    enabled:configured(), provider:'paypal', clientId:configured()?process.env.PAYPAL_CLIENT_ID:null,
    currency:'CAD', countries:[...COUNTRIES], provinces:Object.keys(GST_HST),
    });
  }));
  app.post('/api/checkout/quote',wrap(async(req,res)=>{
    const order = await calculate(req.body.items,req.body.address,req);
    res.json({...order.total,preorder:order.lines.some(l=>l.preorder),fulfillmentNote:order.lines.find(l=>l.preorder)?.fulfillmentNote||''});
  }));
  app.post('/api/checkout',wrap(async(req,res)=>{
    if (!configured()) return res.status(503).json({error:'PayPal is not configured.'});
    const ownerHash = owner(req), id = req.body.requestId;
    if (!uuid.test(id || '')) throw new Error('Invalid checkout request.');
    const quote = await calculate(req.body.items,req.body.address,req);
    if(quote.lines.some(l=>l.preorder)&&req.body.preorderAccepted!==true)throw Error('Confirm that preorder items are paid in full now and delivered in the stated timeframe.');
    const fingerprint = hash(JSON.stringify(quote));
    const order = await store.transact(id,async(existing)=>{
      if (existing) {
        if (existing.status === 'cancelled') throw new Error('Checkout cancelled. Review your total again.');
        if (existing.owner !== ownerHash || existing.fingerprint !== fingerprint) throw new Error('This checkout changed. Review it and start again.');
        if (Date.now()-existing.created > 3600000) throw new Error('This checkout expired. Review it and start again.');
        return existing;
      }
      const record = {id,owner:ownerHash,fingerprint,...quote,confirmationEligible:true,preorderAccepted:quote.lines.some(l=>l.preorder),created:Date.now(),status:'created'};
      const result = await paypal('/v2/checkout/orders',{method:'POST',requestId:`create-${id}`,body:paymentBody(record)});
      if (!result.id || !['CREATED','PAYER_ACTION_REQUIRED','APPROVED'].includes(result.status)) throw new Error('PayPal did not create an order.');
      return {...record,paypalId:result.id};
    });
    res.json({checkoutId:order.id,orderId:order.paypalId});
  }));
  app.post('/api/checkout/:id/capture',wrap(async(req,res)=>{
    if (!configured()) return res.status(503).json({error:'PayPal is not configured.'});
    if (!uuid.test(req.params.id)) throw new Error('Invalid checkout request.');
    const ownerHash = owner(req);
    const order = await store.transact(req.params.id,async(record)=>{
      if (!record || record.owner !== ownerHash || record.status === 'cancelled') throw new Error('Checkout not found or cancelled for this browser.');
      if (record.status === 'paid') return record;
      let result = await paypal(`/v2/checkout/orders/${record.paypalId}`);
      validateProviderOrder(result,record);
      if (result.status !== 'COMPLETED') {
        if (Date.now()-record.created > 3600000) throw new Error('Checkout expired; no new payment was taken.');
        const fresh = await calculate(record.items,record.address,req,record.id);
        if (hash(JSON.stringify(fresh)) !== record.fingerprint) throw new Error('Pricing or availability changed. Review your cart before paying.');
        if (result.status !== 'APPROVED') throw new Error('Approve the payment in PayPal first.');
        await inventory(record.id,record.items);
        result = await paypal(`/v2/checkout/orders/${record.paypalId}/capture`,{method:'POST',requestId:`capture-${record.id}`,body:{}});
        // Fetch full order representation for stable amount/address validation.
        result = await paypal(`/v2/checkout/orders/${record.paypalId}`);
        validateProviderOrder(result,record);
      }
      const capture = completedPayment(result,record);
      if (capture) {
        return {...record,status:'paid',captureId:capture.id,paidAt:Date.now()};
      }
      return {...record,status:'pending'};
    });
    res.json({status:order.status,orderId:order.paypalId,total:order.total});
  }));
  app.post('/api/checkout/:id/receipt',wrap(async(req,res)=>{
    if (!uuid.test(req.params.id)) throw new Error('Invalid receipt request.');
    const ownerHash = owner(req);
    const order = await store.get(req.params.id);
    if (!order || order.owner !== ownerHash) return res.status(404).json({error:'Receipt not found for this browser.'});
    if (order.status !== 'paid') return res.status(409).json({error:'Payment is not confirmed. Return to the cart and check payment status; do not pay again.'});
    // Only persisted, provider-verified payments become receipts. Do not re-price
    // historical orders or expose addresses, session hashes or provider secrets.
    res.json({receipt:{
      id:order.id,orderId:order.paypalId,paidAt:order.paidAt,status:'paid',currency:'CAD',
      total:order.total,
      lines:order.lines.map(l=>({
        name:l.name,type:l.type,quantity:l.quantity,unitCents:l.unitCents,
        baseName:l.baseName,faceName:l.faceName,bandName:l.bandName,
        size:l.size,color:l.color,preorder:!!l.preorder,fulfillmentNote:l.fulfillmentNote,
      })),
    }});
  }));
  app.post('/api/checkout/:id/cancel',wrap(async(req,res)=>{
    if (!uuid.test(req.params.id)) throw new Error('Invalid checkout request.');
    const ownerHash=owner(req);
    await store.transact(req.params.id,async(record)=>{
      if (!record || record.owner!==ownerHash) throw new Error('Checkout not found for this browser.');
      if (record.status==='paid' || record.status==='pending') throw new Error('Payment may already have been taken. Check payment status instead.');
      const result=await paypal(`/v2/checkout/orders/${record.paypalId}`);
      if (result.status==='COMPLETED' || result.purchase_units?.some(p=>p.payments?.captures?.length)) throw new Error('Payment may already have been taken. Check payment status instead.');
      await inventory(record.id,record.items,'cancel');
      return {...record,status:'cancelled'};
    });
    res.json({cancelled:true});
  }));
  registerFulfillmentRoutes(app,{store,wrap,emailEnabled,email});
  app.get('/api/admin/orders',wrap(async(req,res)=>{
    const orders = (await store.list()).filter(o=>['paid','pending'].includes(o.status) || o.paymentCheck?.status==='needs_review');
    res.json({paymentEnabled:configured(),shippingEmailEnabled:emailEnabled(),provider:'paypal',data:orders.map(o=>({
      checkoutId:o.id,fulfillment:fulfillmentGroups(o),paymentCheck:o.paymentCheck,
      confirmation:o.confirmation ? {status:o.confirmation.status==='sending' && Date.now()-o.confirmation.attemptedAt>600000?'needs_review':o.confirmation.status} : {status:o.confirmationEligible?'queued':'not_scheduled'},
      id:o.paypalId,amount:o.total.totalCents,currency:'cad',email:o.address.email,name:o.address.name,created:Math.floor(o.created/1000),
      paymentStatus:o.status,shipping:o.address,items:o.lines.map(l=>({name:(l.preorder?'PREORDER · ':'')+l.name,quantity:l.quantity,baseName:l.baseName,variantId:l.variantId,size:l.size,color:l.color,preorder:!!l.preorder,fulfillmentNote:l.fulfillmentNote})),tax:o.total.taxCents,
    })),revenue:orders.filter(o=>o.status==='paid').reduce((sum,o)=>sum+o.total.totalCents,0)});
  }));
}
