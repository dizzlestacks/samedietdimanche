import { randomUUID } from 'node:crypto';
import { isEmailConfigured, sendEmail, brandTemplate } from './email.js';

export const shippingEmailEnabled = () => process.env.SHIPPING_EMAIL_ENABLED === 'true' &&
  isEmailConfigured() && Boolean(process.env.EMAIL_FROM?.trim());
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const states = ['unfulfilled', 'preparing', 'shipped', 'delivered'];
export function fulfillmentGroups(order) {
  return ['regular', 'preorder'].filter(group => order.lines.some(l => (!!l.preorder) === (group === 'preorder')))
    .map(group => ({ group, status:'unfulfilled', carrier:'', trackingNumber:'', trackingUrl:'', notes:'',
      ...order.fulfillment?.[group] }));
}
function text(value, max) {
  if (typeof value !== 'string' || value.length > max) throw Error('Invalid shipping details.');
  return value.trim();
}
function details(body) {
  if (!states.includes(body.status)) throw Error('Invalid shipping status.');
  const value = {status:body.status, carrier:text(body.carrier,100), trackingNumber:text(body.trackingNumber,200),
    trackingUrl:text(body.trackingUrl,2000), notes:text(body.notes,2000)};
  if (value.trackingUrl) {
    let url;
    try { url = new URL(value.trackingUrl); } catch { throw Error('Use a valid HTTPS tracking URL.'); }
    if (url.protocol !== 'https:' || url.username || url.password) throw Error('Use a valid HTTPS tracking URL.');
  }
  return value;
}
export function registerFulfillmentRoutes(app, {store, wrap, emailEnabled=shippingEmailEnabled, email=sendEmail}) {
  function groupFor(order, group) {
    if (!order || order.status !== 'paid') throw Error('Only paid orders can be fulfilled.');
    const current = fulfillmentGroups(order).find(f => f.group === group);
    if (!current) throw Error('This order does not contain that item group.');
    return current;
  }
  app.put('/api/admin/orders/:id/fulfillment/:group', wrap(async(req,res) => {
    const update = details(req.body);
    const order = await store.transact(req.params.id, async order => {
      const current = groupFor(order,req.params.group);
      if (current.notification && !['shipped','delivered'].includes(update.status)) throw Error('A notified shipment cannot be reset.');
      const next = {...current,...update,updatedAt:Date.now()};
      if (['shipped','delivered'].includes(next.status)) next.shippedAt ||= Date.now();
      if (next.status === 'delivered') next.deliveredAt ||= Date.now();
      return {...order,fulfillment:{...order.fulfillment,[req.params.group]:next}};
    });
    res.json({fulfillment:fulfillmentGroups(order)});
  }));
  app.post('/api/admin/orders/:id/fulfillment/:group/notify', wrap(async(req,res) => {
    if (!emailEnabled()) return res.status(503).json({error:'Shipping email is disabled. Configure Resend and a verified sender, then enable SHIPPING_EMAIL_ENABLED.'});
    const token = randomUUID(), group = req.params.group;
    // Commit the claim BEFORE the external call. Never resend an uncertain attempt,
    // even after a process crash, timeout, or provider idempotency expiry.
    const order = await store.transact(req.params.id, async order => {
      const current = groupFor(order,group);
      if (!['shipped','delivered'].includes(current.status)) throw Error('Mark this shipment shipped before notifying the customer.');
      if (current.notification) return order;
      if (!order.address.email) throw Error('This order has no customer email.');
      return {...order,fulfillment:{...order.fulfillment,[group]:{...current,
        notification:{status:'sending',token,attemptedAt:Date.now()}}}};
    });
    const shipment = order.fulfillment[group];
    if (shipment.notification.token !== token) return res.json({notification:shipment.notification,duplicate:true});
    const lines = order.lines.filter(l => (!!l.preorder) === (group === 'preorder'));
    let result;
    try {
      result = await email({to:order.address.email, subject:`Your ${group === 'preorder' ? 'preorder' : 'order'} has shipped`,
        idempotencyKey:`shipping-${order.id}-${group}`,
        html:brandTemplate({heading:'Your items have shipped',bodyHtml:
          `<p>Order ${escape(order.paypalId)}</p><p>${lines.map(l=>`${l.quantity} × ${escape(l.name)}`).join('<br>')}</p>` +
          `<p>${escape(shipment.carrier)} ${escape(shipment.trackingNumber)}</p>` +
          (fulfillmentGroups(order).length > 1 ? '<p>This notification covers only the items listed above. Other items in your order are tracked separately.</p>' : ''),
          ctaText:shipment.trackingUrl?'Track shipment':null,ctaUrl:shipment.trackingUrl})});
    } catch { result = {sent:false}; }
    const saved = await store.transact(order.id, async latest => {
      const current = latest.fulfillment[group];
      return {...latest,fulfillment:{...latest.fulfillment,[group]:{...current,notification:{
        ...current.notification,status:result.sent?'sent':'needs_review',
        ...(result.sent?{sentAt:Date.now(),providerId:result.id}:{error:'Delivery was not confirmed. Check the email provider before contacting the customer manually. Automatic resend is blocked.'})
      }}}};
    });
    res.json({notification:saved.fulfillment[group].notification});
  }));
}
