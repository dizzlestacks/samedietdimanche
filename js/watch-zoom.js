(function () {
  'use strict';
  var dialog = document.createElement('dialog');
  dialog.className = 'watch-zoom';
  dialog.setAttribute('aria-label', 'Watch close-up');
  dialog.innerHTML = '<div class="watch-zoom-tools"><button type="button" data-enlarge>Zoom in</button><button type="button" data-close autofocus>Close</button></div><p class="watch-zoom-caption"></p><div class="watch-zoom-viewport"><div class="watch-zoom-layers"></div></div>';
  document.body.appendChild(dialog);
  var viewport = dialog.querySelector('.watch-zoom-viewport');
  var layers = dialog.querySelector('.watch-zoom-layers');
  var enlarge = dialog.querySelector('[data-enlarge]');
  var opener, oldOverflow;
  function open(source) {
    if (dialog.open || source.disabled) return;
    layers.replaceChildren();
    source.querySelectorAll('img.wa-layer').forEach(function (image) {
      var copy = document.createElement('img');
      copy.src = image.src;
      copy.alt = '';
      copy.draggable = false;
      layers.appendChild(copy);
    });
    if (!layers.children.length) return;
    opener = source;
    dialog.querySelector('.watch-zoom-caption').textContent = source.getAttribute('aria-label').replace(/^Enlarge: /, '');
    viewport.classList.remove('is-enlarged');
    enlarge.textContent = 'Zoom in';
    enlarge.setAttribute('aria-pressed', 'false');
    if (oldOverflow === undefined) oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    viewport.scrollTop = viewport.scrollLeft = 0;
  }
  enlarge.onclick = function () {
    var on = viewport.classList.toggle('is-enlarged');
    enlarge.textContent = on ? 'Zoom out' : 'Zoom in';
    enlarge.setAttribute('aria-pressed', String(on));
  };
  dialog.querySelector('[data-close]').onclick = function () { dialog.close(); };
  dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', function () {
    if (dialog.open) return;
    document.body.style.overflow = oldOverflow;
    oldOverflow = undefined;
    if (opener) opener.focus({preventScroll:true});
  });
  ['watch:mode','watch:collection'].forEach(function(type){
    window.addEventListener(type,function(){
      if(dialog.open&&opener&&!opener.getClientRects().length)dialog.close();
    });
  });
  document.querySelectorAll('.wa-product-photo, #wa-preview, .wa-womens-photo').forEach(function (source) {
    source.setAttribute('role', 'button');
    source.setAttribute('tabindex', '0');
    source.setAttribute('aria-haspopup', 'dialog');
    source.classList.add('watch-zoom-trigger');
    var start, dragged = false;
    source.addEventListener('pointerdown', function (e) { start = {x:e.clientX,y:e.clientY}; dragged = false; });
    source.addEventListener('pointermove', function (e) {
      if (start && Math.hypot(e.clientX-start.x,e.clientY-start.y)>10) dragged = true;
    });
    source.addEventListener('pointercancel', function () { dragged = true; start = null; });
    source.addEventListener('click', function (e) { if (!dragged) { e.stopPropagation(); open(source); } start = null; });
    source.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); open(source); }
    });
  });
})();
