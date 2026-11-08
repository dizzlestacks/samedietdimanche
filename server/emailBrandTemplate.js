// Shared transactional shell. bodyHtml is trusted, caller-owned email markup.
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

function safeDestination(value) {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value.trim()) || /[\u0000-\u0020\u007f\\]/.test(value.trim())) return '';
  try {
    const url = new URL(value.trim());
    return /^https?:$/.test(url.protocol) && url.hostname ? escapeHtml(url.href) : '';
  } catch {
    return '';
  }
}

export function brandTemplate({ heading, bodyHtml, ctaText, ctaUrl, baseUrl } = {}) {
  // Retained for API compatibility; the logo is always supplied as an attachment.
  void baseUrl;
  const destination = safeDestination(ctaUrl);
  const font = "Montserrat, Arial, sans-serif";
  const cta = destination && String(ctaText ?? '').trim()
    ? `<tr><td class="content-pad" style="padding:6px 32px 28px;font-family:${font};">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width:100%;border-collapse:collapse;table-layout:fixed;">
      <tr><td align="center" bgcolor="#dfbea3" style="background-color:#dfbea3;background-image:linear-gradient(#dfbea3,#dfbea3);border:1px solid #dfbea3;mso-padding-alt:15px 20px;">
      <a href="${destination}" style="display:block;padding:15px 20px;color:#281b23;font-family:${font};font-size:12px;font-weight:500;line-height:20px;letter-spacing:1px;text-decoration:none;text-align:center;overflow-wrap:anywhere;word-wrap:break-word;">${escapeHtml(ctaText)}</a>
      </td></tr></table>
    </td></tr>`
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(heading)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500&amp;display=swap">
<style>
  :root { color-scheme:dark; supported-color-schemes:dark; }
  body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
  .email-copy p { margin:0 0 16px; }
  .email-copy p:last-child { margin-bottom:0; }
  .email-copy a { color:#dfbea3; text-decoration:underline; }
  .email-copy img { max-width:100%; height:auto; }
  @media only screen and (max-width:480px) {
    .outer-pad { padding:12px 8px !important; }
    .content-pad { padding-left:20px !important; padding-right:20px !important; }
    .email-heading { font-size:16px !important; line-height:28px !important; }
  }
  @media (prefers-color-scheme:dark) {
    .email-surround { background-color:#17121a !important; }
    .email-card { background-color:#19151e !important; }
    .email-header { background-color:#301e29 !important; }
    .email-heading { color:#f0ece4 !important; }
    .email-copy { color:#d7cdd1 !important; }
  }
</style>
</head>
<body class="email-surround" bgcolor="#17121a" style="margin:0;padding:0;width:100%;background-color:#17121a;background-image:linear-gradient(#17121a,#17121a);color:#f0ece4;font-family:${font};">
<!-- Solid gradients and explicit colors are progressive safeguards, not a guarantee against client-side color inversion. -->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-surround" bgcolor="#17121a" style="width:100%;border-collapse:collapse;background-color:#17121a;background-image:linear-gradient(#17121a,#17121a);">
<tr><td align="center" class="outer-pad" style="padding:24px 12px;">
<!--[if mso]><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="560" align="center"><tr><td><![endif]-->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" align="center" class="email-card" bgcolor="#19151e" style="width:100%;max-width:560px;border-collapse:collapse;table-layout:fixed;border:1px solid #59414b;background-color:#19151e;background-image:linear-gradient(#19151e,#19151e);">
<tr><td align="center" class="email-header content-pad" bgcolor="#301e29" style="padding:26px 32px 22px;background-color:#301e29;background-image:linear-gradient(#301e29,#301e29);border-bottom:1px solid #59414b;font-family:${font};">
<img src="cid:sd-brand-logo" alt="Samedi Et Dimanche" width="116" style="display:block;width:116px;max-width:100%;height:auto;margin:0 auto;border:0;color:#f0ece4;font-family:${font};font-size:12px;">
<p style="margin:16px 0 0;color:#dfbea3;font-family:${font};font-size:9px;font-weight:300;line-height:18px;letter-spacing:2.5px;text-transform:uppercase;">Where the week ends</p>
</td></tr>
<tr><td class="content-pad" style="padding:28px 32px 12px;font-family:${font};">
<h1 class="email-heading" style="margin:0;color:#f0ece4;font-family:${font};font-size:17px;font-weight:300;line-height:29px;letter-spacing:3px;text-transform:uppercase;text-align:center;overflow-wrap:anywhere;word-wrap:break-word;">${escapeHtml(heading)}</h1>
</td></tr>
<tr><td class="content-pad" style="padding:0 32px 24px;font-family:${font};">
<div class="email-copy" style="color:#d7cdd1;font-family:${font};font-size:14px;font-weight:400;line-height:24px;text-align:center;overflow-wrap:anywhere;word-wrap:break-word;">${bodyHtml ?? ''}</div>
</td></tr>
${cta}
<tr><td align="center" class="content-pad" style="padding:20px 32px 22px;border-top:1px solid #59414b;color:#c7aba1;font-family:${font};">
<p style="margin:0;color:#c7aba1;font-family:${font};font-size:9px;font-weight:300;line-height:18px;letter-spacing:2px;">&copy; ${new Date().getFullYear()} SAMEDI ET DIMANCHE</p>
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body>
</html>`;
}
