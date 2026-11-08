/* Local design atelier. No price IDs, payment calls, or changes to shop settings. */
(function () {
  'use strict';
  var host = document.getElementById('watch-experience');
  if (!host) return;
  var colors = {
    face: [
      { id: 'black', name: 'Black', color: '#24252a' },
      { id: 'red', name: 'Red', color: '#943c42' },
      { id: 'blue', name: 'Blue', color: '#344d78' },
      { id: 'green', name: 'Green', color: '#3d6654' }
    ],
    band: [
      { id: 'black', name: 'Black', color: '#24252a' },
      { id: 'red', name: 'Red', color: '#943c42' },
      { id: 'green', name: 'Green', color: '#3d6654' },
      { id: 'blue', name: 'Blue', color: '#344d78' },
      { id: 'camouflage', name: 'Camouflage', color: 'linear-gradient(135deg,#57624b 0% 30%,#a29773 30% 55%,#303b30 55% 75%,#777453 75%)' }
    ]
  };
  // Every new visit starts black / black. Saved pairs are restored only explicitly.
  var selection = { face: 0, band: 0 };
  var baseId = 'black-black', migratedDesigns = false;
  var key = 'sd-watch-designs-v1';
  var saved = [];
  var memoryOnly = false;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var animations = {};
  var cache = {};
  var displayed = { face: null, band: null };
  var imageRequests = { face: 0, band: 0, case: 0 };
  var imageErrors = {};
  var imagePending = {};
  function el(id) { return document.getElementById(id); }
  function asset(kind, id) { return 'img/watch-atelier-v6/' + kind + (id ? '-' + id : '') + '.png?v=watch14'; }
  function prepare(url) {
    if (cache[url]) return cache[url];
    cache[url] = new Promise(function (resolve, reject) {
      var image = new Image();
      image.onload = function () {
        (image.decode ? image.decode() : Promise.resolve()).then(function () { resolve(url); }, reject);
      };
      image.onerror = function () { reject(new Error('Image unavailable')); };
      image.src = url;
    }).catch(function (error) { delete cache[url]; throw error; });
    return cache[url];
  }
  function colorById(kind, id) { return colors[kind].find(function (c) { return c.id === id; }); }
  function selected(kind) { return colors[kind][selection[kind]]; }
  function statusWithRetry(node, message, retry) {
    node.textContent = message;
    if (retry) {
      var button = document.createElement('button');
      button.type = 'button'; button.className = 'wa-retry'; button.textContent = 'Retry';
      button.addEventListener('click', retry); node.appendChild(button);
    }
  }
  function previewStatus() {
    var pending = Object.keys(imagePending).some(function (k) { return imagePending[k]; });
    var failures = Object.keys(imageErrors).filter(function (k) { return imageErrors[k]; });
    el('wa-preview').setAttribute('aria-busy', String(pending));
    el('wa-save').disabled = pending || failures.length > 0;
    ['face', 'band'].forEach(function (kind) {
      var requested = selected(kind).name;
      el('wa-' + kind + '-name').textContent = requested + (imageErrors[kind] ? ' — unavailable' : imagePending[kind] ? ' — preparing' : '');
    });
    var visible = (displayed.face ? displayed.face.name : 'Loading') + ' face, ' + (displayed.band ? displayed.band.name : 'loading') + ' band';
    el('wa-preview').setAttribute('aria-label', 'Visible studio visualization: ' + visible + (pending || failures.length ? '. Requested combination not yet displayed.' : ''));
    var message = failures.length ? 'Requested ' + failures.join(' / ') + ' unavailable. Previous loaded layers remain visible; saving is paused.' : pending ? 'Preparing requested combination. Previous loaded layers remain visible.' : '';
    ['wa-preview-status'].forEach(function (id) {
      statusWithRetry(el(id), message, failures.length ? function () {
        failures.forEach(function (kind) { loadLayer(kind, 0); });
      } : null);
    });
    window.dispatchEvent(new CustomEvent('watch:preview-state', { detail: {
      baseId: baseId, face: selected('face').id, band: selected('band').id,
      ready: !pending && !failures.length && !!displayed.face && !!displayed.band &&
        displayed.face.id === selected('face').id && displayed.band.id === selected('band').id
    } }));
  }
  function swapLayer(layer, url, direction) {
    var id = layer.id;
    if (animations[id]) { animations[id](); delete animations[id]; }
    if (layer.getAttribute('src') === url || !direction || reduced.matches || !layer.animate) {
      layer.src = url; return;
    }
    var outgoing = layer.cloneNode(false);
    outgoing.classList.add('wa-layer-outgoing');
    outgoing.removeAttribute('id'); outgoing.removeAttribute('fetchpriority');
    outgoing.setAttribute('aria-hidden', 'true');
    layer.parentNode.insertBefore(outgoing, layer);
    layer.src = url;
    var options = { duration: 300, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' };
    var incomingAnimation = layer.animate([
      { opacity: 0, transform: 'translateX(' + direction * 10 + 'px) scale(.985)' },
      { opacity: 1, transform: 'translateX(0) scale(1)' }
    ], options);
    var outgoingAnimation = outgoing.animate([
      { opacity: 1, transform: 'translateX(0) scale(1)' },
      { opacity: 0, transform: 'translateX(' + direction * -8 + 'px) scale(1.01)' }
    ], options);
    function cleanup() {
      incomingAnimation.cancel(); outgoingAnimation.cancel(); outgoing.remove();
    }
    animations[id] = cleanup;
    incomingAnimation.finished.then(function () {
      if (animations[id] === cleanup) { cleanup(); delete animations[id]; }
    }).catch(function () { /* Superseded layer transition. */ });
  }
  function loadLayer(kind, direction) {
    var choice = kind === 'case' ? null : selected(kind);
    var url = asset(kind, choice ? choice.id : '');
    var request = ++imageRequests[kind];
    imagePending[kind] = true; imageErrors[kind] = false;
    previewStatus();
    prepare(url).then(function () {
      if (request !== imageRequests[kind]) return;
      swapLayer(el('wa-' + kind + '-layer'), url, direction);
      if (choice) displayed[kind] = choice;
      imagePending[kind] = false; imageErrors[kind] = false; previewStatus();
      if (choice) {
        host.dataset[kind] = choice.id;
        window.dispatchEvent(new CustomEvent('watch:selection-loaded', { detail: { kind: kind, id: choice.id } }));
      }
    }).catch(function () {
      if (request !== imageRequests[kind]) return;
      imagePending[kind] = false; imageErrors[kind] = true;
      previewStatus();
    });
  }
  function updateSelection(kind, next, direction) {
    selection[kind] = (next + colors[kind].length) % colors[kind].length;
    var color = selected(kind);
    el('wa-' + kind + '-name').textContent = color.name;
    el('wa-' + kind + '-swatches').querySelectorAll('button').forEach(function (button, i) {
      button.setAttribute('aria-pressed', String(i === selection[kind]));
    });
    loadLayer(kind, direction);
  }
  function step(kind, direction) { updateSelection(kind, selection[kind] + direction, direction); }
  function horizontalGesture(node, move, continuous) {
    var start = null;
    var moved = false;
    node.addEventListener('pointerdown', function (event) {
      if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
      start = { x: event.clientX, y: event.clientY, id: event.pointerId };
      moved = false;
      // Do not capture selector buttons: their native click must remain intact.
      if (continuous && node.setPointerCapture) node.setPointerCapture(event.pointerId);
    });
    node.addEventListener('pointermove', function (event) {
      if (!start || start.id !== event.pointerId) return;
      var dx = event.clientX - start.x, dy = event.clientY - start.y;
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 15) { start = null; return; }
      if (Math.abs(dx) > (continuous ? 24 : 40)) {
        move(dx < 0 ? 1 : -1); moved = true;
        if (continuous) { start.x = event.clientX; start.y = event.clientY; }
        else start = null;
      }
    });
    node.addEventListener('pointerup', function () { start = null; });
    node.addEventListener('pointercancel', function () { start = null; });
    node.addEventListener('lostpointercapture', function () { start = null; });
    node.addEventListener('pointerleave', function () { if (!continuous) start = null; });
    node.addEventListener('click', function (event) {
      if (moved) { event.preventDefault(); event.stopPropagation(); moved = false; }
    }, true);
  }
  ['face', 'band'].forEach(function (kind) {
    colors[kind].forEach(function (color, i) {
      var button = el('wa-' + kind + '-swatches').querySelector('[data-color="' + color.id + '"]') || document.createElement('button');
      button.type = 'button'; button.className = 'wa-swatch';
      button.disabled = false;
      button.dataset.color = color.id;
      button.style.setProperty('--swatch', color.color);
      button.setAttribute('aria-label', color.name + ' ' + kind);
      button.title = color.name;
      button.setAttribute('aria-pressed', String(i === selection[kind]));
      button.addEventListener('click', function () {
        if (i !== selection[kind]) updateSelection(kind, i, i > selection[kind] ? 1 : -1);
      });
      el('wa-' + kind + '-swatches').appendChild(button);
    });
    var selector = el('wa-' + kind + '-selector');
    horizontalGesture(selector, function (dir) { step(kind, dir); }, false);
    selector.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault(); step(kind, event.key === 'ArrowRight' ? 1 : -1);
      }
    });
    loadLayer(kind, 0);
  });
  loadLayer('case', 0);
  host.querySelectorAll('[data-step]').forEach(function (button) {
    button.addEventListener('click', function () {
      var parts = button.dataset.step.split(':'); step(parts[0], Number(parts[1]));
    });
  });

  // Decode the registered assets ahead of selection; keep the current layer visible.
  ['face', 'band'].forEach(function (kind) {
    colors[kind].forEach(function (color) { prepare(asset(kind, color.id)).catch(function () { /* Retry on selection. */ }); });
  });

  function validDesign(item) {
    return item && SharedCart.validWatchBase(item.baseId) && colorById('face', item.face) && colorById('band', item.band);
  }
  function migrateDesign(item) {
    if(!item)return item;
    var next=Object.assign({},item,{band:item.band==='violet'?'blue':item.band});
    if(!next.baseId){next.baseId=SharedCart.inferWatchBase(next.face,next.band);migratedDesigns=true;}
    return next;
  }
  try {
    var stored = JSON.parse(localStorage.getItem(key) || '[]');
    if (Array.isArray(stored)) {
      saved = stored.map(migrateDesign).filter(validDesign).slice(0, 20);
      if (migratedDesigns || stored.some(function (item) { return item && item.band === 'violet'; })) persist();
    }
  } catch (error) { memoryOnly = true; }
  function persist() {
    try { localStorage.setItem(key, JSON.stringify(saved)); memoryOnly = false; }
    catch (error) { memoryOnly = true; }
  }
  function renderSaved() {
    var list = el('wa-saved-list');
    list.textContent = '';
    el('wa-saved-empty').hidden = saved.length > 0;
    el('wa-saved-count').textContent = saved.length + (saved.length === 1 ? ' design' : ' designs');
    saved.forEach(function (design, index) {
      var face = colorById('face', design.face), band = colorById('band', design.band);
      var item = document.createElement('li'); item.className = 'wa-saved-item';
      var thumb = document.createElement('div'); thumb.className = 'wa-saved-thumb'; thumb.setAttribute('aria-hidden', 'true');
      ['band', 'case', 'face'].forEach(function (kind) {
        var image = document.createElement('img');
        image.src = asset(kind, kind === 'case' ? '' : design[kind]);
        image.className = 'wa-layer wa-layer-' + kind; image.alt = ''; image.loading = 'lazy';
        image.addEventListener('error', function () {
          image.hidden = true;
          detail.textContent = face.name + ' face · ' + band.name + ' band · Thumbnail unavailable';
          if (!item.querySelector('.wa-retry')) {
            var retry = document.createElement('button');
            retry.type = 'button'; retry.className = 'wa-retry'; retry.textContent = 'Retry preview';
            retry.addEventListener('click', function () {
              thumb.querySelectorAll('img').forEach(function (img) { img.hidden = false; img.src = img.src; });
              retry.remove();
            });
            info.appendChild(retry);
          }
        });
        thumb.appendChild(image);
      });
      var info = document.createElement('div'); info.className = 'wa-saved-item-info';
      var title = document.createElement('strong'); title.textContent = face.name + ' / ' + band.name;
      var detail = document.createElement('small'); detail.textContent = face.name + ' face · ' + band.name + ' band · Base: ' + design.baseId.replace(/-/g,' / ');
      info.appendChild(title); info.appendChild(detail);
      var remove = document.createElement('button');
      remove.type = 'button'; remove.className = 'wa-remove'; remove.textContent = 'Remove';
      remove.setAttribute('aria-label', 'Remove ' + face.name + ' face and ' + band.name + ' band design');
      remove.addEventListener('click', function () {
        saved.splice(index, 1); persist(); renderSaved();
        el('wa-save-status').textContent = memoryOnly ? 'Removed for this session. Device storage is unavailable.' : 'Design removed.';
        var remaining = list.querySelectorAll('.wa-remove');
        (remaining[Math.min(index, remaining.length - 1)] || (el('watch-customizer').hidden ? el('wa-customize-generic') : el('wa-review').hidden ? el('wa-next') : el('wa-save'))).focus();
      });
      var restore = document.createElement('button');
      restore.type = 'button'; restore.className = 'wa-restore'; restore.textContent = 'Use design';
      restore.setAttribute('aria-label', 'Use saved ' + face.name + ' face and ' + band.name + ' band design');
      restore.addEventListener('click', function () {
        baseId=design.baseId;
        window.dispatchEvent(new CustomEvent('watch:restore-design', {detail:{baseId:baseId}}));
        ['face', 'band'].forEach(function (kind) {
          var next = colors[kind].findIndex(function (color) { return color.id === design[kind]; });
          updateSelection(kind, next, next > selection[kind] ? 1 : -1);
        });
        el('wa-save-status').textContent = 'Requested saved ' + face.name + ' face / ' + band.name + ' band.';
        el('watch-customizer').scrollIntoView({ block: 'start', behavior: reduced.matches ? 'auto' : 'smooth' });
        el('wa-review').focus({ preventScroll: true });
      });
      var actions = document.createElement('div'); actions.className = 'wa-saved-actions';
      actions.appendChild(restore); actions.appendChild(remove);
      item.appendChild(thumb); item.appendChild(info); item.appendChild(actions); list.appendChild(item);
    });
  }
  el('wa-save').addEventListener('click', function () {
    if (el('wa-save').disabled) return;
    var design = { baseId: baseId, face: selected('face').id, band: selected('band').id };
    if (saved.some(function (d) { return d.baseId === design.baseId && d.face === design.face && d.band === design.band; })) {
      el('wa-save-status').textContent = 'This exact combination is already in your saved designs.'; return;
    }
    if (saved.length >= 20) {
      el('wa-save-status').textContent = 'Your device holds 20 designs. Remove one before saving another.'; return;
    }
    saved.push(design); persist(); renderSaved();
    el('wa-save-status').textContent = memoryOnly ? 'Saved for this session only. Device storage is unavailable.' : selected('face').name + ' face / ' + selected('band').name + ' band saved on this device.';
  });
  window.addEventListener('storage', function (event) {
    if (event.key !== key) return;
    try {
      var data = JSON.parse(event.newValue || '[]');
      migratedDesigns=false;
      saved = Array.isArray(data) ? data.map(migrateDesign).filter(validDesign).slice(0, 20) : [];
      if (Array.isArray(data) && (migratedDesigns || data.some(function (item) { return item && item.band === 'violet'; }))) persist();
      renderSaved();
    } catch (error) { /* Leave the current valid local list intact. */ }
  });
  function motionPreferenceChanged() {
    if (reduced.matches) {
      Object.keys(animations).forEach(function (kind) { animations[kind](); delete animations[kind]; });
    }
  }
  if (reduced.addEventListener) reduced.addEventListener('change', motionPreferenceChanged);
  else if (reduced.addListener) reduced.addListener(motionPreferenceChanged);
  renderSaved();
  window.addEventListener('watch:configure',function(event){
    var design=event.detail;
    if(!validDesign(design))return;
    baseId=design.baseId;
    ['face','band'].forEach(function(kind){updateSelection(kind,colors[kind].findIndex(function(c){return c.id===design[kind];}),0);});
  });
  // Only explicit cart edit links restore a pair; ordinary visits remain black/black.
  var editParams = new URLSearchParams(window.location.search);
  if (editParams.get('edit') === 'watch' && colorById('face',editParams.get('face')) && colorById('band',editParams.get('band'))) {
    var requestedBase=editParams.get('baseId');
    if(!requestedBase)requestedBase=SharedCart.inferWatchBase(editParams.get('face'),editParams.get('band'));
    if(!SharedCart.validWatchBase(requestedBase))return;
    baseId=requestedBase;
    ['face','band'].forEach(function(kind){updateSelection(kind,colors[kind].findIndex(function(c){return c.id===editParams.get(kind);}),0);});
    window.dispatchEvent(new CustomEvent('watch:restore-design',{detail:{baseId:baseId,edit:true}}));
  }
  if (memoryOnly) el('wa-save-status').textContent = 'Device storage is unavailable. Designs can be saved for this session only.';
  else if(migratedDesigns)el('wa-design-migration').textContent='Older saved designs now retain a matching original model, otherwise Black / Black. Review the new base and change fees when restoring.';
})();
