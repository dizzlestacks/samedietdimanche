(function () {
  var PETAL_IMAGES = [
    'img/petal1.png',
    'img/petal2.png',
    'img/petal3.png',
    'img/petal4.png',
    'img/petal5.png'
  ];

  function rand(min, max) { return min + Math.random() * (max - min); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function ease(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

  function preloadImages() {
    PETAL_IMAGES.forEach(function (src) {
      var img = new Image();
      img.src = src;
    });
  }

  function startAmbientPetals() {
    var container = document.getElementById('petals');
    if (!container) return;

    var vh = window.innerHeight;
    var vw = window.innerWidth;
    var petals = [];
    var maxPetals = 14;
    var spawnTimer = 0;
    var spawnInterval = 90;

    window.addEventListener('resize', function () {
      vh = window.innerHeight;
      vw = window.innerWidth;
    });

    function spawnPetal() {
      var el = document.createElement('img');
      el.className = 'petal';
      el.src = pick(PETAL_IMAGES);
      el.draggable = false;

      var size = rand(16, 40);
      var startX = rand(5, 95);

      el.style.cssText = [
        'position:absolute',
        'width:' + size + 'px',
        'height:auto',
        'left:' + startX + 'vw',
        'top:-60px',
        'opacity:0',
        'pointer-events:none',
        'filter:drop-shadow(0 1px 4px rgba(0,0,0,0.25))'
      ].join(';');

      container.appendChild(el);

      var baseSpeed = rand(0.3, 0.9);

      petals.push({
        el: el,
        x: 0,
        y: 0,
        vy: baseSpeed,
        rotZ: rand(0, 360),
        rotZSpeed: rand(-0.6, 0.6),
        rotY: rand(0, 360),
        rotYSpeed: rand(-0.4, 0.4),
        rotX: rand(0, 30),
        rotXSpeed: rand(-0.3, 0.3),
        swayAmp: rand(0.15, 0.5),
        swayFreq: rand(0.005, 0.012),
        driftAmp: rand(15, 50),
        driftFreq: rand(0.002, 0.006),
        swayOffset: rand(0, Math.PI * 2),
        driftOffset: rand(0, Math.PI * 2),
        maxOpacity: rand(0.4, 0.7),
        fadeInFrames: Math.floor(rand(60, 120)),
        fadeStart: rand(0.72, 0.9),
        t: 0,
        size: size,
        dead: false
      });
    }

    function animate() {
      spawnTimer++;
      var liveCount = 0;
      for (var j = 0; j < petals.length; j++) {
        if (!petals[j].dead) liveCount++;
      }
      if (spawnTimer >= spawnInterval && liveCount < maxPetals) {
        spawnPetal();
        spawnTimer = 0;
        spawnInterval = Math.floor(rand(70, 160));
      }

      for (var i = 0; i < petals.length; i++) {
        var p = petals[i];
        if (p.dead) continue;

        p.t++;

        var sway = Math.sin(p.t * p.swayFreq + p.swayOffset) * p.swayAmp;
        var drift = Math.sin(p.t * p.driftFreq + p.driftOffset) * p.driftAmp;

        p.x = drift;
        p.y += p.vy;
        p.rotZ += p.rotZSpeed + sway * 0.3;
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

        p.el.style.transform =
          'translateX(' + p.x + 'px) ' +
          'translateY(' + p.y + 'px) ' +
          'rotateZ(' + p.rotZ + 'deg) ' +
          'rotateY(' + p.rotY + 'deg) ' +
          'rotateX(' + p.rotX + 'deg)';
        p.el.style.opacity = Math.max(0, alpha);

        if (p.y > vh + 100) {
          container.removeChild(p.el);
          p.dead = true;
        }
      }

      petals = petals.filter(function (p) { return !p.dead; });

      requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }

  function fadeIn() {
    var overlay = document.getElementById('page-transition');
    if (!overlay) return;
    overlay.style.opacity = '1';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        overlay.style.transition = 'opacity 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        overlay.style.opacity = '0';
        setTimeout(function () {
          overlay.style.display = 'none';
        }, 650);
      });
    });
  }

  function fadeOutAndNavigate(href) {
    var overlay = document.getElementById('page-transition');
    if (!overlay) {
      window.location.href = href;
      return;
    }
    overlay.style.display = 'block';
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        overlay.style.opacity = '1';
      });
    });
    setTimeout(function () {
      window.location.href = href;
    }, 520);
  }

  preloadImages();

  document.addEventListener('DOMContentLoaded', function () {
    fadeIn();
    startAmbientPetals();

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
