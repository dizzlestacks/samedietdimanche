// Campaign-only renderer. Existing transactional templates intentionally stay untouched.
export const EMAIL_THEMES = Object.freeze([
  { id: 'midnight-signature', name: 'Midnight Signature', description: 'Logo-led, spacious single announcement.' },
   { id: 'burgundy-invitation', name: 'Burgundy Invitation', description: 'An inset correspondence card in the house ink palette.' },
  { id: 'the-object', name: 'The Object', description: 'Image-first black-on-black watch study.' },
  { id: 'collection-edit', name: 'Collection Edit', description: 'Three authentic watch pairings, side by side.' },
  { id: 'after-hours', name: 'After Hours', description: 'Asymmetric evening editorial; the complete watch silhouette.' },
  { id: 'letter-from-the-house', name: 'A Letter from the House', description: 'Warm ivory paper and long-form correspondence.' },
  { id: 'weekend-journal', name: 'Weekend Journal', description: 'Numbered chapters: the object, then the house note.' },
  { id: 'the-reveal', name: 'The Reveal', description: 'Large typographic statement followed by a red watch strip.' },
  { id: 'your-configuration', name: 'Your Configuration', description: 'Illustrative black pairing summary, explicitly not an order.' },
  { id: 'floral-signature', name: 'Floral Signature', description: 'Intact original floral artwork beside your message.' },
]);

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const table = (content, style = '', attrs = '') => `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;${style}" ${attrs}>${content}</table>`;
const row = (content, style = '') => `<tr><td style="${style}">${content}</td></tr>`;

