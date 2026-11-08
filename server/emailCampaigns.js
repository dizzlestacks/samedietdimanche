import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { EMAIL_THEMES, renderCampaign } from './emailThemes.js';

const categories = new Set(['all', 'watches', 'shop', 'bud']);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function validateCampaign(body = {}) {
  const text = (key, max) => {
    if (typeof body[key] !== 'string' || body[key].length > max) throw Error(`Invalid ${key}.`);
    return body[key].trim();
  };
  const draft = {
    theme: text('theme', 80), subject: text('subject', 200),
    message: text('message', 10000), category: text('category', 20),
    ctaText: text('ctaText', 100), ctaPath: text('ctaPath', 500),
  };
  if (!EMAIL_THEMES.some(t => t.id === draft.theme) || !categories.has(draft.category)) throw Error('Choose a valid theme and recipient list.');
  if (!draft.subject || !draft.message || /[\r\n]/.test(draft.subject)) throw Error('Subject and message are required; subject must be one line.');
  if (Boolean(draft.ctaText) !== Boolean(draft.ctaPath)) throw Error('Provide both button fields, or leave both empty.');
  // No private access tokens or external redirects in general blasts.
  if (draft.ctaText && !['/', '/watches.html', '/shop.html', '/clothing.html', '/socials.html'].includes(draft.ctaPath))
    throw Error('Choose a public site page for the button. Private invitations are sent separately.');
  return draft;
}

export function campaignRecipients(rows, category) {
  const suppressed = new Set(rows.filter(r => r.marketing_unsubscribed === true).map(r => String(r.email).trim().toLowerCase()));
  return [...new Set(rows.filter(r => category === 'all' || r.category === category)
    .map(r => String(r.email || '').trim().toLowerCase())
    .filter(e => emailPattern.test(e) && !suppressed.has(e)))].sort();
}

export function unsubscribeToken(email, secret) {
  if (!secret) throw Error('Secure email unsubscribe links are not configured.');
  const data = Buffer.from(email.toLowerCase()).toString('base64url');
  return data + '.' + createHmac('sha256', secret).update('marketing-unsubscribe:' + data).digest('base64url');
}
export function verifyUnsubscribe(token, secret) {
  if (!secret || typeof token !== 'string' || token.length > 1000) return null;
  try {
    const [data, signature, extra] = token.split('.');
    if (extra || !data || !signature) return null;
    const email = Buffer.from(data, 'base64url').toString();
    if (!emailPattern.test(email)) return null;
    const expected = unsubscribeToken(email, secret);
    const a = Buffer.from(token), b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b) ? email : null;
  } catch { return null; }
}

