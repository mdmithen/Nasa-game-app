/* ============================================================
   Junior Astronaut Mission Trainer - EFFECTS ENGINE
   ------------------------------------------------------------
   This file ONLY adds visuals and motion.
   It never touches the game rules, the numbers, or the scoring.

   What it uses (all built into the browser, nothing to install):
     - Canvas 2D  : the animated space background and the Moon
     - CSS        : the habitat, the astronaut, all keyframes
     - Web Animations API (element.animate) : pop, count-up,
                    reveal, confetti, shake
     - IntersectionObserver : scroll reveals on the Learn screen

   Why no GSAP / Three.js / Anime.js?
     The game has to work by double-clicking index.html with no
     internet. Those libraries are ~600 KB and would not load.
     Canvas + CSS can do all of this natively and instantly.
   ============================================================ */

/* ------------------------------------------------------------
   1. SETTINGS
   ------------------------------------------------------------ */

var FX = {

  // Star counts. Small screens get fewer so phones stay smooth.
  starsWide:  260,
  starsPhone: 120,
  nebulaCount: 3,
  dustWide:   34,
  dustPhone:  16,
  shootingStars: true,

  // Everything runs on ONE requestAnimationFrame loop.
  // One loop is much cheaper than many separate ones.
  maxPixelRatio: 2
};

/* ------------------------------------------------------------
   2. REDUCED MOTION
   If the visitor asked the OS to reduce motion, we draw a single
   still picture instead of animating, and skip UI animations.
   ------------------------------------------------------------ */

var reduceMotion = false;
try {
  reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
} catch (e) {
  reduceMotion = false;
}

var canAnimate = !reduceMotion && typeof window.requestAnimationFrame === 'function';

/* Small helper: animate only when motion is allowed. */
function fxAnimate(element, keyframes, options) {
  if (!element || !canAnimate) { return null; }
  try {
    return element.animate(keyframes, options);
  } catch (e) {
    return null;
  }
}

/* ------------------------------------------------------------
   3. THE SPACE BACKGROUND (Canvas 2D)
   ------------------------------------------------------------ */

var canvas = null;
var ctx = null;
var width = 0;
var height = 0;
var dpr = 1;

var starLayers = [];      // three parallax depths of stars
var dustMotes = [];
var nebulas = [];
var moon = {};
var shootingStars = [];
var nextShootingStar = 3000;
var frameStart = 0;

/* Build the random background objects once. */
function buildScene() {
  var isPhone = width < 700;

  /* --- three layers of stars, from far away to close --- */
  var counts = isPhone
    ? [Math.round(FX.starsPhone * 0.55), Math.round(FX.starsPhone * 0.3), Math.round(FX.starsPhone * 0.15)]
    : [Math.round(FX.starsWide * 0.55), Math.round(FX.starsWide * 0.3), Math.round(FX.starsWide * 0.15)];

  var layerSettings = [
    { size: 0.8, speed: 0.9,  alpha: 0.62, twinkle: 0.6 },
    { size: 1.2, speed: 1.9,  alpha: 0.82, twinkle: 1.0 },
    { size: 1.9, speed: 3.4,  alpha: 1.0,  twinkle: 1.5 }
  ];

  starLayers = [];
  for (var l = 0; l < counts.length; l++) {
    var set = layerSettings[l];
    var stars = [];
    for (var i = 0; i < counts[l]; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random(),
        r: set.size * (0.7 + Math.random() * 0.7),
        base: set.alpha * (0.7 + Math.random() * 0.3),
        twinkleSpeed: set.twinkle * (0.6 + Math.random()),
        twinklePhase: Math.random() * Math.PI * 2
      });
    }
    starLayers.push({ stars: stars, speed: set.speed, size: set.size, alpha: set.alpha });
  }

  /* --- soft colour clouds in the background --- */
  var colours = [
    'rgba(79, 140, 224, 0.16)',
    'rgba(120, 86, 200, 0.13)',
    'rgba(38, 190, 190, 0.11)'
  ];
  nebulas = [];
  for (var n = 0; n < FX.nebulaCount; n++) {
    nebulas.push({
      x: Math.random(),
      y: Math.random(),
      r: 0.28 + Math.random() * 0.3,
      colour: colours[n % colours.length],
      dx: (Math.random() - 0.5) * 0.00004,
      dy: (Math.random() - 0.5) * 0.00003
    });
  }

  /* --- slow floating dust in front of the stars --- */
  var dustCount = isPhone ? FX.dustPhone : FX.dustWide;
  dustMotes = [];
  for (var d = 0; d < dustCount; d++) {
    dustMotes.push({
      x: Math.random(),
      y: Math.random(),
      r: 0.6 + Math.random() * 1.8,
      speed: 0.004 + Math.random() * 0.012,
      sway: 0.2 + Math.random() * 0.6,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.06 + Math.random() * 0.16
    });
  }

  /* --- the Moon, sitting back on the right hand side --- */
  moon = {
    x: isPhone ? width * 0.86 : width * 0.875,
    y: isPhone ? height * 0.13 : height * 0.26,
    r: isPhone ? Math.min(height * 0.18, 120) : Math.min(height * 0.34, 270),
    angle: 0,
    /* kept low on purpose: it is scenery, it must not fight the
       panels or reduce the contrast of any text */
    opacity: isPhone ? 0.32 : 0.46
  };
  moon.craters = buildCraters();
  shootingStars = [];
  nextShootingStar = 2000 + Math.random() * 5000;
}

