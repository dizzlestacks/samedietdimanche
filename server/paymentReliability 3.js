import { randomUUID } from 'node:crypto';
import { completedPayment, validateProviderOrder } from './paypalRoutes.js';
import { paymentStore } from './paymentStore.js';
import { paypalRequest, isPayPalConfigured } from './paypalClient.js';
import { clothingInventory } from './productsDb.js';
import { sendEmail, isEmailConfigured, brandTemplate } from './email.js';

const escape = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cad = cents => `CAD ${(cents / 100).toFixed(2)}`;
export const reliabilityEnabled = () => process.env.PAYMENT_RECONCILIATION_ENABLED === 'true' && isPayPalConfigured();
export const confirmationsEnabled = () => process.env.ORDER_EMAIL_ENABLED === 'true' && isEmailConfigured() && !!process.env.EMAIL_FROM && /^https:\/\//.test(process.env.PUBLIC_URL || '');

export function confirmationEmail(order, baseUrl) {
  const lines = order.lines.map(l => `<p>${l.quantity} × ${escape(l.name)} — ${cad(l.unitCents*l.quantity)}<br>` +
    `<small>${[l.baseName,l.faceName,l.bandName,l.size,l.color].filter(Boolean).map(escape).join(' · ')}</small>` +
    (l.preorder ? `<br><strong>Paid preorder</strong><br>${escape(l.fulfillmentNote)}` : '') + '</p>').join('');
  return {
    to:order.address.email,subject:'Your Samedi Et Dimanche order is confirmed',
    idempotencyKey:`order-confirmation-${order.id}`,
    html:brandTemplate({heading:'Your order is confirmed',baseUrl,
      bodyHtml:`<p>Order ${escape(order.paypalId)}</p>${lines}<hr>` +
      `<p>Subtotal: ${cad(order.total.subtotalCents)}<br>Shipping: ${cad(order.total.shippingCents)}<br>` +
      `${escape(order.total.taxLabel || 'Tax')}: ${cad(order.total.taxCents)}<br><strong>Total paid: ${cad(order.total.totalCents)}</strong></p>` +
      '<p>This confirms your payment, not shipment. Tracking is provided separately when your items ship.</p>'})
      .replaceAll('Georgia,serif',"'Montserrat',Arial,sans-serif"),
  };
}

export function createPaymentReliability({
  store=paymentStore, paypal=paypalRequest, inventory=clothingInventory,
  enabled=reliabilityEnabled, emailEnabled=confirmationsEnabled, email=sendEmail,
  now=Date.now, baseUrl=()=>process.env.PUBLIC_URL, logger=console,
} = {}) {
  let running=false;
  const state={running:false,lastRunAt:null,lastSuccessAt:null,lastError:null};

  async function reconcile(id) {
    return store.transact(id,async order=>{
      if (!order || !['created','pending'].includes(order.status) || (order.nextCheckAt||0)>now()) return order;
      const checkedAt=now();
      try {
        // GET only: never capture, approve, refund, or void from this worker.
        const remote=await paypal(`/v2/checkout/orders/${encodeURIComponent(order.paypalId)}`);
        validateProviderOrder(remote,order);
        const capture=completedPayment(remote,order);
        if (capture) {
          // An existing inventory claim is idempotent, including after a crashed capture request.
          await inventory(order.id,order.items);
          return {...order,status:'paid',captureId:capture.id,paidAt:order.paidAt||checkedAt,
            nextCheckAt:checkedAt,paymentCheck:{status:'confirmed',checkedAt}};
        }
        const captures=remote.purchase_units?.[0]?.payments?.captures||[];
        if (remote.status==='VOIDED' && captures.length===0) {
          await inventory(order.id,order.items,true);
          return {...order,status:'cancelled',paymentCheck:{status:'voided',checkedAt}};
        }
        // Elapsed time/APPROVED/404 cannot prove a timed-out capture failed.
        // Preserve stock and flag uncertain cases for review rather than overselling.
        const needsReview=checkedAt-order.created>86400000;
        return {...order,nextCheckAt:checkedAt+(needsReview?3600000:300000),
          paymentCheck:{status:needsReview?'needs_review':'waiting',checkedAt}};
      } catch {
        return {...order,nextCheckAt:checkedAt+900000,
          paymentCheck:{status:'needs_review',checkedAt,error:'Payment could not be verified. Stock remains protected; do not charge again.'}};
      }
    });
  }

  async function confirm(id) {
    if (!emailEnabled()) return;
    const token=randomUUID();
    const claimed=await store.transact(id,async order=>{
      if (!order || order.status!=='paid' || !order.confirmationEligible || order.confirmation) return order;
      return {...order,confirmation:{status:'sending',token,attemptedAt:now()}};
    });
    if (claimed?.confirmation?.token!==token) return;
    // Durable claim is committed before sending. Ambiguous sends are NEVER retried
    // automatically, even if the provider's idempotency window has expired.
    let result;
    try { result=await email(confirmationEmail(claimed,baseUrl())); }
    catch { result={sent:false}; }
    await store.transact(id,async order=>({
      ...order,confirmation:{...order.confirmation,status:result.sent?'sent':'needs_review',
        ...(result.sent?{sentAt:now(),providerId:result.id}:{error:'Email acceptance was not confirmed. Review with the email provider before resending.'})},
    }));
  }

  async function tick() {
    if (!enabled() || running) return;
    running=true;state.running=true;state.lastRunAt=now();state.lastError=null;
    try {
      for (const candidate of await store.workItems(now())) {
        const order=await reconcile(candidate.id);
        if (order?.status==='paid') {
          await confirm(order.id);
          // Defer disabled email work so it cannot starve older unresolved payments.
          if (!emailEnabled()) await store.transact(order.id,async latest=>({...latest,nextCheckAt:now()+3600000}));
        }
      }
      state.lastSuccessAt=now();
    } catch { state.lastError='Payment worker could not finish. Check database and payment service availability.';logger.error(state.lastError); }
    finally { running=false;state.running=false; }
  }
  return {tick,reconcile,confirm,status:()=>({...state,enabled:enabled(),emailEnabled:emailEnabled()}),
    start(){const timer=setInterval(()=>void tick(),60000);timer.unref();return ()=>clearInterval(timer);}};
}