export function registerEmailCampaigns(app, { getWaitlist, unsubscribeMarketing, getPublicBaseUrl, isEmailConfigured, sendEmail, getSecret = () => process.env.SESSION_SECRET }) {
  const reviews = new Map();
  let busy = false;
  const configured = () => Boolean(isEmailConfigured() && getSecret());
  const rows = () => getWaitlist({ strict: true });
  const prune = () => { for (const [id, r] of reviews) if (r.expires <= Date.now()) reviews.delete(id); };
  const html = (draft, email) => renderCampaign({
    ...draft, baseUrl: getPublicBaseUrl(),
    unsubscribeUrl: email ? `${getPublicBaseUrl()}/email/unsubscribe?token=${encodeURIComponent(unsubscribeToken(email, getSecret()))}` : '',
  });
  app.get('/api/admin/email-themes', (_req, res) => res.json({ themes: EMAIL_THEMES }));
  app.post('/api/admin/email-blast/preview', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const draft = validateCampaign(req.body), recipients = campaignRecipients(await rows(), draft.category);
      prune();
      if (reviews.size >= 100) reviews.delete(reviews.keys().next().value);
      const draftId = randomUUID();
      reviews.set(draftId, { draft, recipients, expires: Date.now() + 600000 });
      res.json({ html: html(draft), total: recipients.length, configured: configured(), draftId });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  app.post('/api/admin/email-blast/test', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      if (!configured()) return res.status(503).json({ error: 'Email delivery or secure unsubscribe links are not configured.' });
      const draft = validateCampaign(req.body), to = String(req.body.to || '').trim().toLowerCase();
      if (!emailPattern.test(to) || to.length > 254) throw Error('Enter a valid test email address.');
      const result = await sendEmail({ to, subject: '[Test] ' + draft.subject, html: html(draft, to), idempotencyKey: 'campaign-test-' + randomUUID() });
      res.status(result.sent ? 200 : 502).json(result);
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  app.post('/api/admin/email-blast', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (busy) return res.status(409).json({ error: 'Another campaign is sending. Wait for it to finish and review again.' });
    try {
      if (!configured()) return res.status(503).json({ error: 'Email delivery or secure unsubscribe links are not configured.' });
      const draft = validateCampaign(req.body);
      prune();
      const review = reviews.get(req.body.draftId);
      if (!review || req.body.confirmed !== true || req.body.consentConfirmed !== true || JSON.stringify(review.draft) !== JSON.stringify(draft))
        return res.status(409).json({ error: 'Review this exact email and confirm recipient permission before sending.' });
      // Consume before any asynchronous work. No retries after uncertain sends.
      reviews.delete(req.body.draftId);
      busy = true;
      const recipients = campaignRecipients(await rows(), draft.category);
      if (JSON.stringify(recipients) !== JSON.stringify(review.recipients))
        return res.status(409).json({ error: 'The recipient list changed. Preview and confirm again.' });
      if (!recipients.length) return res.status(400).json({ error: 'No recipients match.' });
      let sent = 0;
      const errors = [];
      for (const [i, email] of recipients.entries()) {
        if (!campaignRecipients(await rows(), draft.category).includes(email)) {
          errors.push('A recipient unsubscribed after review and was skipped.'); continue;
        }
        const result = await sendEmail({
          to: email, subject: draft.subject, html: html(draft, email),
          idempotencyKey: `campaign-${req.body.draftId}-${i}`,
        });
        if (result.sent) sent++; else errors.push(result.error || 'Email provider did not accept a message.');
        if (errors.length >= 5 && sent === 0) break;
      }
      res.json({ sent, total: recipients.length, errors: errors.slice(0, 10) });
    } catch (e) { res.status(400).json({ error: e.message }); }
    finally { busy = false; }
  });
  // GET only displays a confirmation: email security scanners must not opt out users.
  app.get('/email/unsubscribe', (req, res) => {
    const email = verifyUnsubscribe(req.query.token, getSecret());
    res.set('Cache-Control', 'no-store');
    if (!email) return res.status(400).send('This unsubscribe link is invalid.');
    res.type('html').send(`<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email preferences</title><body style="background:#10131b;color:#e8ded3;font:16px Arial,sans-serif;text-align:center;padding:60px 24px"><img src="/img/newlogo.png" alt="Samedi Et Dimanche" width="85"><h1 style="font-weight:400">Email preferences</h1><p>Stop receiving marketing campaigns from Samedi Et Dimanche.</p><p>Order and shipping emails are unaffected.</p><form method="post"><input type="hidden" name="token" value="${req.query.token}"><button style="padding:16px 24px">Unsubscribe from marketing emails</button></form></body></html>`);
  });
  app.post('/email/unsubscribe', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const email = verifyUnsubscribe(req.body?.token, getSecret());
    if (!email) return res.status(400).send('This unsubscribe link is invalid.');
    try {
      await unsubscribeMarketing(email);
      res.type('html').send('<!doctype html><html><title>Unsubscribed</title><body style="background:#10131b;color:#e8ded3;font:16px Arial,sans-serif;text-align:center;padding:60px 24px"><h1>You are unsubscribed.</h1><p>You will no longer receive marketing campaigns. Order and shipping emails are unaffected.</p></body></html>');
    } catch { res.status(503).send('Your preference could not be saved. Please try this link again shortly.'); }
  });
}