/* Random craters, placed once so they rotate with the Moon. */
function buildCraters() {
  var craters = [];
  for (var i = 0; i < 26; i++) {
    var angle = Math.random() * Math.PI * 2;
    var distance = Math.sqrt(Math.random()) * 0.88;   // keep them on the disc
    craters.push({
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      r: 0.025 + Math.random() * 0.085,
      depth: 0.35 + Math.random() * 0.5
    });
  }
  return craters;
}

/* Match the canvas to the window size. */
function resizeCanvas() {
  if (!canvas || !ctx) { return; }
  dpr = Math.min(window.devicePixelRatio || 1, FX.maxPixelRatio);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  buildScene();
}

/* ------------------------------------------------------------
   4. DRAWING ONE FRAME
   ------------------------------------------------------------ */

function drawFrame(time) {
  if (!ctx) { return; }

  var t = frameStart ? (time - frameStart) : 0;
  frameStart = time;

  ctx.clearRect(0, 0, width, height);

  /* --- background colour clouds --- */
  for (var n = 0; n < nebulas.length; n++) {
    var nb = nebulas[n];
    nb.x += nb.dx;
    nb.y += nb.dy;
    if (nb.x < -0.2) { nb.dx = Math.abs(nb.dx); }
    if (nb.x > 1.2) { nb.dx = -Math.abs(nb.dx); }
    if (nb.y < -0.2) { nb.dy = Math.abs(nb.dy); }
    if (nb.y > 1.2) { nb.dy = -Math.abs(nb.dy); }

    var nx = nb.x * width;
    var ny = nb.y * height;
    var nr = nb.r * Math.max(width, height);
    var gradient = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
    gradient.addColorStop(0, nb.colour);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(nx - nr, ny - nr, nr * 2, nr * 2);
  }

  /* --- star layers, the far ones drift slowest --- */
  for (var l = 0; l < starLayers.length; l++) {
    var layer = starLayers[l];
    for (var i = 0; i < layer.stars.length; i++) {
      var star = layer.stars[i];
      star.x += star.speed * 0.000006;
      if (star.x > 1.002) { star.x = -0.002; }

      var twinkle = 0.72 + 0.28 * Math.sin(t / 900 * star.twinkleSpeed + star.twinklePhase);
      var alpha = star.base * twinkle;

      var sx = star.x * width;
      var sy = star.y * height;

      ctx.beginPath();
      ctx.arc(sx, sy, star.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(226, 240, 255, ' + alpha.toFixed(3) + ')';
      ctx.fill();

      /* the brightest stars get a tiny glow */
      if (layer.alpha > 0.65 && star.r > 1.5) {
        ctx.beginPath();
        ctx.arc(sx, sy, star.r * 3.2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(160, 210, 255, ' + (alpha * 0.07).toFixed(3) + ')';
        ctx.fill();
      }
    }
  }

  drawMoon(t);

  /* --- slow floating dust --- */
  for (var d = 0; d < dustMotes.length; d++) {
    var mote = dustMotes[d];
    mote.y -= mote.speed * 0.001;
    if (mote.y < -0.02) { mote.y = 1.02; mote.x = Math.random(); }
    var mx = mote.x * width + Math.sin(t / 2600 + mote.phase) * mote.sway * 26;
    var my = mote.y * height;
    ctx.beginPath();
    ctx.arc(mx, my, mote.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(200, 225, 255, ' + mote.alpha.toFixed(3) + ')';
    ctx.fill();
  }

  drawShootingStars(t);
}

/* The Moon: a disc that turns, lit from the upper left. */
function drawMoon(t) {
  if (!moon.r) { return; }

  ctx.save();
  ctx.globalAlpha = moon.opacity;

  /* soft glow around the Moon */
  var glowR = moon.r * 1.9;
  var glow = ctx.createRadialGradient(moon.x, moon.y, moon.r * 0.9, moon.x, moon.y, glowR);
  glow.addColorStop(0, 'rgba(150, 190, 255, 0.16)');
  glow.addColorStop(1, 'rgba(150, 190, 255, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(moon.x, moon.y, glowR, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(moon.x, moon.y);
  ctx.rotate(moon.angle);

  /* the surface */
  var body = ctx.createRadialGradient(-moon.r * 0.3, -moon.r * 0.35, moon.r * 0.1,
                                      0, 0, moon.r);
  body.addColorStop(0, '#d8dde6');
  body.addColorStop(0.55, '#a8aeba');
  body.addColorStop(1, '#6d7484');
  ctx.beginPath();
  ctx.arc(0, 0, moon.r, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();

  /* craters turn with the Moon */
  for (var i = 0; i < moon.craters.length; i++) {
    var c = moon.craters[i];
    var cr = c.r * moon.r;

    ctx.beginPath();
    ctx.arc(c.x * moon.r, c.y * moon.r, cr, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(72, 78, 92, ' + (0.20 * c.depth).toFixed(3) + ')';
    ctx.fill();

    /* the lit edge of the crater */
    ctx.beginPath();
    ctx.arc(c.x * moon.r - cr * 0.18, c.y * moon.r - cr * 0.18, cr * 0.82, Math.PI * 0.9, Math.PI * 1.9);
    ctx.strokeStyle = 'rgba(255, 255, 255, ' + (0.20 * c.depth).toFixed(3) + ')';
    ctx.lineWidth = Math.max(1, moon.r * 0.012);
    ctx.stroke();
  }

  ctx.restore();

  /* night side: this one does NOT rotate, so the light stays put */
  var shade = ctx.createLinearGradient(
    moon.x - moon.r, moon.y - moon.r,
    moon.x + moon.r, moon.y + moon.r
  );
  shade.addColorStop(0, 'rgba(4, 8, 24, 0)');
  shade.addColorStop(0.55, 'rgba(4, 8, 24, 0.18)');
  shade.addColorStop(1, 'rgba(4, 8, 24, 0.72)');
  ctx.beginPath();
  ctx.arc(moon.x, moon.y, moon.r, 0, Math.PI * 2);
  ctx.fillStyle = shade;
  ctx.fill();

  /* bright rim on the lit edge */
  ctx.beginPath();
  ctx.arc(moon.x, moon.y, moon.r - moon.r * 0.012, Math.PI * 0.75, Math.PI * 1.55);
  ctx.strokeStyle = 'rgba(220, 240, 255, 0.30)';
  ctx.lineWidth = Math.max(1, moon.r * 0.014);
  ctx.stroke();

  ctx.restore();

  moon.angle += 0.00007;
}

/* Rare shooting star across the sky. */
function drawShootingStars(t) {
  if (!FX.shootingStars) { return; }

  if (t > nextShootingStar) {
    nextShootingStar = t + 5000 + Math.random() * 9000;
    shootingStars.push({
      x: Math.random() * width * 0.7,
      y: Math.random() * height * 0.45,
      life: 0,
      speed: 0.28 + Math.random() * 0.22,
      length: 90 + Math.random() * 110,
      angle: 0.42 + Math.random() * 0.25
    });
  }

  for (var i = shootingStars.length - 1; i >= 0; i--) {
    var s = shootingStars[i];
    s.life += s.speed;
    if (s.life > 1) { shootingStars.splice(i, 1); continue; }

    var dx = Math.cos(s.angle) * s.speed * 12;
    var dy = Math.sin(s.angle) * s.speed * 12;
    s.x += dx;
    s.y += dy;

    var fade = 1 - s.life;
    var tailX = s.x - Math.cos(s.angle) * s.length * s.life;
    var tailY = s.y - Math.sin(s.angle) * s.length * s.life;

    var line = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
    line.addColorStop(0, 'rgba(220, 245, 255, ' + (0.85 * fade).toFixed(3) + ')');
    line.addColorStop(1, 'rgba(140, 200, 255, 0)');

    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(tailX, tailY);
    ctx.strokeStyle = line;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

/* ------------------------------------------------------------
   5. THE LOOP
   Pauses when the tab is hidden, so it costs nothing in the
   background.
   ------------------------------------------------------------ */

var loopHandle = null;

function loop(time) {
  drawFrame(time);
  loopHandle = window.requestAnimationFrame(loop);
}

function startLoop() {
  if (!canAnimate || loopHandle !== null) { return; }
  loopHandle = window.requestAnimationFrame(loop);
}

function stopLoop() {
  if (loopHandle !== null) {
    window.cancelAnimationFrame(loopHandle);
    loopHandle = null;
  }
}

/* ------------------------------------------------------------
   6. UI MOTION
   Small helpers used by the rest of this file.
   ------------------------------------------------------------ */

function stagger(elements, options) {
  var i = 0;
  for (var e = 0; e < elements.length; e++) {
    (function (index, element) {
      setTimeout(function () {
        fxAnimate(element, [
          { opacity: 0, transform: 'translateY(16px)' },
          { opacity: 1, transform: 'translateY(0)' }
        ], {
          duration: (options && options.duration) || 420,
          delay: index * (options && options.stagger) || 0,
          easing: 'cubic-bezier(.22,.9,.3,1)',
          fill: 'backwards'
        });
      }, 0);
    })(i++, elements[e]);
  }
}

/* A soft click ripple, added to every button. */
var ripplesInstalled = false;
function addRipples() {
  if (ripplesInstalled) { return; }
  ripplesInstalled = true;

  var buttons = document.querySelectorAll('button');
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].addEventListener('click', function (event) {
      var button = event.currentTarget;
      if (!canAnimate) { return; }

      var box = button.getBoundingClientRect();
      var size = Math.max(box.width, box.height) * 2.2;
      var ripple = document.createElement('span');
      ripple.className = 'fx-ripple';
      ripple.style.width = size + 'px';
      ripple.style.height = size + 'px';
      ripple.style.left = (event.clientX - box.left - size / 2) + 'px';
      ripple.style.top = (event.clientY - box.top - size / 2) + 'px';
      button.appendChild(ripple);
      setTimeout(function () { if (ripple.parentNode) { ripple.parentNode.removeChild(ripple); } }, 620);
    });
  }
}

/* Welcome title and subtitle slide in once. */
function animateWelcome() {
  var title = document.querySelector('#screen-welcome h1');
  var subtitle = document.querySelector('#screen-welcome .subtitle');
  var intro = document.querySelector('#screen-welcome .intro');
  var actions = document.querySelector('#screen-welcome .welcome-actions');

  if (title) {
    fxAnimate(title, [
      { opacity: 0, transform: 'translateY(26px) scale(.97)', filter: 'blur(6px)' },
      { opacity: 1, transform: 'translateY(0) scale(1)', filter: 'blur(0px)' }
    ], { duration: 760, delay: 120, easing: 'cubic-bezier(.2,.9,.25,1)', fill: 'backwards' });
  }
  if (subtitle) {
    fxAnimate(subtitle, [
      { opacity: 0, transform: 'translateX(-18px)' },
      { opacity: 1, transform: 'translateX(0)' }
    ], { duration: 620, delay: 340, easing: 'cubic-bezier(.2,.9,.25,1)', fill: 'backwards' });
  }
  if (intro) {
    fxAnimate(intro, [
      { opacity: 0, transform: 'translateY(14px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ], { duration: 620, delay: 460, easing: 'ease-out', fill: 'backwards' });
  }
  if (actions) {
    fxAnimate(actions, [
      { opacity: 0, transform: 'translateY(14px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ], { duration: 560, delay: 600, easing: 'ease-out', fill: 'backwards' });
  }
}

/* Cards lift in one after another when the dashboard appears. */
function revealDashboard() {
  var panels = document.querySelectorAll('#screen-game .hud-card');
  stagger(panels, { duration: 460, stagger: 90 });

  var cards = document.querySelectorAll('#screen-game .res-card, #screen-game .hud-chip');
  stagger(cards, { duration: 420, stagger: 45 });
}

/* A small pop on resource cards whenever they update. */
function watchResourceCards() {
  var grid = document.getElementById('resource-grid');
  if (!grid || typeof MutationObserver === 'undefined') { return; }

  var observer = new MutationObserver(function () {
    var cards = grid.querySelectorAll('.res-card');
    for (var i = 0; i < cards.length; i++) {
      fxAnimate(cards[i], [
        { transform: 'scale(1)' },
        { transform: 'scale(1.035)' },
        { transform: 'scale(1)' }
      ], { duration: 320, easing: 'ease-out' });
    }

    /* a sweep of light across the progress bar when it fills */
    var fill = document.getElementById('progress-fill');
    if (fill) {
      fxAnimate(fill, [
        { filter: 'brightness(2.1)' },
        { filter: 'brightness(1)' }
      ], { duration: 620, easing: 'ease-out' });
    }
  });

  observer.observe(grid, { childList: true });
}

/* The decision panel slides in when a new event appears. */
function watchEventPanel() {
  var options = document.getElementById('event-options');
  if (!options || typeof MutationObserver === 'undefined') { return; }

  var observer = new MutationObserver(function () {
    var buttons = options.querySelectorAll('.btn-option');
    stagger(buttons, { duration: 380, stagger: 85 });

    var title = document.getElementById('event-title');
    if (title) {
      fxAnimate(title, [
        { opacity: 0, transform: 'translateY(-10px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ], { duration: 380, easing: 'ease-out' });
    }
  });

  observer.observe(options, { childList: true });
}

/* Learn cards fade up as you scroll to them. */
function revealCard(element, index) {
  if (element.getAttribute('data-fx-revealed')) { return; }
  element.setAttribute('data-fx-revealed', '1');

  fxAnimate(element, [
    { opacity: 0, transform: 'translateY(24px)' },
    { opacity: 1, transform: 'translateY(0)' }
  ], {
    duration: 520,
    delay: Math.min(index, 5) * 60,
    easing: 'cubic-bezier(.2,.9,.3,1)',
    /* 'both' is required: the card starts at opacity 0 in CSS,
       so without a final fill it would blink back to invisible. */
    fill: 'both'
  });
}

function watchLearnCards() {
  var cards = document.querySelectorAll('#screen-learn .learn-card');
  if (!cards.length) { return; }

  /* Called again every time the screen is opened, so stop the
     scroll listeners piling up. */
  if (watchLearnCards.installed) {
    for (var k = 0; k < cards.length; k++) { revealCard(cards[k], k); }
    return;
  }
  watchLearnCards.installed = true;

  for (var i = 0; i < cards.length; i++) {
    cards[i].classList.add('reveal-on-scroll');
  }

  if (!canAnimate || typeof IntersectionObserver === 'undefined') { return; }

  var observer = new IntersectionObserver(function (entries) {
    for (var e = 0; e < entries.length; e++) {
      if (entries[e].isIntersecting) {
        revealCard(entries[e].target,
          Array.prototype.indexOf.call(cards, entries[e].target));
        observer.unobserve(entries[e].target);
      }
    }
  }, { threshold: 0.05, rootMargin: '0px 0px -8% 0px' });

  for (var c = 0; c < cards.length; c++) { observer.observe(cards[c]); }

  /* Safety net. If someone jumps straight to the bottom of the
     page (End key, anchor link, restore scroll position) the
     cards they skipped never intersect, so they would stay at
     opacity 0. This sweep reveals anything already at or above
     the fold. */
  var ticking = false;

  function sweep() {
    ticking = false;
    for (var s = 0; s < cards.length; s++) {
      /* Reveal anything whose top has reached the fold. Cards
         already scrolled past are included on purpose (their top
         is far above the fold), otherwise a jump to the bottom
         of the page would leave the skipped ones invisible. */
      if (cards[s].getBoundingClientRect().top < window.innerHeight * 0.96) {
        revealCard(cards[s], s);
      }
    }
  }

  function requestSweep() {
    if (ticking) { return; }
    ticking = true;
    window.requestAnimationFrame(sweep);
  }

  window.addEventListener('scroll', requestSweep, { passive: true });
  window.addEventListener('resize', requestSweep);
  setTimeout(sweep, 60);
}

/* ------------------------------------------------------------
   7. END OF MISSION SEQUENCES
   ------------------------------------------------------------ */

function burstConfetti() {
  if (!canAnimate) { return; }

  var colours = ['#4fd1e0', '#6aa6ff', '#ffffff', '#ffd166', '#4ade80', '#a78bfa'];
  var count = window.innerWidth < 700 ? 45 : 80;

  for (var i = 0; i < count; i++) {
    var piece = document.createElement('span');
    piece.className = 'fx-confetti';
    piece.style.background = colours[i % colours.length];

    /* start at the score ring and spread outwards fast */
    var angle = Math.random() * Math.PI * 2;
    var distance = 160 + Math.random() * Math.max(window.innerWidth, 460) * 0.5;

    piece.style.left = '50%';
    piece.style.top = '25%';

    var fall = 300 + Math.random() * 460;
    var drift = Math.cos(angle) * distance;

    fxAnimate(piece, [
      { transform: 'translate(0px, 0px) rotate(0deg) scale(1)', opacity: 1 },
      { transform: 'translate(' + drift + 'px, ' + fall + 'px) rotate(' + (Math.random() * 900 - 450) + 'deg) scale(0.6)', opacity: 0 }
    ], {
      duration: 1300 + Math.random() * 900,
      delay: Math.random() * 320,
      easing: 'cubic-bezier(.2,.6,.4,1)',
      fill: 'forwards'
    });

    document.body.appendChild(piece);
    (function (node) {
      setTimeout(function () { if (node.parentNode) { node.parentNode.removeChild(node); } }, 3200);
    })(piece);
  }
}

function flashScreen(colour) {
  if (!canAnimate) { return; }
  var flash = document.createElement('div');
  flash.className = 'fx-flash';
  flash.style.background = colour;
  document.body.appendChild(flash);
  fxAnimate(flash, [{ opacity: 0 }, { opacity: 0.55 }, { opacity: 0 }],
    { duration: 900, easing: 'ease-out' });
  setTimeout(function () { if (flash.parentNode) { flash.parentNode.removeChild(flash); } }, 1000);
}

function shakeCard() {
  var card = document.querySelector('#screen-result .result-card');
  if (!card) { return; }
  fxAnimate(card, [
    { transform: 'translateX(0)' },
    { transform: 'translateX(-9px)' },
    { transform: 'translateX(8px)' },
    { transform: 'translateX(-5px)' },
    { transform: 'translateX(0)' }
  ], { duration: 460, easing: 'ease-in-out' });
}

/* Count the score up instead of snapping to it. */
function countUpScore(target) {
  var node = document.getElementById('score-number');
  if (!node) { return; }
  if (!canAnimate) { node.textContent = target; return; }

  var start = performance.now();
  var duration = 1100;

  function step(now) {
    var progress = Math.min((now - start) / duration, 1);
    var eased = 1 - Math.pow(1 - progress, 3);
    node.textContent = Math.round(target * eased);
    if (progress < 1) { window.requestAnimationFrame(step); }
  }
  window.requestAnimationFrame(step);
}

/* Watch the results screen and play the right ending. */
function watchResultScreen() {
  var screen = document.getElementById('screen-result');
  if (!screen || typeof MutationObserver === 'undefined') { return; }

  var played = false;

  var observer = new MutationObserver(function () {
    /* screen is hidden again -> arm the ending for the next mission */
    if (screen.hidden) { played = false; return; }
    if (played) { return; }
    played = true;

    var succeeded = document.getElementById('result-title').textContent.indexOf('Success') >= 0;

    stagger(document.querySelectorAll('#screen-result .result-card-mini'),
      { duration: 420, stagger: 70 });

    var ring = document.getElementById('score-ring');
    if (ring) {
      fxAnimate(ring, [
        { transform: 'scale(0.72)', opacity: 0 },
        { transform: 'scale(1.04)', opacity: 1, offset: 0.72 },
        { transform: 'scale(1)', opacity: 1 }
      ], { duration: 700, easing: 'cubic-bezier(.2,.9,.3,1)' });
    }

    /* Read the score at the moment the count-up starts, not
       earlier, so it can never animate to a stale number. */
    setTimeout(function () {
      countUpScore(Number(document.getElementById('score-number').textContent) || 0);
    }, 260);

    if (succeeded) {
      setTimeout(function () { flashScreen('radial-gradient(circle at 50% 40%, rgba(79,209,224,.55), transparent 65%)'); }, 200);
      setTimeout(burstConfetti, 420);
    } else {
      setTimeout(function () { flashScreen('radial-gradient(circle at 50% 40%, rgba(251,113,133,.5), transparent 65%)'); }, 200);
      setTimeout(shakeCard, 320);
    }
  });

  observer.observe(screen, { attributes: true, attributeFilter: ['hidden'] });
}

/* ------------------------------------------------------------
   8. SCREEN TRANSITIONS
   We wrap the game's own showScreen() function instead of editing
   it, so the game logic file stays exactly as it was.
   ------------------------------------------------------------ */

function installScreenTransitions() {
  if (typeof window.showScreen !== 'function') { return; }
  if (window.__fxTransitionsInstalled) { return; }
  window.__fxTransitionsInstalled = true;

  var original = window.showScreen;

  /* The transition that is currently fading out, so that a newer
     screen request can stop it. Without these two handles the 340ms
     timer below is invisible: a later showScreen() call cannot cancel
     an earlier one, so the old timer fires afterwards and drags the
     player back to the screen they had already left. */
  var pendingTimer = null;
  var pendingFade = null;

  function cancelPending() {
    if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }
    /* cancelling the fade returns the screen to its normal opacity, so
       the screen we stay on is not left invisible */
    if (pendingFade) {
      if (typeof pendingFade.cancel === 'function') { pendingFade.cancel(); }
      pendingFade = null;
    }
  }

  window.showScreen = function (name) {
    /* the newest request always wins */
    cancelPending();

    if (!canAnimate) { original(name); return; }

    var current = document.querySelector('.screen:not([hidden])');
    var next = document.getElementById('screen-' + name);

    if (!current || current === next) {
      original(name);
      onScreenChanged(name);
      return;
    }

    /* fade the old screen out first */
    var animation = fxAnimate(current, [
      { opacity: 1, transform: 'translateY(0)', filter: 'blur(0px)' },
      { opacity: 0, transform: 'translateY(-14px)', filter: 'blur(5px)' }
    ], { duration: 260, easing: 'ease-in', fill: 'forwards' });

    /* fade the old screen out, swap, fade the new one in.
       `done` stops the timer and the onfinish callback from
       both running the swap. */
    var done = false;

    function finish() {
      if (done) { return; }
      done = true;
      if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }
      pendingFade = null;

      original(name);
      onScreenChanged(name);

      fxAnimate(next, [
        { opacity: 0, transform: 'translateY(20px)', filter: 'blur(6px)' },
        { opacity: 1, transform: 'translateY(0)', filter: 'blur(0px)' }
      ], { duration: 420, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'backwards' });
    }

    pendingFade = animation;
    if (animation) { animation.onfinish = finish; }
    pendingTimer = setTimeout(finish, 340);
  };
}

function onScreenChanged(name) {
  /* The 2D game draws its own sky on #game-canvas. Hide this file's
     animated background while the game is on screen, otherwise you
     would see two skies fighting each other. The landing map keeps
     the starfield, because it is drawn on top of it. */
  var sky = document.getElementById('space-bg');
  var vign = document.querySelector('.vignette');
  var hiding = (name === 'game');
  if (sky) { sky.style.display = hiding ? 'none' : ''; }
  if (vign) { vign.style.display = hiding ? 'none' : ''; }

  /* The map runs its own loop, and only while it is the visible
     screen, so leaving it has to stop that loop. */
  if (name !== 'map' && typeof mapStop === 'function') { mapStop(); }

  if (name === 'game') { revealDashboard(); }
  if (name === 'learn') { watchLearnCards(); }
}

/* ------------------------------------------------------------
   9. POINTER PARALLAX ON THE WELCOME SCENE
   The Moon base moves a little with the mouse. Very subtle.
   ------------------------------------------------------------ */

function addPointerParallax() {
  if (!canAnimate) { return; }

  /* Only the children move with the pointer. The parent .base keeps
     its own CSS float animation, and nested transforms compose
     cleanly, so the two never fight each other. */
  var dome = document.querySelector('#screen-welcome .dome');
  var panel = document.querySelector('#screen-welcome .solar-array');
  var antenna = document.querySelector('#screen-welcome .antenna');
  if (!dome && !panel) { return; }

  var frame = null;
  var targetX = 0;
  var targetY = 0;
  var currentX = 0;
  var currentY = 0;

  function onMove(event) {
    targetX = (event.clientX / window.innerWidth - 0.5) * 2;
    targetY = (event.clientY / window.innerHeight - 0.5) * 2;
    if (frame === null) { frame = window.requestAnimationFrame(tick); }
  }

  function tick() {
    currentX += (targetX - currentX) * 0.07;
    currentY += (targetY - currentY) * 0.07;

    if (dome) {
      dome.style.transform = 'translate(' + (currentX * 5).toFixed(2) + 'px, ' + (currentY * 3).toFixed(2) + 'px)';
    }
    if (panel) {
      panel.style.transform = 'skewY(-9deg) translate(' + (currentX * -8).toFixed(2) + 'px, ' + (currentY * 4).toFixed(2) + 'px)';
    }
    if (antenna) {
      antenna.style.transform = 'translateX(-50%) translateY(' + (currentY * -4).toFixed(2) + 'px)';
    }

    if (Math.abs(targetX - currentX) > 0.002 || Math.abs(targetY - currentY) > 0.002) {
      frame = window.requestAnimationFrame(tick);
    } else {
      frame = null;
    }
  }

  window.addEventListener('pointermove', onMove, { passive: true });
}

/* ------------------------------------------------------------
   10. START EVERYTHING
   ------------------------------------------------------------ */

function initFx() {
  /* If the browser has no canvas support the game still works,
     it just gets a plain background instead of the starfield. */
  canvas = document.getElementById('space-bg');
  if (canvas && canvas.getContext) {
    ctx = canvas.getContext('2d');
  }

  if (ctx) {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    /* stop burning CPU when the tab is in the background */
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { stopLoop(); }
      else if (canvas.offsetParent !== null || !document.hidden) { startLoop(); }
    });

    if (canAnimate) {
      startLoop();
    } else {
      /* draw one still frame so the Moon is still there */
      drawFrame(0);
    }
  }

  animateWelcome();
  addRipples();
  addPointerParallax();
  watchResourceCards();
  watchEventPanel();
  watchResultScreen();
  installScreenTransitions();
}

/* Wait until the page is ready, then start. */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFx);
} else {
  initFx();
}

/* Screen transitions can only be installed once script.js has
   defined showScreen, so wait for the whole page to load. */
window.addEventListener('load', function () {
  installScreenTransitions();
});