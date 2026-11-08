import { createHmac, timingSafeEqual } from 'node:crypto';

// Referral codes are public. Purchase access uses a separate, expiring signature.
export function createEarlyToken(code, secret = process.env.SESSION_SECRET, now = Date.now()) {
  if (!secret) return null;
  const payload = Buffer.from(JSON.stringify({ code, expires: now + 7 * 86400000 })).toString('base64url');
  return payload + '.' + createHmac('sha256', secret).update(payload).digest('base64url');
}
export function verifyEarlyToken(token, secret = process.env.SESSION_SECRET, now = Date.now()) {
  if (!secret || typeof token !== 'string' || token.length > 512) return null;
  const [payload, sig, extra] = token.split('.');
  if (!payload || !sig || extra) return null;
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return typeof data.code === 'string' && data.expires > now ? data : null;
  } catch { return null; }
}
export function accessSettings(getSettings, findByRefCode) {
  return async function (req) {
    const settings = await getSettings();
    if (!req || settings.watchesMode === 'preorder' || !settings.earlyAccessEnabled || settings.watchPreviewEnabled === true) return settings;
    const token = req.headers?.['x-watch-access'] || (req.headers?.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('sd_early='))?.slice(9);
    const access = verifyEarlyToken(token);
    if (!access) return settings;
    const entry = await findByRefCode(access.code);
    if (!entry || entry.category !== 'watches') return settings;
    return { ...settings, watchesMode: 'shop', earlyAccessActive: true };
  };
}
