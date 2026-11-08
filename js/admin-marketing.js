/* Update44. One owner for campaign actions; saving settings never sends mail. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fields = $('campaign-fields'), themes = $('campaign-themes'), preview = $('campaign-preview');
  const send = $('blast-send-btn'), previewButton = $('blast-preview-btn'), testButton = $('campaign-test-send');
  let themeList = [], selectedTheme = '', ready = false, loading = false, busy = false;
  let revision = 0, reviewedPreview = null, expiryTimer, configured = false, dirty = false;
  let announcements = [];
  let themeLoad = null;
  const fieldMap = { subject:'blast-subject', message:'blast-message', category:'blast-category', ctaText:'blast-cta-text', ctaPath:'blast-cta-path' };
  const draft = () => ({ theme:selectedTheme, ...Object.fromEntries(Object.entries(fieldMap).map(([key,id]) => [key,$(id).value.trim()])) });
  function status(message, error = false) { $('blast-status').textContent = message; $('blast-status').classList.toggle('is-error', error); }
  async function request(path, body) {
    const res = await fetch(path, { method:body ? 'POST' : 'GET', credentials:'include', cache:'no-store', ...(body ? { headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) } : {}) });
    const data = await res.json().catch(() => { throw Error('The server response could not be read. Check the result before trying again.'); });
    if (!res.ok) throw Error(data.error || 'Request failed (' + res.status + ').');
    return data;
  }
  function updateButtons() {
    const fresh = reviewedPreview && reviewedPreview.revision === revision && Date.now() < reviewedPreview.expires;
    fields.disabled = busy;
    previewButton.disabled = busy || !ready;
    testButton.disabled = busy || !ready || !configured;
    $('campaign-test-email').disabled = busy;
    $('campaign-reviewed').disabled = busy || !fresh;
    $('campaign-consent').disabled = busy;
    send.disabled = busy || !fresh || !configured || !reviewedPreview.total || !$('campaign-reviewed').checked || !$('campaign-consent').checked;
  }
  function invalidate() {
    revision++;
    reviewedPreview = null;
    clearTimeout(expiryTimer);
    $('campaign-reviewed').checked = false;
    $('campaign-consent').checked = false;
    preview.hidden = true;
    preview.removeAttribute('srcdoc');
    $('campaign-empty').hidden = false;
    $('campaign-preview-summary').textContent = 'No current preview. Generate a fresh preview to review the email and recipient count.';
    updateButtons();
  }
  function validate() {
    const value = draft();
    if (!value.theme || !value.subject || !value.message) throw Error('Choose a theme, and enter a subject and message.');
    if (Boolean(value.ctaText) !== Boolean(value.ctaPath)) throw Error('Enter both button label and destination, or leave both empty.');
    if (value.ctaPath && (!/^\/(?!\/)/.test(value.ctaPath) || /[\\\r\n?#]/.test(value.ctaPath))) throw Error('Use a public same-site path such as /watches.html, without query parameters or private access tokens.');
    return value;
  }
  function loadThemes() {
    if (ready) return Promise.resolve();
    if (!themeLoad) themeLoad = fetchThemes().finally(() => { themeLoad = null; });
    return themeLoad;
  }
  async function fetchThemes() {
    if (loading || ready) return;
    loading = true; $('campaign-theme-retry').hidden = true;
    $('campaign-theme-status').textContent = 'Loading approved compositions…';
    try {
      const data = await request('/api/admin/email-themes');
      if (!Array.isArray(data.themes) || !data.themes.length) throw Error('No email themes are available. Reload to try again.');
      themeList = data.themes; themes.textContent = '';
      themeList.forEach((theme, index) => {
        const label = document.createElement('label'); label.className = 'campaign-theme';
        const input = document.createElement('input'); input.type = 'radio'; input.name = 'campaign-theme'; input.value = theme.id;
        input.checked = selectedTheme ? selectedTheme === theme.id : index === 0;
        if (input.checked) selectedTheme = theme.id;
        input.addEventListener('change', () => { selectedTheme = theme.id; });
        const text = document.createElement('span'), title = document.createElement('strong'), detail = document.createElement('small');
        title.textContent = String(index + 1).padStart(2, '0') + ' / ' + theme.name;
        detail.textContent = theme.description; text.append(title,detail); label.append(input,text); themes.appendChild(label);
      });
      ready = true; $('campaign-theme-status').textContent = themeList.length + ' approved compositions. Product images are studio visualizations, not availability claims.';
    } catch (error) {
      themes.textContent = ''; $('campaign-theme-status').textContent = error.message; $('campaign-theme-retry').hidden = false;
    } finally { loading = false; updateButtons(); }
  }
  window.initCampaignComposer = function () { loadThemes(); };
  $('campaign-theme-retry').addEventListener('click', loadThemes);
  fields.addEventListener('input', () => { dirty = true; invalidate(); status('Draft changed. Review a fresh preview before sending.'); });
  // Radio change follows input in browsers; update the selected ID before invalidation too.
  fields.addEventListener('change', event => {
    if (event.target.name === 'campaign-theme') selectedTheme = event.target.value;
    dirty = true; invalidate();
  });
  $('campaign-reviewed').addEventListener('change', updateButtons);
  $('campaign-consent').addEventListener('change', updateButtons);
  previewButton.addEventListener('click', async () => {
    if (busy) return;
    let value;
    try { value = validate(); } catch (error) { status(error.message, true); return; }
    invalidate(); const currentRevision = revision; busy = true; updateButtons();
    previewButton.textContent = 'Preparing preview…'; status('Preparing email and counting eligible recipients. No email is being sent.');
    try {
      const data = await request('/api/admin/email-blast/preview', value);
      if (revision !== currentRevision) return;
      if (typeof data.html !== 'string' || !Number.isInteger(data.total) || data.total < 0 || !data.draftId) throw Error('Preview response is incomplete. Generate a new preview.');
      configured = data.configured === true;
      reviewedPreview = { revision, total:data.total, draftId:data.draftId, value, expires:Date.now() + 10 * 60 * 1000 };
      preview.srcdoc = data.html; preview.hidden = false; $('campaign-empty').hidden = true;
      $('campaign-preview-summary').textContent = data.total + ' eligible recipient' + (data.total === 1 ? '' : 's') + ' · ' + value.category + ' · This review expires in 10 minutes. Recheck before sending.';
      $('blast-config-note').textContent = configured ? 'Email delivery is configured. A preview has not sent anything.' : 'Email delivery is not configured. Preview works; campaign and test sending are disabled.';
      status(data.total ? 'Preview ready. Inspect the full email, then confirm your review and recipient permission.' : 'No eligible recipients. No campaign can be sent.');
      expiryTimer = setTimeout(() => { invalidate(); status('Preview expired. Generate a fresh preview before sending.'); }, 10 * 60 * 1000);
    } catch (error) { status(error.message, true); }
    finally { busy = false; previewButton.textContent = 'Generate preview & recipient count'; updateButtons(); }
  });
  send.addEventListener('click', async () => {
    if (busy || send.disabled || !reviewedPreview) return;
    if (Date.now() >= reviewedPreview.expires) { invalidate(); status('Preview expired. Generate a new preview.', true); return; }
    const snapshot = reviewedPreview;
    if (!window.confirm('Send "' + snapshot.value.subject + '" to ' + snapshot.total + ' eligible ' + snapshot.value.category + ' recipient(s) now? This cannot be undone.')) return;
    busy = true; updateButtons(); status('Sending campaign once. Please keep this tab open. Do not retry while sending.');
    // Consume locally before the request. Even a lost response cannot enable an accidental resend.
    reviewedPreview = null; clearTimeout(expiryTimer);
    try {
      const data = await request('/api/admin/email-blast', { ...snapshot.value, draftId:snapshot.draftId, confirmed:true, consentConfirmed:true });
      const errors = Array.isArray(data.errors) ? data.errors.map(item => typeof item === 'string' ? item : [item.email || item.to, item.error || item.message || 'Delivery failed'].filter(Boolean).join(': ')) : data.errors ? [String(data.errors)] : [];
      const partial = data.sent < data.total || errors.length > 0;
      status('Accepted by email provider: ' + data.sent + ' of ' + data.total + '. ' + (partial ? 'Some messages were not sent. No automatic retries were made.' : 'Campaign submission complete. Inbox delivery is not guaranteed.') + (errors.length ? '\n' + errors.join('\n') : ''), partial);
    } catch (error) {
      status('Campaign result could not be confirmed: ' + error.message + '\nSome recipients may already have received it. Do not immediately resend; verify the delivery result first. No automatic retry was made.', true);
    } finally {
      busy = false; $('campaign-reviewed').checked = false; $('campaign-consent').checked = false;
      $('campaign-preview-summary').textContent = 'This send review has been consumed. Sending again requires a new preview and confirmation.';
      updateButtons();
    }
  });
  testButton.addEventListener('click', async () => {
    if (busy || testButton.disabled) return;
    let value;
    try {
      value = validate();
      const address = $('campaign-test-email');
      if (!address.value.trim() || !address.checkValidity()) throw Error('Enter your own valid email address for the test.');
    } catch (error) { status(error.message, true); return; }
    const to = $('campaign-test-email').value.trim();
    if (!window.confirm('Send one test email to ' + to + '? The waitlist will not be emailed.')) return;
    busy = true; updateButtons(); status('Sending one test email…');
    try {
      const data = await request('/api/admin/email-blast/test', { ...value, to });
      if (!data.sent) throw Error(data.error || 'Test was not sent.');
      status('Test accepted by the email provider for ' + to + '. Waitlist recipients were not emailed.');
    } catch (error) { status('Test result: ' + error.message + ' No automatic retry was made.', true); }
    finally { busy = false; updateButtons(); }
  });
  window.offerWatchAnnouncements = function (items) {
    if (!Array.isArray(items) || !items.length) return;
    announcements = items.filter(item => item && item.id && item.title && item.subject && item.message);
    if (!announcements.length) return;
    const options = $('announcement-options'); options.textContent = '';
    announcements.forEach((item,index) => {
      const label = document.createElement('label'); label.className = 'announcement-option';
      const radio = document.createElement('input'); radio.type = 'radio'; radio.name = 'announcement-choice'; radio.value = String(index); radio.checked = index === 0;
      label.append(radio,document.createTextNode(item.title)); options.appendChild(label);
    });
    $('announcement-tray').hidden = false;
    $('announcement-tray').setAttribute('tabindex', '-1');
    $('announcement-tray').scrollIntoView({ behavior:'smooth', block:'start' });
    $('announcement-tray').focus({ preventScroll:true });
  };
  $('announcement-dismiss').addEventListener('click', () => { $('announcement-tray').hidden = true; announcements = []; });
  $('announcement-review').addEventListener('click', async () => {
    if (busy) { status('Wait for the current campaign action before replacing a draft.', true); return; }
    const choice = document.querySelector('input[name="announcement-choice"]:checked');
    if (!choice) return;
    const item = announcements[Number(choice.value)];
    if (!item) return;
    if ((dirty || $('blast-subject').value || $('blast-message').value) && !window.confirm('Replace the current email draft with this saved-setting suggestion? Your unsent changes will be lost.')) return;
    await writeFromSettings(item.id);
  });
  function applySuggestedDraft(item) {
    if (!item || !item.subject || !item.message || !themeList.some(theme => theme.id === item.theme))
      throw Error('The current watch draft could not be prepared. Your existing draft has not changed.');
    selectedTheme = item.theme;
    themes.querySelectorAll('input').forEach(input => { input.checked = input.value === selectedTheme; });
    Object.entries(fieldMap).forEach(([key,id]) => { $(id).value = item[key] || (key === 'category' ? 'watches' : ''); });
    dirty = true; invalidate(); $('announcement-tray').hidden = true;
    status('Title and body written from current saved watch settings. Review and edit them before sending. Private invitations remain separate; nothing has been sent.');
    $('campaign-composer').scrollIntoView({ behavior:'smooth', block:'start' }); $('blast-subject').focus({preventScroll:true});
  }
  async function writeFromSettings(focus = '') {
    if (busy) return;
    busy = true; updateButtons();
    try {
      await loadThemes();
      if (!ready) throw Error('Load the email themes before generating a draft.');
      const data = await request('/api/admin/watch-announcement' + (focus ? '?focus=' + encodeURIComponent(focus) : ''));
      activateTab('marketing');
      applySuggestedDraft(data.draft);
    } catch (error) {
      activateTab('marketing');
      status(error.message, true);
    } finally { busy = false; updateButtons(); }
  }
  $('campaign-write-settings').addEventListener('click', async () => {
    if (busy) return;
    if ((dirty || $('blast-subject').value || $('blast-message').value) && !window.confirm('Replace the current title and body with a draft based on saved watch settings? Your unsent changes will be lost.')) return;
    await writeFromSettings();
  });
  updateButtons();
})();
