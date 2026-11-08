/* Update18: one authoritative mode, with an independent price-hidden preview override. */
(function () {
  'use strict';
  function el(id) { return document.getElementById(id); }
  var availabilityRequest=0,timer=null;
  var collection='men',womensEnabled=false;
  function renderCollection(){
    if(!el('wa-collections'))return;
    var allowed=window.sdWatchMode==='shop';
    var hadFocus=el('watch-womens-preview').contains(document.activeElement)||document.activeElement===el('wa-collection-women');
    if(!allowed||!womensEnabled)collection='men';
    document.body.dataset.watchCollection=collection;
    el('wa-collections').hidden=!allowed||!womensEnabled;
    el('watch-womens-preview').hidden=!allowed||!womensEnabled||collection!=='women';
    el('wa-collection-men').setAttribute('aria-pressed',String(collection==='men'));
    el('wa-collection-women').setAttribute('aria-pressed',String(collection==='women'));
    if(hadFocus&&el('watch-womens-preview').hidden){
      var target=allowed&&womensEnabled?el('wa-collection-men'):allowed?el('wa-catalog-title'):el('wa-mode-message');
      if(target){
        if(target!==el('wa-collection-men'))target.setAttribute('tabindex','-1');
        target.focus({preventScroll:true});
      }
    }
  }
  ['men','women'].forEach(function(name){
    var button=el('wa-collection-'+name);
    if(button)button.addEventListener('click',function(){
      if(window.sdWatchMode!=='shop'||!womensEnabled)return;
      collection=name;renderCollection();
      window.dispatchEvent(new CustomEvent('watch:collection',{detail:{collection:collection}}));
      if(name==='men')window.dispatchEvent(new CustomEvent('watch:catalog-visible'));
    });
  });
  ['watch:configure','watch:restore-design'].forEach(function(event){
    window.addEventListener(event,function(){collection='men';renderCollection();});
  });
  var waitlistHome=document.createComment('Watch waitlist position');
  if(el('watch-waitlist'))el('watch-waitlist').before(waitlistHome);
  var earlyParam = new URLSearchParams(window.location.search).get('early');
  var earlyReady = earlyParam ? fetch('/api/early-access/' + encodeURIComponent(earlyParam), {credentials:'include',cache:'no-store'})
    .then(function(r){if(!r.ok)throw new Error('Access unavailable');return r.json();})
    .then(function(result){
      if (!result.valid) {
        var notice=document.createElement('p');notice.className='wa-notice';notice.setAttribute('role','status');
        notice.textContent='This early-access link is expired or unavailable. Join the waitlist again to request a new link. Preview mode does not allow purchases.';
        var section=el('watch-waitlist');if(section)section.prepend(notice);
      }
      if(result.valid&&window.SharedCart)window.SharedCart.refresh();
      history.replaceState(null,'',window.location.pathname+window.location.hash);
    }).catch(function(){
      var notice=document.createElement('p');notice.className='wa-notice';notice.textContent='Early access could not be checked. Please reload to retry.';
      if(el('watch-waitlist'))el('watch-waitlist').prepend(notice);
    }) : Promise.resolve();
  window.sdWatchMode='loading';
  function setMode(mode,settings){
    window.sdWatchPreviewEnabled=!!(settings&&settings.watchPreviewEnabled===true);
    if(window.sdWatchPreviewEnabled)mode='shop';
    var previous=window.sdWatchMode;window.sdWatchMode=mode;
    womensEnabled=!!settings&&settings.womensWatchEnabled!==false;
    renderCollection();
    if(el('watch-catalog')&&(mode!=='shop'||previous!=='shop'))el('watch-catalog').hidden=mode!=='shop';
    if(el('watch-customizer')&&mode!=='shop')el('watch-customizer').hidden=true;
    var launchPreview=window.sdWatchPreviewEnabled;
    var showLaunch=mode==='waitlist'||launchPreview;
    document.body.classList.toggle('watch-launch-preview',launchPreview&&showLaunch);
    if(el('watch-waitlist')){
      el('watch-waitlist').hidden=!showLaunch;
      if(launchPreview&&showLaunch&&el('watch-catalog'))el('watch-catalog').before(el('watch-waitlist'));
      else waitlistHome.after(el('watch-waitlist'));
    }
    var form=el('waitlist-form');
    if(form&&form.style)form.style.display=showLaunch&&(launchPreview||settings.watchesWaitlistEnabled!==false)?'':'none';
    if(el('wa-device-notices')&&mode!=='shop')el('wa-device-notices').hidden=true;
    if(el('wa-mode-status'))el('wa-mode-status').hidden=mode==='shop'||mode==='waitlist';
    if(el('wa-mode-message'))el('wa-mode-message').textContent=mode==='loading'?'Loading watch availability…':'Watch availability could not be confirmed. Please retry. Your cart is still available.';
    if(el('wa-mode-retry'))el('wa-mode-retry').hidden=mode!=='error';
    if(timer){clearInterval(timer);timer=null;}
    if(showLaunch)applyCopy(settings);
    if(window.dispatchEvent&&typeof CustomEvent==='function'){
      window.dispatchEvent(new CustomEvent('watch:mode',{detail:{mode:mode,settings:settings}}));
      if(mode==='shop')window.dispatchEvent(new CustomEvent('watch:catalog-visible'));
    }
  }
  async function availability(quiet){
    var request=++availabilityRequest;if(!quiet)setMode('loading',null);
    try{
      if(earlyParam)await earlyReady;
      var response=await fetch('/api/site-settings',{credentials:'include',cache:'no-store'});
      if(!response.ok)throw new Error('Availability unavailable');
      var settings=await response.json();if(request!==availabilityRequest)return null;
      if(!settings||(settings.watchPreviewEnabled!==true&&!['shop','waitlist'].includes(settings.watchesMode)))throw new Error('Unknown watch mode');
      setMode(settings.watchesMode,settings);return settings;
    }catch(_){if(request===availabilityRequest)setMode('error',null);return null;}
  }
  window.sdRetryWatchAvailability=function(){window.sdWatchSettingsReady=availability();return window.sdWatchSettingsReady;};
  window.sdRetryWatchAvailability();
  if(el('wa-mode-retry'))el('wa-mode-retry').onclick=window.sdRetryWatchAvailability;
  window.addEventListener&&window.addEventListener('focus',function(){window.sdWatchSettingsReady=availability(true);});
  var params = new URLSearchParams(window.location.search);
  window.sdRefParam = params.get('ref') || '';
  window.sdShowReferral = function (result) {
    var box = el('sd-share');
    if (!box || !result || !result.refCode) return;
    box.textContent = '';
    if (result.position) {
      var position = document.createElement('p'); position.className = 'sd-share-position';
      position.textContent = 'You’re #' + result.position + ' on the list'; box.appendChild(position);
    }
    var note = document.createElement('p'); note.className = 'sd-share-note'; note.textContent = 'Share your link — every signup moves you up'; box.appendChild(note);
    var row = document.createElement('div'); row.className = 'sd-share-row';
    var input = document.createElement('input'); input.className = 'sd-share-input'; input.readOnly = true;
    input.value = window.location.origin + '/watches.html?ref=' + encodeURIComponent(result.refCode);
    input.setAttribute('aria-label', 'Your watch waitlist referral link');
    var copy = document.createElement('button'); copy.type = 'button'; copy.className = 'sd-share-copy'; copy.textContent = 'Copy';
    copy.addEventListener('click', async function () {
      input.select();
      try {
        if (navigator.clipboard) await navigator.clipboard.writeText(input.value);
        else if (!document.execCommand('copy')) throw new Error('Clipboard unavailable');
        copy.textContent = 'Copied';
      } catch (_) { copy.textContent = 'Select link to copy'; }
    });
    row.appendChild(input); row.appendChild(copy); box.appendChild(row); box.classList.add('visible');
    if (result.earlyAccessUrl) {
      var access=document.createElement('a');access.className='sd-share-copy';access.textContent='Open early access';
      access.href=result.earlyAccessUrl;box.appendChild(access);
      var expiry=document.createElement('p');expiry.className='sd-share-note';expiry.textContent='Save your private link. It expires in 7 days.';box.appendChild(expiry);
    }
  };
  function applyCopy(settings) {
    if(!settings)return;
    if (el('wl-headline') && settings.watchHeadline) el('wl-headline').textContent = settings.watchHeadline;
    if (el('wl-sub') && settings.watchSub) el('wl-sub').textContent = settings.watchSub;
    var specs = el('wl-specs');
    if (specs && Array.isArray(settings.watchSpecs) && settings.watchSpecs.length) {
      specs.textContent = '';
      settings.watchSpecs.forEach(function (spec) {
        var row = document.createElement('div'); row.className = 'wl-spec-row';
        [['wl-spec-label', spec.label], ['wl-spec-dot', ''], ['wl-spec-value', spec.value]].forEach(function (pair) {
          var span = document.createElement('span'); span.className = pair[0]; span.textContent = pair[1]; row.appendChild(span);
        }); specs.appendChild(row);
      });
    }
    var total = Number(settings.editionTotal), claimed = Number(settings.editionClaimed);
    var edition = el('sd-edition');
    if(edition)edition.style.display='none';
    if (edition && Number.isInteger(total) && total > 0) {
      edition.style.display = '';
      edition.textContent = 'Limited edition — ' + (total - Math.max(0, Math.min(total, Number.isFinite(claimed) ? claimed : 0))) + ' of ' + total + ' pieces remaining';
    }
    var target = new Date(settings.dropDate).getTime(), countdown = el('sd-countdown');
    if(countdown){countdown.style.display='none';countdown.textContent='';}
    if (countdown && settings.countdownEnabled!==false && Number.isFinite(target) && target > Date.now()) {
      countdown.style.display = '';
      var title=document.createElement('p');title.className='sd-countdown-title';title.textContent=settings.dropTitle||'The Drop';
      var units=document.createElement('div');units.className='sd-countdown-units';
      var digits=['Days','Hours','Minutes','Seconds'].map(function(label){
        var unit=document.createElement('div');unit.className='sd-countdown-unit';
        var value=document.createElement('strong'),caption=document.createElement('span');caption.textContent=label;
        unit.append(value,caption);units.appendChild(unit);return value;
      });
      countdown.append(title,units);
      function tick() {
        var seconds = Math.max(0, Math.floor((target - Date.now()) / 1000));
        [Math.floor(seconds/86400),Math.floor(seconds%86400/3600),Math.floor(seconds%3600/60),seconds%60].forEach(function(v,i){digits[i].textContent=String(v).padStart(2,'0');});
        if (!seconds) { clearInterval(timer); countdown.style.display = 'none'; }
      }
      timer = setInterval(tick, 1000); tick();
    }
  }
})();
