(function () {
  // Three SVG petal silhouettes — slender, curled, leaf-like
  var PETAL_SHAPES = [
    'M50 4 C72 18, 86 42, 78 70 C72 88, 58 96, 50 96 C42 96, 28 88, 22 70 C14 42, 28 18, 50 4 Z',
    'M50 6 C76 22, 88 48, 74 78 C66 92, 54 96, 50 96 C46 96, 34 92, 26 78 C12 48, 24 22, 50 6 Z',
    'M50 8 C68 20, 82 40, 80 64 C78 84, 62 94, 50 94 C38 94, 22 84, 20 64 C18 40, 32 20, 50 8 Z'
  ];

  // Rose-gold gradient palette pairs (light → dark)
  var GRADIENTS = [
    { a: '#F0D4B4', b: '#A67849' }, // bright champagne
    { a: '#E8C4A0', b: '#8B6A47' }, // soft rose gold
    { a: '#D4A878', b: '#7A5838' }, // deep rose gold
    { a: '#F4E0C8', b: '#B68B5E' }, // pale gold
    { a: '#C89868', b: '#6B4A2F' }  // burnished
  ];

  function rand(min, max) { return min + Math.random() * (max - min); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function ease(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
  function uid() { return 'g' + Math.random().toString(36).slice(2, 9); }

  function makePetalSVG(size) {
    var grad = pick(GRADIENTS);
    var shape = pick(PETAL_SHAPES);
    var id = uid();
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size * rand(1.25, 1.55));
    svg.style.display = 'block';
    svg.style.overflow = 'visible';

    var defs = document.createElementNS(svgNS, 'defs');

    // Main fill gradient
    var lg = document.createElementNS(svgNS, 'linearGradient');
    lg.setAttribute('id', id);
    lg.setAttribute('x1', '20%'); lg.setAttribute('y1', '0%');
    lg.setAttribute('x2', '80%'); lg.setAttribute('y2', '100%');
    var s1 = document.createElementNS(svgNS, 'stop');
    s1.setAttribute('offset', '0%'); s1.setAttribute('stop-color', grad.a); s1.setAttribute('stop-opacity', '0.95');
    var s2 = document.createElementNS(svgNS, 'stop');
    s2.setAttribute('offset', '100%'); s2.setAttribute('stop-color', grad.b); s2.setAttribute('stop-opacity', '0.9');
    lg.appendChild(s1); lg.appendChild(s2);
    defs.appendChild(lg);

    // Highlight overlay gradient (sheen)
    var hgId = id + 'h';
    var hg = document.createElementNS(svgNS, 'linearGradient');
    hg.setAttribute('id', hgId);
    hg.setAttribute('x1', '0%'); hg.setAttribute('y1', '0%');
    hg.setAttribute('x2', '100%'); hg.setAttribute('y2', '0%');
    var hs1 = document.createElementNS(svgNS, 'stop');
    hs1.setAttribute('offset', '0%'); hs1.setAttribute('stop-color', '#fff'); hs1.setAttribute('stop-opacity', '0');
    var hs2 = document.createElementNS(svgNS, 'stop');
    hs2.setAttribute('offset', '45%'); hs2.setAttribute('stop-color', '#fff'); hs2.setAttribute('stop-opacity', '0.18');
    var hs3 = document.createElementNS(svgNS, 'stop');
    hs3.setAttribute('offset', '100%'); hs3.setAttribute('stop-color', '#fff'); hs3.setAttribute('stop-opacity', '0');
    hg.appendChild(hs1); hg.appendChild(hs2); hg.appendChild(hs3);
    defs.appendChild(hg);

    svg.appendChild(defs);

    // Petal body
    var path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', shape);
    path.setAttribute('fill', 'url(#' + id + ')');
    svg.appendChild(path);

    // Sheen on top
    var sheen = document.createElementNS(svgNS, 'path');
    sheen.setAttribute('d', shape);
    sheen.setAttribute('fill', 'url(#' + hgId + ')');
    svg.appendChild(sheen);

    // Central vein for realism
    var vein = document.createElementNS(svgNS, 'path');
    vein.setAttribute('d', 'M50 8 Q48 50, 50 94');
    vein.setAttribute('stroke', grad.b);
    vein.setAttribute('stroke-width', '0.6');
    vein.setAttribute('stroke-opacity', '0.4');
    vein.setAttribute('fill', 'none');
    svg.appendChild(vein);

    return svg;
  }

  function makeShimmer(size) {
    var el = document.createElement('div');
    el.style.cssText = [
      'position:absolute',
      'width:' + size + 'px',
      'height:' + size + 'px',
      'border-radius:50%',
      'background:radial-gradient(circle, rgba(232,196,160,0.95) 0%, rgba(196,149,106,0.4) 40%, transparent 70%)',
      'box-shadow:0 0 ' + (size * 2.5) + 'px rgba(232,196,160,0.5)',
      'pointer-events:none',
      'will-change:transform,opacity',
      'opacity:0'
    ].join(';');
    return el;
  }

  function startPetals() {
    var container = document.getElementById('petals');
    if (!container) return;

    var vh = window.innerHeight;
    var vw = window.innerWidth;
    var items = [];
    var maxItems = 11;
    var spawnTimer = 0;
    var spawnInterval = 120;

    window.addEventListener('resize', function () {
      vh = window.innerHeight;
      vw = window.innerWidth;
    });

    function spawnPetal() {
      var isShimmer = Math.random() < 0.18;
      var size, el;

      if (isShimmer) {
        size = rand(2, 5);
        el = makeShimmer(size);
      } else {
        size = rand(12, 26);
        el = document.createElement('div');
        el.style.cssText = [
          'position:absolute',
          'pointer-events:none',
          'opacity:0',
          'will-change:transform,opacity',
          'filter:drop-shadow(0 2px 4px rgba(196,149,106,0.18)) drop-shadow(0 0 6px rgba(196,149,106,0.12))'
        ].join(';');
        el.appendChild(makePetalSVG(size));
      }

      var startX = rand(2, 98);
      el.style.left = startX + 'vw';
      el.style.top = '-60px';

      container.appendChild(el);

      items.push({
        el: el,
        isShimmer: isShimmer,
        x: 0,
        y: 0,
        vy: isShimmer ? rand(0.15, 0.32) : rand(0.22, 0.55),
        rotZ: rand(0, 360),
        rotZSpeed: isShimmer ? 0 : rand(-0.35, 0.35),
        rotY: rand(0, 360),
        rotYSpeed: isShimmer ? 0 : rand(-0.22, 0.22),
        rotX: rand(0, 25),
        rotXSpeed: isShimmer ? 0 : rand(-0.18, 0.18),
        swayAmp: isShimmer ? rand(0.08, 0.18) : rand(0.18, 0.55),
        swayFreq: rand(0.003, 0.008),
        driftAmp: isShimmer ? rand(8, 22) : rand(18, 55),
        driftFreq: rand(0.0015, 0.0045),
        swayOffset: rand(0, Math.PI * 2),
        driftOffset: rand(0, Math.PI * 2),
        maxOpacity: isShimmer ? rand(0.55, 0.9) : rand(0.45, 0.78),
        fadeInFrames: Math.floor(rand(80, 160)),
        fadeStart: rand(0.72, 0.9),
        twinklePhase: rand(0, Math.PI * 2),
        twinkleSpeed: rand(0.04, 0.09),
        t: 0,
        dead: false
      });
    }

    function animate() {
      spawnTimer++;
      var liveCount = 0;
      for (var j = 0; j < items.length; j++) {
        if (!items[j].dead) liveCount++;
      }
      if (spawnTimer >= spawnInterval && liveCount < maxItems) {
        spawnPetal();
        spawnTimer = 0;
        spawnInterval = Math.floor(rand(90, 180));
      }

      for (var i = 0; i < items.length; i++) {
        var p = items[i];
        if (p.dead) continue;

        p.t++;

        var sway = Math.sin(p.t * p.swayFreq + p.swayOffset) * p.swayAmp;
        var drift = Math.sin(p.t * p.driftFreq + p.driftOffset) * p.driftAmp;

        p.x = drift;
        p.y += p.vy;
        p.rotZ += p.rotZSpeed + sway * 0.25;
        p.rotY += p.rotYSpeed;
        p.rotX += p.rotXSpeed;

        var progress = p.y / (vh + 80);
        var alpha = p.maxOpacity;

        if (p.t < p.fadeInFrames) {
          alpha *= ease(p.t / p.fadeInFrames);
        }

        if (progress > p.fadeStart) {
          var fadeProgress = (progress - p.fadeStart) / (1 - p.fadeStart);
          alpha *= 1 - ease(fadeProgress);
        }

        // Subtle twinkle for shimmers, very slight breath for petals
        if (p.isShimmer) {
          alpha *= 0.55 + 0.45 * Math.sin(p.t * p.twinkleSpeed + p.twinklePhase);
        } else {
          alpha *= 0.92 + 0.08 * Math.sin(p.t * 0.03 + p.twinklePhase);
        }

        p.el.style.transform =
          'translate3d(' + p.x + 'px, ' + p.y + 'px, 0) ' +
          'rotateZ(' + p.rotZ + 'deg) ' +
          'rotateY(' + p.rotY + 'deg) ' +
          'rotateX(' + p.rotX + 'deg)';
        p.el.style.opacity = Math.max(0, alpha);

        if (p.y > vh + 100) {
          if (p.el.parentNode) p.el.parentNode.removeChild(p.el);
          p.dead = true;
        }
      }

      items = items.filter(function (p) { return !p.dead; });
      requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }

  function fadeIn() {
    var overlay = document.getElementById('page-transition');
    if (!overlay) return;
    overlay.style.transition = 'none';
    overlay.style.display = 'block';
    overlay.style.opacity = '1';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        overlay.style.transition = 'opacity 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        overlay.style.opacity = '0';
        setTimeout(function () { overlay.style.display = 'none'; }, 650);
      });
    });
  }

  function fadeOutAndNavigate(href) {
    var overlay = document.getElementById('page-transition');
    if (!overlay) { window.location.href = href; return; }
    overlay.style.display = 'block';
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { overlay.style.opacity = '1'; });
    });
    setTimeout(function () { window.location.href = href; }, 520);
  }

  window.addEventListener('pageshow', function (e) {
    if (e.persisted) fadeIn();
  });

  document.addEventListener('DOMContentLoaded', function () {
    fadeIn();
    startPetals();

    document.querySelectorAll('a').forEach(function (link) {
      var href = link.getAttribute('href');
      if (!href || href === '#' || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      if (link.target === '_blank') return;
      link.addEventListener('click', function (e) {
        e.preventDefault();
        fadeOutAndNavigate(this.href);
      });
    });
  });
})();
