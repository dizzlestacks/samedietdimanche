/* Update 39 — selection, server-side review and explicit send. */
(function () {
  'use strict';
  const byId = id => document.getElementById(id);
  if (!byId('invite-form')) return;
  let busy = false, loaded = false, draft = null;
  const fields = byId('invite-fields'), category = byId('invite-category');
  const expiry = byId('invite-expiry'), members = byId('invite-members');
  const confirmation = byId('invite-confirmation');
  const tomorrow = new Date(Date.now() + 86400000);
  expiry.value = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset()*60000).toISOString().slice(0,16);
  function status(text) { byId('invite-status').textContent = text; }
  function invalidate() { draft = null; confirmation.hidden = true; }
  function lock(value) {
    busy = value; fields.disabled = value;
    byId('invite-send').disabled = value;
    byId('invite-cancel').disabled = value;
  }
  async function request(path, body) {
    const response = await fetch(path, {method:body ? 'POST' : 'GET', credentials:'include', cache:'no-store',
      ...(body ? {headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)} : {})});
    const data = await response.json();
    if (!response.ok) throw Error(data.error || 'Request failed.');
    return data;
  }
  async function load() {
    if (busy) return;
    invalidate(); loaded = false; lock(true); members.replaceChildren();
    byId('invite-review').disabled = true; status('Loading eligible recipients…');
    try {
      const payload = await request('/api/admin/waitlist');
      const rows = (payload.data || []).filter(row => row.category === category.value && row.invitation_consent === true);
      const emails = [...new Set(rows.map(row => row.email))].sort();
      for (const email of emails) {
        const label = document.createElement('label'); label.className = 'wp-mode-option';
        const input = document.createElement('input'); input.type = 'checkbox'; input.value = email;
        const text = document.createElement('span'); text.textContent = email;
        label.append(input, text); members.append(label);
      }
      loaded = true; byId('invite-review').disabled = !emails.length;
      status(emails.length ? `${emails.length} eligible members. Select up to 50; none are selected automatically.` : 'No members with recorded signup consent in this category.');
    } catch { status('Could not load recipients. Reload to try again.'); }
    finally { lock(false); }
  }
  byId('preorder-invitations').addEventListener('toggle', function () { if (this.open && !loaded) load(); });
  category.addEventListener('change', load);
  expiry.addEventListener('input', invalidate); members.addEventListener('change', invalidate);
  byId('invite-reload').addEventListener('click', load);
  byId('invite-cancel').addEventListener('click', () => { invalidate(); status('Review cancelled. No invitations sent.'); });
  byId('invite-form').addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return;
    invalidate(); byId('invite-results').replaceChildren();
    const recipients = [...members.querySelectorAll('input:checked')].map(input => input.value);
    const expires = new Date(expiry.value);
    if (!recipients.length || recipients.length > 50 || !Number.isFinite(expires.getTime())) {
      status('Select 1–50 recipients and choose an expiry.'); return;
    }
    lock(true); status('Preparing review. No emails have been sent.');
    try {
      draft = await request('/api/admin/preorder-invitations/preview', {category:category.value, recipients, expiresAt:expires.toISOString()});
      byId('invite-summary').textContent = `${draft.recipients.length} ${draft.category} invitations. Link expires ${new Date(draft.expiresAt).toLocaleString()} (${draft.expiresAt} UTC). Shipping estimate: ${draft.shippingEstimate}. Confirm by ${new Date(draft.reviewUntil).toLocaleString()}.`;
      byId('invite-recipients').replaceChildren();
      for (const email of draft.recipients) {
        const item = document.createElement('li'); item.textContent = email; byId('invite-recipients').append(item);
      }
      confirmation.hidden = false; status('Review the recipients and expiry, then confirm to send.');
    } catch (error) { status(error.message || 'Could not prepare review. No invitations sent.'); }
    finally { lock(false); }
  });
  byId('invite-send').addEventListener('click', async () => {
    if (busy || !draft) return;
    const draftId = draft.draftId; invalidate(); lock(true);
    status('Sending invitations. Keep this page open; do not repeat the send.');
    try {
      const data = await request('/api/admin/preorder-invitations/send', {draftId, confirm:true});
      for (const result of data.results) {
        const item = document.createElement('li');
        item.textContent = `${result.email}: ${result.sent ? 'Accepted by email provider' : result.error}`;
        byId('invite-results').append(item);
      }
      status(`${data.sent} accepted by provider; ${data.failed} failed or unconfirmed. No automatic retries.`);
    } catch (error) {
      status(`Send could not be confirmed. ${error.message || ''} Check the email provider before preparing another invitation.`);
    } finally {
      members.querySelectorAll('input:checked').forEach(input => { input.checked = false; });
      lock(false);
    }
  });
})();
