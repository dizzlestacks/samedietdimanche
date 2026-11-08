import { ReplitConnectors } from '@replit/connectors-sdk';
import { readFile } from 'node:fs/promises';
// Explicit transport selection: never retry an uncertain send through another transport.
// Direct API-key support remains for hosting outside Replit.
const connectors = new ReplitConnectors();
let logoContent;
async function brandLogoAttachment() {
  logoContent ||= await readFile(new URL('../img/email/brand-logo.png', import.meta.url), 'base64');
  return {filename:'samedi-et-dimanche.png',content:logoContent,content_type:'image/png',content_id:'sd-brand-logo'};
}

export function isEmailConfigured(env = process.env) {
  return Boolean(env.EMAIL_FROM?.trim() &&
    (env.RESEND_USE_CONNECTOR === 'true' || env.RESEND_API_KEY));
}

export async function sendEmail({ to, subject, html, idempotencyKey }, {
  env = process.env, directFetch = fetch,
  proxy = (path, options) => connectors.proxy('resend', path, options),
} = {}) {
  if (!isEmailConfigured(env)) {
    return { sent: false, error: 'Email requires a Resend connection or API key and a verified EMAIL_FROM address.' };
  }
  try {
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM.trim(), to: Array.isArray(to) ? to : [to], subject, html,
        ...(env.EMAIL_REPLY_TO?.trim() ? {reply_to: env.EMAIL_REPLY_TO.trim()} : {}),
        ...(html.includes('cid:sd-brand-logo') ? {attachments:[await brandLogoAttachment()]} : {}),
      }),
      signal: AbortSignal.timeout(15000),
    };
    const res = env.RESEND_USE_CONNECTOR === 'true'
      ? await proxy('/emails', options)
      : await directFetch('https://api.resend.com/emails', {
        ...options, headers: {...options.headers, Authorization: `Bearer ${env.RESEND_API_KEY}`},
      });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { sent: false, error: (data && data.message) || `Email API error (${res.status})` };
    }
    if (!data.id) return { sent:false, error:'Email acceptance was not confirmed. Review delivery before retrying.' };
    return { sent: true, id: data.id };
  } catch (e) {
    return { sent: false, error: 'Email service could not confirm acceptance. Review delivery before retrying.' };
  }
}

export { brandTemplate } from './emailBrandTemplate.js';
