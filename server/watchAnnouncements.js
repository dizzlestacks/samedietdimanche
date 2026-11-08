// Copy is assembled from effective public states, not independent checkbox text.
// A preview overrides shop mode; countdown/signup are hidden in public shop mode.
function watchState(s, now) {
  const preview = s.watchPreviewEnabled === true;
  const publicPreorder = s.watchesMode === 'preorder' && !preview;
  const shop = (s.watchesMode === 'shop' || publicPreorder) && !preview;
  return {
    preview, shop, publicPreorder,
    signup: preview || (!shop && s.watchesWaitlistEnabled !== false),
    countdown: !shop && s.countdownEnabled !== false && Number.isFinite(Date.parse(s.dropDate)) && Date.parse(s.dropDate) > now,
    early: s.earlyAccessEnabled === true && !shop && !preview,
    preorder: s.preorderWatchesEnabled === true || publicPreorder,
  };
}

export function buildWatchAnnouncement(settings, { focus = '', now = Date.now() } = {}) {
  const state = watchState(settings, now);
  let subject, theme, ctaText = 'Explore watches';
  const paragraphs = [];
  if (state.preview) {
    subject = state.countdown ? 'A first look, with the watch countdown live' : 'Your first look at the watch collection';
    theme = 'the-object';
    paragraphs.push('Discover the watches, save your favourites and create your own combination. In the public preview, prices are hidden and checkout is unavailable.');
  } else if (state.publicPreorder) {
    subject = 'Watch preorders are open';
    theme = 'the-object';
    paragraphs.push('Explore the watch collection with prices visible and preorder your choice. This is not an immediate-shipping purchase.');
  } else if (state.shop) {
    subject = 'Discover the watch collection';
    theme = 'collection-edit';
    paragraphs.push('The watch collection is open to browse, with prices visible. Explore the original combinations or customise a watch to make it your own.');
  } else {
    subject = state.signup ? 'Join the watch waitlist' : 'A watch update from Samedi Et Dimanche';
    theme = 'midnight-signature';
    ctaText = state.signup ? 'Join the watch waitlist' : 'Visit the watch page';
    paragraphs.push('The public watch page is in waitlist mode; the public collection is not open for shopping.');
  }
  if (state.signup)
    paragraphs.push('Watch waitlist signup is open. Join the list on the watch page to stay connected with the collection.');
  else if (!state.shop)
    paragraphs.push('New watch waitlist signups are currently closed.');

  if (state.countdown)
    paragraphs.push(`Follow the live countdown on the watch page to ${new Date(settings.dropDate).toUTCString()}. This is the countdown target; checkout does not open automatically when it ends.`);

  if (state.early)
    paragraphs.push('Members with a valid personal early-access link can browse the collection privately. Use your personal invitation if you have one. This announcement does not grant private access.');

  if (state.preorder) {
    paragraphs.push(state.publicPreorder ? 'Watch preorders are open to everyone. Full payment is required upfront through PayPal, with delivery in the stated shipping timeframe.' : 'Private watch preorders are available through a valid preorder invitation. Invitations are sent separately; this public page link does not grant preorder access. Full payment is required upfront through PayPal.');
    if (settings.preorderFulfillmentNote)
      paragraphs.push('Preorder shipping estimate: ' + settings.preorderFulfillmentNote);
  }

  const focusTitles = {
    'watch-shop': [state.shop, 'The watch collection is open', 'collection-edit'],
    'watch-preview': [state.preview, subject, 'the-object'],
    'watch-waitlist': [state.signup, state.preview ? 'Explore the preview and join the watch waitlist' : 'The watch waitlist is open', 'midnight-signature'],
    'watch-countdown': [state.countdown, 'The watch countdown is live' + (state.preview ? ' — explore the preview' : ''), 'the-reveal'],
    'watch-early-access': [state.early, 'Private watch access is available', 'burgundy-invitation'],
    'watch-preorder': [state.preorder, state.publicPreorder ? 'Watch preorders are open' : 'Private watch preorders are available', 'burgundy-invitation'],
  };
  const focused = focusTitles[focus];
  if (focused?.[0]) { subject = focused[1]; theme = focused[2]; }
  return { id: focused?.[0] ? focus : 'watch-status', title: subject, subject, theme,
    message: paragraphs.join('\n\n'), category: 'watches', ctaText, ctaPath: '/watches.html' };
}

// Suggestions reflect saved transitions. Every draft includes the whole current
// combination, so enabling a countdown never loses preview/preorder restrictions.
export function watchAnnouncements(before, after, now = Date.now()) {
  const drafts = [];
  const previous = watchState(before, now), current = watchState(after, now);
  for (const [key, id] of Object.entries({shop:'watch-shop',preview:'watch-preview',signup:'watch-waitlist',countdown:'watch-countdown',early:'watch-early-access',preorder:'watch-preorder'})) {
    if (current[key] && (!previous[key] || (key === 'countdown' && after.dropDate !== before.dropDate)))
      drafts.push(buildWatchAnnouncement(after, { focus: id, now }));
  }
  // An empty women's section is not a product launch. Administrative counters,
  // tax changes, disabled features and cosmetic text edits are not announcements.
  return drafts;
}
