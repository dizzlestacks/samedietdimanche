(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var form = document.getElementById('waitlist-form');
    var emailInput = document.getElementById('wl-email');
    var msg = document.getElementById('wl-msg');
    var followReveal = document.getElementById('wl-follow-reveal');

    if (!form) return;

    function revealFollow() {
      if (followReveal) followReveal.classList.add('is-visible');
    }

    var category = form.getAttribute('data-category') || 'watches';

    // Apply per-page waitlist settings: custom copy + enable/disable.
    var closedNote=null;
    async function applySettings(supplied) {
      var s;
      try {
        if(supplied!==undefined)s=supplied;
        else if(category==='watches'&&window.sdWatchSettingsReady)s=await window.sdWatchSettingsReady;
        else {
          var settingsResponse=window.__siteSettings?null:await fetch('/api/site-settings',{credentials:'include',cache:'no-store'});
          if(settingsResponse&&!settingsResponse.ok)return;
          s=window.__siteSettings||await settingsResponse.json();
        }
        if(!s)return;
      } catch (e) { return; }

      // Keep the "Follow on Instagram" link in sync with the admin setting.
      if (s.instagramUrl && /^https?:\/\//.test(s.instagramUrl)) {
        document.querySelectorAll('.wl-instagram').forEach(function (a) {
          a.href = s.instagramUrl;
        });
      }

      var enabled, headline, sub, buttonText;
      if (category === 'bud') {
        enabled = s.budWaitlistEnabled !== false;
        headline = s.budWaitlistHeadline;
        sub = s.budWaitlistSub;
        buttonText = s.budWaitlistButton;
        var h = document.getElementById('wl-headline');
        var su = document.getElementById('wl-sub');
        if (h && headline) h.textContent = headline;
        if (su && sub) su.textContent = sub;
      } else {
        if(s.watchPreviewEnabled!==true){
          if(window.sdWatchMode&&window.sdWatchMode!==s.watchesMode)return;
          if(s.watchesMode!=='waitlist'){form.style.display='none';return;}
        }
        enabled = s.watchPreviewEnabled === true || s.watchesWaitlistEnabled !== false;
        form.style.display=enabled?'':'none';
        buttonText = s.watchesWaitlistButton;
        // Watches headline/sub are handled by watch-page.js (watchHeadline/watchSub).
      }

      var btn = form.querySelector('.wl-btn');
      if (btn && buttonText) btn.textContent = buttonText;

      if (!enabled) {
        // Hide the form. On the bud page the menu takes its place; on other
        // pages show a fallback note — unless the watches page is in shop
        // mode, which already replaces the waitlist with the shop.
        form.style.display = 'none';
        if (category === 'bud') {
          var shown = await showBudMenu(form);
          if (!shown) showClosedNote(form);
          revealFollow();
        } else if (!(category === 'watches' && (s.watchesMode === 'shop'||s.watchPreviewEnabled===true))) {
          showClosedNote(form);
          revealFollow();
        }
      }

      function showClosedNote(beforeEl) {
        if(closedNote)return;
        var note = document.createElement('p');
        note.className = 'wl-msg wl-msg--info is-visible';
        note.style.opacity = '1';
        note.textContent = 'The waitlist is currently closed. Follow us on Instagram for updates.';
        beforeEl.parentNode.insertBefore(note, beforeEl);
        closedNote=note;
      }

      // When the bud waitlist is off, show the live menu right on the page.
      // Fails quietly (returns false) if the menu is empty or unavailable
      // (e.g. the visitor is outside the region where the menu is served).
      async function showBudMenu(beforeEl) {
        var items, checkoutOn = false;
        try {
          var res = await fetch('/api/bud-menu');
          if (!res.ok) return false;
          var payload = await res.json();
          items = payload.data || [];
          checkoutOn = payload.checkoutEnabled === true;
        } catch (e) { return false; }
        if (items.length === 0) return false;

        var grid = document.createElement('div');
        grid.className = 'bud-inline-menu';
        items.forEach(function (it) {
          var card = document.createElement('div');
          card.className = 'bud-inline-card';
          if (it.image && !/["'<>`\s\\]/.test(it.image)) {
            var img = document.createElement('img');
            img.className = 'bud-inline-img';
            img.alt = '';
            img.loading = 'lazy';
            img.src = it.image;
            card.appendChild(img);
          }
          var info = document.createElement('div');
          info.className = 'bud-inline-info';
          var name = document.createElement('p');
          name.className = 'bud-inline-name';
          name.textContent = it.name || '';
          info.appendChild(name);
          var metaBits = [it.strain, it.category, it.thc ? 'THC ' + it.thc : ''].filter(Boolean);
          if (metaBits.length) {
            var meta = document.createElement('p');
            meta.className = 'bud-inline-meta';
            meta.textContent = metaBits.join(' \u00b7 ');
            info.appendChild(meta);
          }
          card.appendChild(info);
          var priceBits = [it.price, it.price && it.weight && String(it.price).indexOf(String(it.weight)) !== -1 ? '' : it.weight].filter(Boolean);
          if (priceBits.length) {
            var price = document.createElement('p');
            price.className = 'bud-inline-price';
            price.textContent = priceBits.join(' \u00b7 ');
            card.appendChild(price);
          }
          if (checkoutOn) {
            var buyBtn = document.createElement('button');
            buyBtn.type = 'button';
            buyBtn.className = 'bud-inline-buy';
            buyBtn.textContent = 'Purchase';
            buyBtn.addEventListener('click', async function () {
              buyBtn.disabled = true;
              var label = buyBtn.textContent;
              buyBtn.textContent = '...';
              try {
                var r = await fetch('/api/bud-checkout', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ itemId: it.id, quantity: 1 })
                });
                var d = await r.json();
                if (d && d.url) { window.location.href = d.url; return; }
              } catch (e) { /* fall through */ }
              buyBtn.disabled = false;
              buyBtn.textContent = label;
            });
            card.appendChild(buyBtn);
          }
          grid.appendChild(card);
        });
        beforeEl.parentNode.insertBefore(grid, beforeEl);
        return true;
      }
    }
    applySettings();
    if(category==='watches')window.addEventListener('watch:mode',function(e){
      if(closedNote){closedNote.remove();closedNote=null;}
      form.style.display='none';
      if(e.detail.mode==='waitlist'||e.detail.settings?.watchPreviewEnabled===true)applySettings(e.detail.settings);
    });

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if(category==='watches'&&document.getElementById('watch-waitlist')&&document.getElementById('watch-waitlist').hidden)return;
      var email = emailInput.value.trim();
      if (!email) return;

      var btn = form.querySelector('.wl-btn');
      var originalLabel = btn.textContent;
      btn.disabled = true;
      btn.textContent = '...';
      msg.textContent = '';
      msg.className = 'wl-msg';

      try {
        var res = await fetch('/api/waitlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email, category: category, ref: window.sdRefParam || '' })
        });
        var data = await res.json();

        if (res.ok) {
          if (data.added) {
            msg.textContent = data.position ? 'You\'re on the list — #' + data.position + '.' : 'You\'re on the list.';
            msg.className = 'wl-msg wl-msg--success';
            emailInput.value = '';
          } else {
            msg.textContent = data.earlyAccessEnabled && data.emailConfigured
              ? 'Already on the list. A new access link has been requested for your email.'
              : 'Already on the list. Your email is saved.';
            msg.className = 'wl-msg wl-msg--info';
          }
          if (window.sdShowReferral) window.sdShowReferral(data);
          revealFollow();
        } else {
          msg.textContent = data.error || 'Something went wrong. Please retry.';
          msg.className = 'wl-msg wl-msg--error';
        }
      } catch (err) {
        msg.textContent = 'Could not connect. Try again.';
        msg.className = 'wl-msg wl-msg--error';
      } finally {
        btn.disabled = false;
        btn.textContent = originalLabel;
      }
    });
  });
})();