export function renderCampaign({ theme = 'midnight-signature', subject = '', message = '', ctaText = '', ctaPath = '', baseUrl, unsubscribeUrl = '' } = {}) {
  if (!EMAIL_THEMES.some(item => item.id === theme)) throw new Error('Unknown email theme');
  const base = new URL(baseUrl);
  if (!/^https?:$/.test(base.protocol)) throw new Error('Invalid email base URL');
  const asset = path => escape(new URL(path, base.origin).href);
  const homepage = asset('/');
  const watchTheme = ['the-object', 'collection-edit', 'after-hours', 'weekend-journal', 'the-reveal', 'your-configuration'].includes(theme);
  // Defaults apply only when neither CTA field was supplied; explicit overrides
  // retain their existing validation and conditional rendering behavior.
  if (!ctaPath && !ctaText) {
    ctaPath = watchTheme ? '/watches.html' : '/';
    ctaText = watchTheme ? 'Explore the watches' : 'Visit the house';
  }
  // Backend also validates CTA allowlists. Defense in depth protects standalone renderer callers.
  let destination = '';
  if (ctaPath) {
    if (!/^\/(?!\/)/.test(ctaPath) || /[\\\r\n]/.test(ctaPath)) throw new Error('CTA must be a same-site path');
    const url = new URL(ctaPath, base.origin);
    if (url.origin !== base.origin) throw new Error('CTA must be same-site');
    destination = escape(url.href);
  }
  let unsubscribe = '';
  if (unsubscribeUrl) {
    const url = new URL(unsubscribeUrl, base.origin);
    if (!/^https?:$/.test(url.protocol)) throw new Error('Invalid unsubscribe URL');
    unsubscribe = `<br><a href="${escape(url.href)}" style="color:inherit;text-decoration:underline">Unsubscribe</a>`;
  }
  const light = theme === 'letter-from-the-house';
  // Flat, email-safe counterparts of the live site palettes:
  // index/shop: waitlist.css + shop-brand.css; watches: watch-customizer.css.
  // clothing's index.css pink gradients are intentionally not carried into email.
  const houseInk = '#07090d', chromeInk = '#0b0f12', watchInk = '#1b0e14';
  const bg = light ? '#f0ece4' : watchTheme ? watchInk : houseInk;
  const ink = light ? houseInk : '#f0ece4', accent = light ? houseInk : '#e8c4a0';
  const rule = light ? '#b5b0aa' : 'rgba(196,149,106,.25)';
  const panel = chromeInk, watchAccent = '#492331', muted = '#b5b0aa';
  const logo = (width = 82) => `<a href="${homepage}" style="display:block;text-decoration:none"><img src="${asset('/img/newlogo.png')}" width="${width}" alt="SAMEDI ET DIMANCHE" style="display:block;border:0;width:${width}px;max-width:100%;height:auto;margin:0 auto"></a>`;
  const watch = (color = 'black', width = 230) => `<img src="${asset(`/img/email/watch-${color}.png`)}" width="${width}" alt="${color[0].toUpperCase() + color.slice(1)} face / ${color} band — studio visualization" style="display:block;border:0;width:${width}px;max-width:100%;height:auto;margin:0 auto">`;
  const kicker = text => `<p style="margin:0 0 18px;color:${accent};font-size:9px;line-height:1.9;letter-spacing:2px;text-transform:uppercase">${text}</p>`;
  const title = (size = 30) => `<h1 style="margin:0 0 24px;font-size:${size}px;line-height:1.35;font-weight:300;letter-spacing:1px;overflow-wrap:anywhere">${escape(subject)}</h1>`;
  const copy = `<p style="margin:0 0 26px;font-size:13px;line-height:2;overflow-wrap:anywhere">${escape(message).replace(/\r\n|\r|\n/g, '<br>')}</p>`;
  const cta = (full = false) => destination && ctaText ? table(row(`<a href="${destination}" style="display:block;padding:15px 20px;border:1px solid ${accent};color:${accent};font-size:10px;line-height:1.8;letter-spacing:1px;text-decoration:none;text-align:center;overflow-wrap:anywhere">${escape(ctaText)}</a>`), full ? '' : 'width:auto;margin:0 auto;') : '';
  const header = (split = false, label = 'SAMEDI ET DIMANCHE<br>Where the week ends') => split
    ? table(`<tr><td width="30%" style="padding:24px 20px;border-bottom:1px solid ${rule}">${logo(58)}</td><td style="padding:24px 20px;text-align:right;font-size:9px;line-height:2;letter-spacing:1px;color:${accent};border-bottom:1px solid ${rule}">${label}</td></tr>`)
    : table(row(logo(theme === 'midnight-signature' ? 124 : 86) + `<p style="font-size:9px;letter-spacing:2px;color:${accent};line-height:1.9;margin:16px 0 0">${label}</p>`, 'padding:36px 24px;text-align:center;'));
  const caption = (left, right) => table(`<tr><td style="padding:14px 12px;font-size:8px;line-height:1.8;letter-spacing:1px;color:${accent};border-top:1px solid ${rule};border-bottom:1px solid ${rule}">${left}</td><td style="padding:14px 12px;font-size:8px;line-height:1.8;text-align:right;color:${accent};border-top:1px solid ${rule};border-bottom:1px solid ${rule}">${right}</td></tr>`);
  const main = (content, style = '') => table(row(content, `padding:32px 28px;${style}`));
  let body;
  switch (theme) {
    case 'midnight-signature':
      body = header() + main(`<p style="width:38px;border-top:1px solid ${accent};margin:0 auto 30px"></p>${kicker('A note to our waitlist')}${title(32)}${copy}${cta()}<p style="margin:40px 0 0;font-size:9px;letter-spacing:2px;color:${accent}">Where the week ends</p>`, 'text-align:center;padding-top:44px;padding-bottom:54px;');
      break;
    case 'burgundy-invitation':
      body = main(table(row(header(false, 'From the house') + main(`${kicker('House correspondence')}${title()}${copy}${caption('For our waitlist', 'From the house')}<br>${cta()}`, 'text-align:center;')), `border:1px solid ${rule};background:${panel};`));
      break;
    case 'the-object':
      body = header(true) + main(`${kicker('The watch edit')}${title(27)}`, 'text-align:center;padding-bottom:0;') + main(watch('black', 280), `background:${panel};padding:12px 20px;`) + caption('Black / Black', 'Studio visualization') + main(copy + cta(), 'text-align:center;');
      break;
    case 'collection-edit':
      body = header() + main(`${kicker('The collection edit')}${title(28)}${copy}` + table('<tr>' + ['black','red','green'].map(color => `<td width="33.33%" valign="top" style="padding:12px 5px 16px;background:${panel};border-bottom:1px solid ${rule};text-align:center">${watch(color, 150)}<p style="font-size:9px;line-height:1.8;margin:14px 0 0;text-transform:capitalize">${color} / ${color}</p></td>`).join('') + '</tr>') + '<br>' + caption('Face + band pairings', 'Studio visualizations') + '<br>' + cta(), 'text-align:center;');
      break;
    case 'after-hours':
      body = header(true) + main(caption('The evening edit', 'Watches'), 'padding:0 24px;')
        + table(`<tr><td width="46%" valign="middle" style="padding:28px 10px 28px 24px">${kicker('A quieter point of view')}<p style="font-size:47px;line-height:1.13;font-weight:300;letter-spacing:-2px;margin:0 0 24px">After<br>hours.</p><p style="font-size:10px;line-height:1.9;color:${muted}">Less rush.<br>More room to look.</p></td><td width="54%" valign="middle" style="padding:16px 14px 16px 0">${watch('black', 270)}</td></tr>`)
        + main(caption('Black face / Black band', 'Seen in full'), 'padding:0 24px;')
        + main(`${title(24)}${copy}${cta()}`, 'padding:32px 24px 40px;');
      break;
    case 'letter-from-the-house':
      body = main(table(row(logo(86), `padding:18px;background:${houseInk};`), 'width:150px;margin:0 auto;'), 'padding-bottom:0;')
        + main(`${caption('House correspondence', 'A note to our waitlist')}<br>${title(27)}<p style="font-size:13px;line-height:2">To our waitlist,</p>${copy}<p style="font-size:11px;line-height:2;margin:28px 0">With appreciation,<br>SAMEDI ET DIMANCHE</p>${cta()}`);
      break;
    case 'weekend-journal':
      body = header(true, 'Weekend journal<br>House notes') + main(`${kicker('From SAMEDI ET DIMANCHE')}${title(32)}`)
        + table(`<tr><td width="50%" style="padding:16px 8px;background:${panel}">${watch('green',230)}</td><td width="50%" valign="middle" style="padding:22px 16px;background:${panel}">${kicker('01 / The watch')}<h2 style="font-size:23px;font-weight:300;line-height:1.5;margin:0 0 14px">A study<br>in green.</h2><p style="font-size:11px;line-height:2">Green face / green band.<br>Studio visualization.</p></td></tr>`)
        + main(table(`<tr><td width="40" valign="top" style="font-size:10px;padding-top:6px;color:${accent}">02</td><td>${kicker('The house')}${copy}${cta(true)}</td></tr>`));
      break;
    case 'the-reveal':
      body = header(false, 'SAMEDI ET DIMANCHE / Watches') + main(`${kicker('A watch note from the house')}${title(46)}`, 'padding-top:12px;')
        + table(`<tr><td width="40%" style="padding:18px 8px;border-top:1px solid ${rule};border-bottom:1px solid ${rule};background:${watchAccent}">${watch('red',170)}</td><td style="padding:18px 20px;border-top:1px solid ${rule};border-bottom:1px solid ${rule};background:${watchAccent}">${kicker('The red / red pairing')}<p style="font-size:12px;line-height:2">Red face. Red band.<br>Studio visualization.</p></td></tr>`)
        + main(copy + cta(true));
      break;
    case 'your-configuration':
      body = header(true, 'Configuration study<br>Illustrative / not an order') + main(`${kicker('The black / black pairing')}${title(25)}${copy}` + table(`<tr><td width="48%" style="padding:12px;background:${panel}">${watch('black',210)}</td><td style="padding:0 18px">${['Face|Black','Band|Black','Collection|Watches'].map(spec => { const [label,value] = spec.split('|'); return `<p style="margin:0;padding:14px 0;border-bottom:1px solid ${rule};font-size:12px;line-height:1.8"><span style="font-size:8px;letter-spacing:1px;color:${accent}">${label}</span><br>${value}</p>`; }).join('')}</td></tr>`) + `<p style="font-size:10px;line-height:1.9;padding:0 0 0 15px;border-left:1px solid ${accent};margin:24px 0">An illustrative configuration, not a customer record. Nothing has been saved, reserved, or ordered.</p>${cta(true)}`);
      break;
    case 'floral-signature':
      body = table(`<tr><td width="47%" valign="middle" style="padding:28px 12px;background:${houseInk}">${logo(260)}</td><td width="53%" valign="middle" style="padding:42px 20px;background:${panel}">${kicker('A note from the house')}${title(26)}${copy}${cta(true)}</td></tr>`) + main(kicker('Where the week ends'), `text-align:center;border-top:1px solid ${rule};`);
      break;
  }
  const footer = table(row(`<a href="${homepage}" style="color:${accent};text-decoration:none">SAMEDI ET DIMANCHE</a><p style="margin:10px 0 0;font-size:9px;line-height:1.9">Where the week ends${unsubscribe}</p>`, `padding:28px 24px;border-top:1px solid ${rule};text-align:center;font-size:9px;line-height:1.9;letter-spacing:1px;color:${accent};`));
   return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500&amp;display=swap"><title>${escape(subject)}</title></head><body style="margin:0;padding:0;background:${houseInk};font-family:Montserrat,sans-serif;font-weight:300;color:${ink}"><div style="display:none;font-size:1px;line-height:1px;max-height:0;overflow:hidden;mso-hide:all">${escape(subject)}</div><!--[if mso]><table role="presentation" width="600" align="center" border="0" cellpadding="0" cellspacing="0"><tr><td><![endif]-->${table(row(table(row(body + footer)), `padding:0;background:${bg};font-family:Montserrat,sans-serif;font-weight:300;color:${ink};`), 'width:100%;max-width:600px;margin:0 auto;', 'align="center"')}<!--[if mso]></td></tr></table><![endif]--></body></html>`;
}
