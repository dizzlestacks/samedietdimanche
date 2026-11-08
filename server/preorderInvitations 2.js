import { randomUUID } from 'node:crypto';
import { createPreorderToken, verifyPreorderToken } from './preorders.js';
import { brandTemplate } from './email.js';

const prefix = category => category === 'watches' ? 'preorderWatches' : 'preorderShop';
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const eligible = (rows, category, email) => rows.some(row =>
  row.category === category && row.email === email && row.invitation_consent === true);

// Drafts are deliberately short-lived and process-local. A restart loses the draft,
// never repeats a send. Confirmation is consumed synchronously before any delivery.
export function registerPreorderInvitations(app, {getSettings, getWaitlist, getPublicBaseUrl, isEmailConfigured, sendEmail}) {
  const drafts = new Map();
  const prune = () => { for (const [id, draft] of drafts) if (draft.reviewUntil <= Date.now()) drafts.delete(id); };
  app.post('/api/admin/preorder-invitations/preview', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      prune();
      const {category, recipients, expiresAt} = req.body || {};
      const expires = new Date(expiresAt).getTime();
      if (!['watches','shop'].includes(category)) return res.status(400).json({error:'Choose watches or shop.'});
      if (!Array.isArray(recipients) || !recipients.length || recipients.length > 50 ||
          recipients.some(email => typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
        return res.status(400).json({error:'Select between 1 and 50 eligible recipients.'});
      }
      if (!Number.isFinite(expires) || expires <= Date.now() || expires > Date.now()+30*86400000)
        return res.status(400).json({error:'Choose an expiry within the next 30 days.'});
      if (!isEmailConfigured()) return res.status(409).json({error:'Email delivery is not configured. No invitations sent.'});
      const settings = await getSettings();
      if (settings[prefix(category)+'Enabled'] !== true)
        return res.status(409).json({error:'Enable preorders for this category first.'});
      if (!settings.preorderFulfillmentNote?.trim())
        return res.status(409).json({error:'Save a preorder shipping estimate first.'});
      const emails = [...new Set(recipients)];
      const rows = await getWaitlist();
      if (emails.some(email => !eligible(rows, category, email)))
        return res.status(409).json({error:'Selection includes members without recorded signup consent for this category. Reload recipients.'});
      const base = new URL(getPublicBaseUrl());
      if (!['https:','http:'].includes(base.protocol) || base.username || base.password) throw Error('Invalid site URL');
      const token = createPreorderToken(category, settings[prefix(category)+'Revision'] || 'initial', expires);
      if (drafts.size >= 100) return res.status(429).json({error:'Too many pending reviews. Try again in ten minutes.'});
      const id = randomUUID();
      const draft = {category, recipients:emails, expiresAt:new Date(expires).toISOString(), token,
        shippingEstimate:settings.preorderFulfillmentNote, reviewUntil:Math.min(expires, Date.now()+600000),
        url:`${base.origin}/${category === 'watches' ? 'watches' : 'shop'}.html?preorder=${encodeURIComponent(token)}`};
      drafts.set(id, draft);
      res.json({draftId:id, category, recipients:emails, expiresAt:draft.expiresAt,
        shippingEstimate:draft.shippingEstimate, reviewUntil:new Date(draft.reviewUntil).toISOString()});
    } catch {
      res.status(500).json({error:'Could not prepare invitations. Check secure link and site URL configuration. No invitations sent.'});
    }
  });
  app.post('/api/admin/preorder-invitations/send', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    prune();
    const id = req.body?.draftId, draft = drafts.get(id);
    if (req.body?.confirm !== true || !draft)
      return res.status(409).json({error:'Review recipients again. This confirmation is missing, expired or already used.'});
    drafts.delete(id);
    const results = [];
    for (const email of draft.recipients) {
      try {
        // Recheck for each recipient, including changes while a batch is sending.
        const settings = await getSettings();
        if (!verifyPreorderToken(draft.token, settings) || settings.preorderFulfillmentNote !== draft.shippingEstimate) {
          results.push({email, sent:false, error:'Preorders changed, were disabled, or this link expired or was revoked. Review again.'}); continue;
        }
        if (!eligible(await getWaitlist(), draft.category, email)) {
          results.push({email, sent:false, error:'Signup consent is no longer recorded for this category.'}); continue;
        }
        if (!isEmailConfigured()) {
          results.push({email, sent:false, error:'Email delivery is not configured.'}); continue;
        }
        const outcome = await sendEmail({
          to:email, idempotencyKey:`preorder-invite-${id}-${results.length}`,
          subject:`Your private ${draft.category === 'watches' ? 'watch' : 'shop'} preorder invitation`,
          html:brandTemplate({heading:'Your private preorder invitation',
            bodyHtml:`<p>You joined our ${escape(draft.category)} waitlist. Your private invitation is ready.</p><p>Full payment is required upfront through PayPal.</p><p>Shipping estimate: ${escape(draft.shippingEstimate)}</p><p>Link expires: ${escape(draft.expiresAt)} (UTC). Please keep this link private.</p>`,
            ctaText:'View private preorders', ctaUrl:draft.url})
        });
        results.push({email, sent:outcome.sent === true, ...(outcome.sent ? {} : {error:'Delivery was not confirmed. Check the email provider before sending again.'})});
      } catch {
        results.push({email, sent:false, error:'Delivery was not confirmed. Check the email provider before sending again.'});
      }
    }
    res.json({results, sent:results.filter(r => r.sent).length, failed:results.filter(r => !r.sent).length});
  });
}
