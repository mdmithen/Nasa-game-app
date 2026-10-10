/* ============================================================
   Junior Astronaut Mission Trainer - 2D WORLD ENGINE
   ------------------------------------------------------------
   This file draws the Moon Base and moves the astronaut around.
   It does NOT decide game rules.

   It reads the mission state from `game` (written by script.js)
   and it calls back into script.js when the player interacts
   with a station. Every change to oxygen, water, food, power or
   score still happens inside script.js, exactly as before.

   HOW THE FILES FIT TOGETHER
     sprites.js  - where each frame is inside sprites.png
     script.js   - the rules, the numbers, the score  (written first)
     world.js    - this file: the 2D scene and the player
     fx.js       - the animated background for the other screens
   ============================================================ */

/* ------------------------------------------------------------
   1. WORLD SETTINGS
   ------------------------------------------------------------ */

var CFG = {
  worldWidth: 2500,      // how wide the Moon Base stretches
  groundY: 520,          // the ground line, in world pixels
  viewHeight: 620,       // world pixels from the ground up to the sky

  /* ------------------------------------------------------------
     LUNAR PHYSICS
     The Moon pulls at 1.62 m/s2 against Earth's 9.81 m/s2, so lunar
     gravity is 1/6 (about 0.166) of the pull we feel at home.

     The very first value here, 0.62, was a snappy Earth-like
     platformer pull, and 0.21 was still quick and floaty. Dividing
     either by six turns every jump into an unplayable hover, so the
     pull is softened by hand and every other number is tuned beside
     it rather than scaled by one factor.

     Measured result (at 60 frames a second):
       walking speed   216 -> 108 px/s   (exactly half)
       full speed      133ms -> 283ms to build up, 233ms to stop
       jump height     134px -> 302px
       airtime         0.70s -> 2.58s   (rise 1.30s, fall 1.28s)
       fall speed      0.33s -> 1.28s
     ------------------------------------------------------------ */
  gravity: 0.14,         // the slow lunar pull, in pixels per frame

  jumpSpeed: -8.6,       // tuned for the new gravity, never scaled from the old

  /* A jump is not one instant. The first few frames use a fraction of
     gravity, which reads as a heavy suit pushing off slowly, and the
     frames around the top of the arc use a smaller fraction again,
     which is the long weightless float before the slow descent. */
  takeoffFrames: 6,      // length of the soft push-off
  takeoffGravity: 0.30,  // gravity scale during the push-off
  apexBand: 1.2,         // |vy| below this counts as the floating phase
  apexGravity: 0.40,     // gravity scale while floating at the top

  maxFallSpeed: 9,       // terminal velocity, so nothing tunnels through a floor

  /* ---- horizontal movement ----
     A suited astronaut on the Moon is heavy: slow to get going, and
     slow to turn around. Air steering is weaker again so a long jump
     can be aimed but never turned into flight. */
  moveAccel: 0.11,       // a heavy, weighty build-up to walking pace
  moveDecel: 0.10,       // coasts to a stop instead of stopping dead
  airAccel: 0.10,        // weaker steering in the air: aimable, not flying
  airFriction: 0.985,    // a slow drift is kept while airborne
  maxSpeed: 1.8,         // half of the old 4.4 -> 3.6 -> 1.8: a lunar amble

  bodyWidth: 40,         // the astronaut's collision box
  bodyHeight: 74,

  walkSpeedForAnim: 0.3, // above this the walk cycle plays
  walkCycleFrames: 32,   // frames for a whole stride: a slow, deliberate pace
  walkDustEvery: 34,     // spacing of the little dust puffs while walking

  /* ---- low-gravity animation ---- */
  floatBob: 4.2,         // px of gentle drift at the top of a jump
  floatSway: 0.06,       // radians of tilt while floating
  airTilt: 0.011,        // tilt that follows the vertical speed
  landFrames: 18,        // how long the soft landing plays

  interactRange: 78,     // how close you must be to press E
  coyoteTime: 8,         // frames of grace to still jump after leaving ground
  jumpBuffer: 7,         // frames a jump press is remembered before landing

  camHeadMargin: 22,     /* pixels kept between the helmet and the top edge */

  /* How much room one placed structure takes on the ground. A station
     sprite is 96 pixels wide and drawn centred on its x, so the half
     width is 48. Terrain keeps this far away from that box, which is
     what stops a rock from ever appearing underneath a structure. */
  stationHalfWidth: 48,
  stationClearance: 36
};

/* ------------------------------------------------------------
   2. THE STRUCTURE CATALOG AND THE BASE LAYOUT
   There are two separate things here, and keeping them apart is what
   lets a base be designed before the mission starts:

     STATION_TYPES  - the catalogue. WHAT a structure is: its name,
                      its sprite and how many of it one base may hold.
                      There is deliberately no position in here.

     baseLayout     - the player's base. WHERE the structures stand:
                      one entry per placed structure.

   STATIONS below is built from the two, and is what the rest of this
   file (and script.js) actually walks around and draws. It is never
   edited by hand.
   ------------------------------------------------------------ */

/* `limit` is how many of that type a single base may hold. Critical
   life-support systems are capped at 1 because a second oxygen plant
   or a second mission console would not give the crew anything extra.
   Solar arrays and supply depots scale with a bigger base, so more
   than one of those is allowed. */
var STATION_TYPES = [
  { id: 'habitat', name: 'Habitat',         limit: 1, sprite: 'station_habitat', blurb: 'Crew quarters and life support.' },
  { id: 'oxygen',  name: 'Oxygen System',   limit: 1, sprite: 'station_oxygen',  blurb: 'Makes and stores breathable air.' },
  { id: 'water',   name: 'Water Recycler',  limit: 1, sprite: 'station_water',   blurb: 'Cleans and reuses water.' },
  { id: 'food',    name: 'Food Station',    limit: 1, sprite: 'station_food',    blurb: 'Hydroponics and food stores.' },
  { id: 'solar',   name: 'Solar Panels',    limit: 3, sprite: 'station_solar_ok', solar: true, blurb: 'Turns sunlight into electricity.' },
  { id: 'depot',   name: 'Supply Depot',    limit: 3, sprite: 'station_depot',   blurb: 'Spare parts, rations and the rover.' },
  { id: 'console', name: 'Mission Console', limit: 1, sprite: 'station_console', blurb: 'Mission objectives and status.' }
];

/* Fast lookup by type id, so resolving a layout entry never walks the
   whole catalogue. */
var STATION_TYPE_INDEX = {};
for (var t = 0; t < STATION_TYPES.length; t++) {
  STATION_TYPE_INDEX[STATION_TYPES[t].id] = STATION_TYPES[t];
}

/* The base the player starts with, in the same order and at the same
   places as the old hard-coded station list, so the opening scene is
   unchanged. A later phase lets the player move these around. */
var DEFAULT_LAYOUT = [
  { uid: 'built-1', type: 'habitat', x: 300 },
  { uid: 'built-2', type: 'oxygen',  x: 620 },
  { uid: 'built-3', type: 'water',   x: 940 },
  { uid: 'built-4', type: 'food',    x: 1260 },
  { uid: 'built-5', type: 'solar',   x: 1580 },
  { uid: 'built-6', type: 'depot',   x: 1900 },
  { uid: 'built-7', type: 'console', x: 2220 }
];

/* The base as it stands right now. world.applyLayout() replaces it. */
var baseLayout = [];

/* The placed structures, derived from the catalogue and the layout.
   `id` is the unique id of that one placed structure, and `type` is
   what kind of structure it is. Which scenario a day hosts is decided
   by type, so a base with two depots shows the marker on both. */
var STATIONS = [];

function copyLayout(list) {
  var out = [];
  for (var i = 0; i < list.length; i++) {
    out.push({ uid: list[i].uid, type: list[i].type, x: list[i].x });
  }
  return out;
}

function buildStations() {
  /* emptied in place, never reassigned, so anything already holding a
     reference to this array keeps seeing the current base */
  STATIONS.length = 0;

  for (var i = 0; i < baseLayout.length; i++) {
    var item = baseLayout[i];
    var type = STATION_TYPE_INDEX[item.type];

    /* An unknown type is skipped rather than thrown, so a bad saved
       layout can never stop the game from starting. */
    if (!type) { continue; }

    STATIONS.push({
      id: item.uid,             /* unique to this one structure */
      type: item.type,          /* what kind it is             */
      name: type.name,
      sprite: type.sprite,
      solar: !!type.solar,
      blurb: type.blurb,
      x: item.x
    });
  }
}

/* Which scenario happens at which structure type, and what a plain
   service visit does, are decided in script.js (the rules file).
   This file only draws the structures and moves the player. */

/* ------------------------------------------------------------
   3. SPRITES
   The PNG is loaded once. If it ever fails to load, we draw
   simple shapes instead so the game still works.
   ------------------------------------------------------------ */

var sheetImage = null;
var spritesReady = false;

function loadSprites() {
  sheetImage = new Image();
  sheetImage.onload = function () { spritesReady = true; };
  sheetImage.onerror = function () {
    /* no crash: fall back to drawn shapes */
    sheetImage = null;
    spritesReady = false;
  };
  sheetImage.src = 'assets/sprites.png';
}

/* Draw one named frame from the sheet. */
function drawSprite(ctx, name, x, y, w, h) {
  if (spritesReady && sheetImage && SPRITE_MAP[name]) {
    var f = SPRITE_MAP[name];
    ctx.drawImage(sheetImage, f.x, f.y, f.w, f.h, x, y, w, h);
    return true;
  }
  return false;
}

/* --- fallback drawing, used only if the PNG is missing --- */

/* --- fallback drawing, used only if the PNG is missing ---
   Drawn around the current canvas origin, where (0,0) is the soles
   of the boots, so the lean, float and squash transforms applied to
   the real sprite work here as well. */
function fallbackAstronaut(ctx, colour) {
  var swingNow = 0;
  if (hero.state === 'walk') { swingNow = Math.sin(hero.walkTimer / 8 * Math.PI * 2) * 0.5; }
  else if (hero.state === 'jump') { swingNow = hero.vy < 0 ? -0.5 : 0.35; }

  ctx.save();
  ctx.fillStyle = colour || '#e8eef8';
  ctx.strokeStyle = '#28304a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-11, -46, 22, 26, 7);
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -58, 12, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#2a7fb8';
  ctx.beginPath();
  ctx.arc(2, -58, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colour || '#c3ccdb';
  ctx.save();
  ctx.translate(-6, -20);
  ctx.rotate(swingNow);
  ctx.fillRect(-3.5, 0, 7, 20);
  ctx.restore();
  ctx.save();
  ctx.translate(6, -20);
  ctx.rotate(-swingNow);
  ctx.fillRect(-3.5, 0, 7, 20);
  ctx.restore();
  ctx.restore();
}

function fallbackStation(ctx, id, x, groundY) {
  ctx.save();
  ctx.fillStyle = '#9fb0c6';
  ctx.strokeStyle = '#28304a';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(x - 34, groundY - 60, 68, 60, 8);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#4fd1e0';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(id.toUpperCase(), x, groundY - 26);
  ctx.restore();
}

/* ------------------------------------------------------------
   4. THE PLAYER
   ------------------------------------------------------------ */

var hero = {
  x: 240,
  y: CFG.groundY,      /* y is the FEET position */
  vx: 0,
  vy: 0,
  onGround: true,
  facing: 1,           /* 1 = right, -1 = left */
  walkFrame: 0,
  walkTimer: 0,
  idleTimer: 0,
  jumpType: 'jump_rise',
  landTimer: 0,
  landPower: 0,        /* how hard the landing was, 0 to 1 */
  workTimer: 0,        /* frames of the standing repair animation left */
  coyote: 0,
  takeoff: 0,          /* frames of the soft push-off left in a jump */
  jumpBuffer: 0,       /* a jump press waiting for the ground */
  floatT: 0,           /* drives the gentle float at the top of a jump */
  floatAmount: 0,      /* how weightless the astronaut is right now */
  state: 'idle',       /* idle | walk | jump | land | work | wave */
  dustTimer: 0
};

/* ------------------------------------------------------------
   5. TERRAIN
   Rocks you cannot walk through, and crates you can jump on.
   ------------------------------------------------------------ */

var solids = [];
var platforms = [];
var pickups = [];
var particles = [];

/* True when a piece of ground of this width at this x would not run
   into any placed structure. */
function clearOfStations(x, w) {
  var left = x - CFG.stationClearance;
  var right = x + w + CFG.stationClearance;
  for (var i = 0; i < STATIONS.length; i++) {
    var s = STATIONS[i];
    var sLeft = s.x - CFG.stationHalfWidth;
    var sRight = s.x + CFG.stationHalfWidth;
    if (right > sLeft && left < sRight) { return false; }
  }
  return true;
}

function buildTerrain() {
  solids = [];
  platforms = [];
  pickups = [];
  particles = [];

  /* Rocks you have to jump over. A candidate that would end up sitting
     under a placed structure is skipped, so no matter how the base is
     laid out the player never sees terrain hidden behind a building.
     With the starting layout none of these are skipped and the scene
     is exactly what it always was. */
  var rockData = [
    { x: 140, w: 38, h: 22 }, { x: 470, w: 54, h: 34 }, { x: 1090, w: 44, h: 26 },
    { x: 1420, w: 62, h: 40 }, { x: 1750, w: 40, h: 24 }, { x: 2060, w: 52, h: 32 }
  ];
  for (var i = 0; i < rockData.length; i++) {
    var r = rockData[i];
    if (!clearOfStations(r.x, r.w)) { continue; }
    solids.push({ x: r.x, y: CFG.groundY - r.h, w: r.w, h: r.h });
  }

  /* NOTE: the stations themselves are deliberately NOT solid.
     You walk in front of them, like any side-scrolling game. Only
     the rocks above stop you. */

  /* Floating crates you can jump up onto.
     Spacing and height are chosen so every one is reachable: with the
     lunar jump the feet clear about 302px and carry about 280px
     sideways, and the highest canisters are still inside that arc. */
  var crateData = [
    { x: 540, y: 400 }, { x: 760, y: 400 },
    { x: 1160, y: 400 }, { x: 1340, y: 340 },
    { x: 1650, y: 400 }, { x: 1870, y: 340 },
    { x: 2130, y: 400 }
  ];
  for (var c = 0; c < crateData.length; c++) {
    platforms.push({ x: crateData[c].x, y: crateData[c].y, w: 74, h: 18, taken: false });
  }

  /* Canisters to collect, each one sitting just above a crate so
     you have to jump for it. */
  var pickData = [
    { x: 600, y: 340 }, { x: 800, y: 350 }, { x: 1200, y: 340 },
    { x: 1380, y: 275 }, { x: 1690, y: 350 }, { x: 1910, y: 275 },
    { x: 2170, y: 340 }, { x: 460, y: 340 }
  ];
  for (var p = 0; p < pickData.length; p++) {
    pickups.push({ x: pickData[p].x, y: pickData[p].y, taken: false, bob: Math.random() * 6 });
  }
}

/* ------------------------------------------------------------
   6. INPUT
   A Set of held keys means two keys can never fight over the
   same action: the game asks "is left held?" and "is right held?"
   rather than reacting to each keypress separately.
   ------------------------------------------------------------ */

var keys = {};
var touchState = { left: false, right: false, jump: false, interact: false };

function held(name) { return !!keys[name]; }

function setupInput() {
  var handled = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space', 'KeyA', 'KeyD',
                 'KeyW', 'KeyE', 'Escape', 'Enter'];

  window.addEventListener('keydown', function (e) {
    if (handled.indexOf(e.code) >= 0) { e.preventDefault(); }
    if (keys[e.code]) { return; }        /* ignore auto-repeat */
    keys[e.code] = true;

    /* one-shot actions */
    if (e.code === 'KeyE' || e.code === 'Enter') { tryInteract(); }
    if (e.code === 'Escape') { togglePause(); }
    if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'Space') { requestJump(); }
  });

  window.addEventListener('keyup', function (e) { keys[e.code] = false; });
  window.addEventListener('blur', function () { keys = {}; });

  /* on-screen buttons for phones */
  var padButtons = document.querySelectorAll('[data-touch]');
  for (var i = 0; i < padButtons.length; i++) {
    (function (btn) {
      var action = btn.getAttribute('data-touch');
      function down(e) {
        e.preventDefault();
        touchState[action] = true;
        if (action === 'jump') { requestJump(); }
        if (action === 'interact') { tryInteract(); }
        btn.classList.add('pressed');
      }
      function up(e) {
        e.preventDefault();
        touchState[action] = false;
        btn.classList.remove('pressed');
      }
      btn.addEventListener('touchstart', down, { passive: false });
      btn.addEventListener('touchend', up, { passive: false });
      btn.addEventListener('touchcancel', up, { passive: false });
      btn.addEventListener('mousedown', down);
      btn.addEventListener('mouseup', up);
      btn.addEventListener('mouseleave', up);
    })(padButtons[i]);
  }
}

function moveLeft() { return held('ArrowLeft') || held('KeyA') || touchState.left; }
function moveRight() { return held('ArrowRight') || held('KeyD') || touchState.right; }

/* A jump press made a moment before touching down is remembered for a
   few frames, so a jump that is pressed slightly early still happens.
   This is what keeps the low-gravity controls feeling responsive. */
function requestJump() {
  if (!world.running || world.paused) { return; }
  if (hero.onGround || hero.coyote > 0) { doJump(); return; }
  hero.jumpBuffer = CFG.jumpBuffer;
}

function doJump() {
  if (!world.running || world.paused) { return; }

  /* A jump needs ground under the boots. The coyote window is the short
     grace period after walking off a ledge, and it is the ONLY moment
     a jump is allowed in mid-air. Without this check the astronaut
     could keep jumping forever and never come down. */
  if (!hero.onGround && hero.coyote <= 0) { return; }

  hero.vy = CFG.jumpSpeed;
  hero.takeoff = CFG.takeoffFrames;   /* soft push off, not an instant launch */
  hero.onGround = false;
  hero.coyote = 0;
  hero.jumpBuffer = 0;
  hero.floatT = 0;
  puff(hero.x, hero.y, 7);
}

/* ------------------------------------------------------------
   7. STATION INTERACTION
   ------------------------------------------------------------ */

var nearbyStation = null;

function nearestStation() {
  for (var i = 0; i < STATIONS.length; i++) {
    var s = STATIONS[i];
    if (Math.abs(hero.x - s.x) <= CFG.interactRange) { return s; }
  }
  return null;
}

function tryInteract() {
  if (!world.running || world.paused) { return; }
  var s = nearestStation();
  if (!s) { return; }
  /* hand over to the rules file */
  if (typeof openStation === 'function') { openStation(s.id); }
}

/* ------------------------------------------------------------
   8. PARTICLES
   Small cartoon puffs for dust, landing and repairs.
   ------------------------------------------------------------ */

function puff(x, y, count) {
  for (var i = 0; i < count; i++) {
    var a = Math.random() * Math.PI;
    particles.push({
      x: x + (Math.random() - 0.5) * 22,
      y: y - Math.random() * 8,
      vx: Math.cos(a) * (0.6 + Math.random() * 1.6),
      vy: Math.sin(a) * (0.4 + Math.random()) - 0.6,
      life: 1,
      r: 2 + Math.random() * 4,
      colour: 'rgba(206,216,232,'
    });
  }
}

function sparkle(x, y, count) {
  for (var i = 0; i < count; i++) {
    particles.push({
      x: x + (Math.random() - 0.5) * 30,
      y: y - Math.random() * 40,
      vx: (Math.random() - 0.5) * 1.4,
      vy: -0.5 - Math.random() * 1.2,
      life: 1,
      r: 1.5 + Math.random() * 2.5,
      colour: 'rgba(120,230,255,'
    });
  }
}

function updateParticles() {
  for (var i = particles.length - 1; i >= 0; i--) {
    var p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    /* lunar dust has no air to hold it up and almost no weight of its
       own, so it hangs and drifts instead of dropping like Earth sand */
    p.vy += CFG.gravity * 0.12;
    p.vx *= 0.99;
    p.life -= 0.016;
    if (p.life <= 0) { particles.splice(i, 1); }
  }
}

/* ------------------------------------------------------------
   9. THE CAMERA
   ------------------------------------------------------------ */

var camera = { x: 0, targetX: 0, drop: 0, shake: 0 };

function updateCamera() {
  camera.targetX = hero.x - (world.viewW / 2);
  var maxX = Math.max(0, CFG.worldWidth - world.viewW);
  camera.targetX = clampNum(camera.targetX, 0, maxX);
  camera.x += (camera.targetX - camera.x) * 0.11;

  /* A lunar jump climbs far higher than an Earth one, so the framing
     drops a little to keep the astronaut's head inside the window while
     they are up there. On a window tall enough to show the whole arc
     this stays at zero and nothing moves. It is capped at the height of
     the ground band, so the surface can never slide out of sight. */
  var headRoom = (hero.y - CFG.bodyHeight) + (world.viewH - CFG.viewHeight) - CFG.camHeadMargin;
  var wantDrop = clampNum(-headRoom, 0, CFG.viewHeight - CFG.groundY);
  camera.drop += (wantDrop - camera.drop) * 0.22;
  if (Math.abs(wantDrop - camera.drop) < 0.3) { camera.drop = wantDrop; }

  if (camera.shake > 0) { camera.shake *= 0.86; if (camera.shake < 0.2) camera.shake = 0; }
}

function clampNum(v, low, high) {
  if (v < low) { return low; }
  if (v > high) { return high; }
  return v;
}

/* Move `cur` towards `target` by at most `rate`. Used instead of
   multiplying the speed down, because a fixed step gives a smooth
   ramp up to full speed and an equally smooth ramp back to a stop. */
function approachNum(cur, target, rate) {
  if (cur < target) { return Math.min(cur + rate, target); }
  if (cur > target) { return Math.max(cur - rate, target); }
  return target;
}

/* ------------------------------------------------------------
   10. PHYSICS
   ------------------------------------------------------------ */

function updateHero() {
  var left = moveLeft();
  var right = moveRight();

  /* ---- horizontal movement ----
     The astronaut eases into a walk and coasts to a stop instead of
     snapping between the two. Steering in the air is deliberately
     weaker than on the ground, so a jump can be aimed but can never
     be turned into flight. */
  var dir = 0;
  if (left && !right) { dir = -1; hero.facing = -1; }
  else if (right && !left) { dir = 1; hero.facing = 1; }

  if (dir !== 0) {
    hero.vx = approachNum(hero.vx, dir * CFG.maxSpeed,
                          hero.onGround ? CFG.moveAccel : CFG.airAccel);
  } else if (hero.onGround) {
    /* braking scales with the current speed, so the stop eases out
       instead of ending with a jolt */
    hero.vx = approachNum(hero.vx, 0, CFG.moveDecel * (0.4 + Math.abs(hero.vx)));
  } else {
    hero.vx *= CFG.airFriction;
  }
  hero.vx = clampNum(hero.vx, -CFG.maxSpeed, CFG.maxSpeed);

  /* ---- gravity ----
     Three zones make up a lunar jump: a soft push off, a long climb,
     and a slow float through the top where gravity eases off. */
  if (!hero.onGround) {
    var g = CFG.gravity;
    if (hero.takeoff > 0) {
      g *= CFG.takeoffGravity;
      hero.takeoff--;
    } else if (Math.abs(hero.vy) < CFG.apexBand) {
      g *= CFG.apexGravity;
    }
    hero.vy = Math.min(hero.vy + g, CFG.maxFallSpeed);
  }

  hero.x += hero.vx;
  hero.y += hero.vy;

  /* how weightless the astronaut feels right now, 0 at full speed,
     1 while hanging at the top of the arc */
  if (hero.onGround) {
    hero.floatAmount = 0;
    hero.floatT = 0;
  } else {
    hero.floatT += 1;
    hero.floatAmount = clampNum(1 - Math.abs(hero.vy) / CFG.apexBand, 0, 1);
  }

  /* ---- keep inside the world ---- */
  var halfW = CFG.bodyWidth / 2;
  hero.x = clampNum(hero.x, halfW + 8, CFG.worldWidth - halfW - 8);

  /* ---- solid obstacles: push out sideways ---- */
  for (var i = 0; i < solids.length; i++) {
    var s = solids[i];
    if (hero.x + halfW > s.x && hero.x - halfW < s.x + s.w) {
      var feet = hero.y;
      var head = hero.y - CFG.bodyHeight;
      /* only block if the astronaut's feet are at or below the top */
      if (feet > s.y + 2 && head < s.y + s.h) {
        if (hero.vx > 0) { hero.x = s.x - halfW; }
        else if (hero.vx < 0) { hero.x = s.x + s.w + halfW; }
        else { hero.x = hero.x < s.x + s.w / 2 ? s.x - halfW : s.x + s.w + halfW; }
        hero.vx = 0;
      }
    }
  }

  /* ---- ground and platforms ---- */
  var wasOnGround = hero.onGround;
  var impact = hero.vy;          /* how fast the astronaut was arriving */
  hero.onGround = false;

  if (hero.y >= CFG.groundY) {
    hero.y = CFG.groundY;
    if (hero.vy > 0) { hero.vy = 0; }
    hero.onGround = true;
  }

  for (var p = 0; p < platforms.length; p++) {
    var pl = platforms[p];
    var prevFeet = hero.y - hero.vy;
    if (hero.vy >= 0 &&
        hero.x + halfW - 6 > pl.x && hero.x - halfW + 6 < pl.x + pl.w &&
        prevFeet <= pl.y + 6 && hero.y >= pl.y && hero.y <= pl.y + 24) {
      hero.y = pl.y;
      hero.vy = 0;
      hero.onGround = true;
    }
  }

  if (hero.onGround) { hero.coyote = CFG.coyoteTime; }
  else if (hero.coyote > 0) { hero.coyote--; }

  /* ---- landing ----
     A landing plays for a fixed short moment and the effect is scaled
     by the speed of arrival: a slow step down is barely noticed, while
     dropping from the top of a long lunar jump gets a soft bounce. */
  if (!wasOnGround && hero.onGround) {
    hero.landTimer = CFG.landFrames;
    hero.landPower = clampNum(impact / CFG.maxFallSpeed, 0, 1);
    hero.takeoff = 0;
    puff(hero.x, hero.y, 4 + Math.round(hero.landPower * 7));
    if (hero.landPower > 0.45) { camera.shake = Math.max(camera.shake, hero.landPower * 2.4); }
  } else if (hero.onGround && hero.landTimer <= 0) {
    hero.landPower = 0;
  }
  if (hero.landTimer > 0) { hero.landTimer--; }

  /* ---- animation state ---- */
  if (hero.landTimer > 0) { hero.state = 'land'; }
  else if (!hero.onGround) { hero.state = 'jump'; }
  else if (Math.abs(hero.vx) > CFG.walkSpeedForAnim) { hero.state = 'walk'; }
  else { hero.state = 'idle'; }

  /* The stride keeps an even, deliberate lunar pace. It does not speed
     up with the walking speed, which is what makes the astronaut look
     like they are moving through thick, light gravity. */
  if (hero.state === 'walk') {
    hero.walkTimer += (Math.abs(hero.vx) / CFG.maxSpeed) *
                       (SPRITE_ANIM.walk.length / CFG.walkCycleFrames);
    if (hero.walkTimer >= SPRITE_ANIM.walk.length) { hero.walkTimer -= SPRITE_ANIM.walk.length; }
    hero.walkFrame = Math.floor(hero.walkTimer);
    hero.dustTimer += Math.abs(hero.vx);
    if (hero.dustTimer > CFG.walkDustEvery && hero.onGround) {
      hero.dustTimer = 0;
      puff(hero.x - hero.facing * 10, hero.y, 1);
    }
  } else {
    hero.walkTimer = 0;
    hero.walkFrame = 0;
  }

  hero.idleTimer += 1;

  /* ---- jump sprite choice ----
     A dead zone around the top of the arc keeps the pose from
     flickering between frames while the astronaut is floating. */
  if (!hero.onGround) {
    hero.jumpType = hero.vy < -0.35 ? 'jump_rise' : 'jump_fall';
  }

  /* ---- a jump pressed just before touchdown fires on landing ---- */
  if (hero.jumpBuffer > 0) {
    if (hero.onGround) { doJump(); }
    else { hero.jumpBuffer--; }
  }

  /* ---- collect floating canisters ---- */
  for (var k = 0; k < pickups.length; k++) {
    var pk = pickups[k];
    if (pk.taken) { continue; }
    if (Math.abs(pk.x - hero.x) < 26 && Math.abs((pk.y) - (hero.y - 38)) < 44) {
      pk.taken = true;
      sparkle(pk.x, pk.y, 12);
      if (typeof collectPickup === 'function') { collectPickup(); }
    }
  }
}

/* ------------------------------------------------------------
   11. DRAWING THE SCENE
   ------------------------------------------------------------ */

var stars = [];
var t = 0;

function buildStars() {
  stars = [];
  for (var i = 0; i < 90; i++) {
    stars.push({
      x: Math.random() * CFG.worldWidth,
      y: Math.random() * (CFG.groundY - 90),
      r: 0.6 + Math.random() * 1.7,
      a: 0.25 + Math.random() * 0.6,
      phase: Math.random() * 6.28,
      speed: 0.5 + Math.random() * 1.6
    });
  }
}

/* --- background sky, drawn in screen space --- */
function drawSky(ctx, w, h) {
  var g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#050b1c');
  g.addColorStop(0.55, '#0c1733');
  g.addColorStop(1, '#1a2140');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  /* soft colour clouds far away */
  var clouds = [
    { x: 0.18, y: 0.30, r: 0.42, c: 'rgba(60,120,210,0.13)' },
    { x: 0.62, y: 0.20, r: 0.36, c: 'rgba(120,80,200,0.10)' },
    { x: 0.86, y: 0.42, r: 0.30, c: 'rgba(40,180,190,0.09)' }
  ];
  for (var i = 0; i < clouds.length; i++) {
    var c = clouds[i];
    var cx = (c.x * w + t * 0.004 * (i + 1)) % (w * 1.4) - w * 0.2;
    var cy = c.y * h;
    var cr = c.r * h;
    var rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
    rg.addColorStop(0, c.c);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(cx - cr, cy - cr, cr * 2, cr * 2);
  }
}

/* --- Earth, fixed in the sky --- */
function drawEarth(ctx, x, y, r) {
  var g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, '#7fc4ff');
  g.addColorStop(0.5, '#2f7fd6');
  g.addColorStop(1, '#14407f');
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = g; ctx.fill();

  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = 'rgba(120,190,120,0.55)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.25, y - r * 0.2, r * 0.42, r * 0.24, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + r * 0.3, y + r * 0.25, r * 0.3, r * 0.18, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.3, y - r * 0.55, r * 0.5, r * 0.14, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(140,200,255,0.45)'; ctx.lineWidth = 2; ctx.stroke();
}

/* --- stars, parallaxed against the camera --- */
function drawStars(ctx, camX) {
  for (var i = 0; i < stars.length; i++) {
    var s = stars[i];
    var sx = s.x - camX * 0.18;
    if (sx < -20) { sx += CFG.worldWidth * 0.18 + 40; }
    if (sx > world.viewW + 20) { continue; }
    var tw = 0.65 + 0.35 * Math.sin(t / 26 * s.speed + s.phase);
    ctx.beginPath();
    ctx.arc(sx, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(226,240,255,' + (s.a * tw).toFixed(3) + ')';
    ctx.fill();
  }
}

/* --- distant mountains --- */
function drawHills(ctx, camX) {
  ctx.fillStyle = '#1d2440';
  ctx.beginPath();
  ctx.moveTo(-50, CFG.groundY);
  for (var x = -50; x < world.viewW + 60; x += 26) {
    var wx = x + camX * 0.35;
    var y = CFG.groundY - 52 - Math.sin(wx * 0.0032) * 34 - Math.sin(wx * 0.011) * 14;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(world.viewW + 60, CFG.groundY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#242c4c';
  ctx.beginPath();
  ctx.moveTo(-50, CFG.groundY);
  for (var x2 = -50; x2 < world.viewW + 60; x2 += 20) {
    var wx2 = x2 + camX * 0.55;
    var y2 = CFG.groundY - 26 - Math.sin(wx2 * 0.0055 + 1.4) * 24;
    ctx.lineTo(x2, y2);
  }
  ctx.lineTo(world.viewW + 60, CFG.groundY);
  ctx.closePath();
  ctx.fill();
}

/* --- the lunar ground with craters --- */
function drawGround(ctx, camX) {
  var g = ctx.createLinearGradient(0, CFG.groundY - 14, 0, world.viewH);
  g.addColorStop(0, '#a8adb8');
  g.addColorStop(0.18, '#8d929e');
  g.addColorStop(1, '#5b5f6b');
  ctx.fillStyle = g;
  /* drawn well past the bottom edge so the surface still fills the screen
     when the camera rises during a big jump */
  ctx.fillRect(0, CFG.groundY, world.viewW, CFG.viewHeight - CFG.groundY + 400);

  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(0, CFG.groundY, world.viewW, 3);

  /* craters */
  for (var i = 0; i < 26; i++) {
    var cx = ((i * 197) - camX * 1) % (world.viewW + 200) - 100;
    if (cx < -80) { cx += world.viewW + 200; }
    var cy = CFG.groundY + 22 + ((i * 53) % 70);
    var cr = 12 + ((i * 7) % 22);
    ctx.beginPath();
    ctx.ellipse(cx, cy, cr, cr * 0.36, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(60,64,74,0.35)';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, cy - 2, cr, cr * 0.34, 0, Math.PI, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fill();
  }
}

/* --- rocks and crates --- */
function drawSolids(ctx, camX) {
  for (var i = 0; i < solids.length; i++) {
    var s = solids[i];
    var x = s.x - camX;
    if (x < -140 || x > world.viewW + 140) { continue; }
    if (s.station) { continue; }   /* the station sprite covers it */

    ctx.beginPath();
    ctx.moveTo(x, CFG.groundY);
    ctx.lineTo(x + 3, s.y + s.h * 0.35);
    ctx.lineTo(x + s.w * 0.3, s.y);
    ctx.lineTo(x + s.w * 0.7, s.y + 4);
    ctx.lineTo(x + s.w - 3, s.y + s.h * 0.4);
    ctx.lineTo(x + s.w, CFG.groundY);
    ctx.closePath();
    var g = ctx.createLinearGradient(x, s.y, x, CFG.groundY);
    g.addColorStop(0, '#9aa0ad');
    g.addColorStop(1, '#6b707c');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,35,48,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawPlatforms(ctx, camX) {
  for (var i = 0; i < platforms.length; i++) {
    var p = platforms[i];
    var x = p.x - camX;
    if (x < -110 || x > world.viewW + 110) { continue; }

    ctx.save();
    ctx.translate(x, p.y);
    ctx.rotate(0);
    ctx.fillStyle = '#c78f4e';
    ctx.strokeStyle = '#5c3f1e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(0, 0, p.w, p.h, 4);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(6, 3, p.w - 12, 4);
    ctx.restore();
  }
}

function drawPickups(ctx, camX) {
  for (var i = 0; i < pickups.length; i++) {
    var p = pickups[i];
    if (p.taken) { continue; }
    var x = p.x - camX;
    if (x < -60 || x > world.viewW + 60) { continue; }

    var bob = Math.sin(t / 22 + p.bob) * 5;
    var y = p.y + bob;

    ctx.save();
    /* glow */
    var g = ctx.createRadialGradient(x, y, 0, x, y, 26);
    g.addColorStop(0, 'rgba(120,230,255,0.30)');
    g.addColorStop(1, 'rgba(120,230,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 26, y - 26, 52, 52);

    /* canister */
    ctx.beginPath();
    ctx.roundRect(x - 9, y - 14, 18, 28, 7);
    ctx.fillStyle = '#d8e6f2';
    ctx.fill();
    ctx.strokeStyle = '#28304a';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#4fd1e0';
    ctx.fillRect(x - 6, y - 8, 12, 12);
    ctx.fillStyle = '#1a5f7a';
    ctx.fillRect(x - 6, y - 4, 12, 4);
    ctx.restore();
  }
}

/* --- the structures themselves --- */
function drawStations(ctx, camX) {
  for (var i = 0; i < STATIONS.length; i++) {
    var s = STATIONS[i];
    var x = s.x - camX;
    if (x < -160 || x > world.viewW + 160) { continue; }

    var spriteName = s.sprite;
    /* the solar array shows damage when the panels are hurt */
    if (s.solar && game && game.mods && game.mods.solarFactor < 1) {
      spriteName = 'station_solar_bad';
    }

    if (!drawSprite(ctx, spriteName, x - 48, CFG.groundY - 86, 96, 96)) {
      fallbackStation(ctx, s.id, x, CFG.groundY);
    }

    /* name plate */
    ctx.save();
    ctx.font = 'bold 12px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    var tw = ctx.measureText(s.name).width + 16;
    ctx.fillStyle = 'rgba(8,16,36,0.72)';
    ctx.beginPath();
    ctx.roundRect(x - tw / 2, CFG.groundY + 8, tw, 20, 6);
    ctx.fill();
    ctx.fillStyle = '#9fb0d4';
    ctx.fillText(s.name, x, CFG.groundY + 22);
    ctx.restore();

    /* a mission marker on every structure of the type that hosts
       today's scenario, so a base with two depots flags both */
    if (game && game.stationEvent === s.type && !game.finished) {
      drawMarker(ctx, x, CFG.groundY - 108, t);
    }
  }
}

/* the glowing "!" above a station with today's mission */
function drawMarker(ctx, x, y, time) {
  var bounce = Math.sin(time / 9) * 5;
  ctx.save();
  ctx.translate(x, y + bounce);

  var g = ctx.createRadialGradient(0, 0, 0, 0, 0, 34);
  g.addColorStop(0, 'rgba(255,209,102,0.45)');
  g.addColorStop(1, 'rgba(255,209,102,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-34, -34, 68, 68);

  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(16, 10);
  ctx.lineTo(-16, 10);
  ctx.closePath();
  ctx.fillStyle = '#ffd166';
  ctx.fill();
  ctx.strokeStyle = '#6b4a12';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = '#4a3208';
  ctx.fillRect(-2.5, -9, 5, 11);
  ctx.beginPath();
  ctx.arc(0, 6, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* --- the astronaut --- */
function drawHero(ctx, camX) {
  var x = hero.x - camX;
  var y = hero.y;
  var frame;

  if (hero.state === 'land') {
    /* a two frame crouch: land_0 is the deep squash, land_1 the ease out */
    frame = hero.landTimer > CFG.landFrames * 0.45 ? 'land_0' : 'land_1';
  } else if (hero.state === 'jump') {
    frame = hero.jumpType;
  } else if (hero.state === 'walk') {
    frame = SPRITE_ANIM.walk[hero.walkFrame % SPRITE_ANIM.walk.length];
  } else if (hero.state === 'work') {
    frame = SPRITE_ANIM.work[Math.floor(t / 8) % SPRITE_ANIM.work.length];
  } else {
    frame = SPRITE_ANIM.idle[Math.floor(hero.idleTimer / 22) % SPRITE_ANIM.idle.length];
  }

  /* --- low gravity body motion, all scaled around the boots so the
         astronaut stays planted on the ground while it happens --- */
  var scaleX = 1;
  var scaleY = 1;
  var driftY = 0;
  var tilt = 0;

  if (hero.state === 'jump') {
    /* a slow floating drift and a gentle sway, strongest at the top of
       the arc where the astronaut is nearly weightless */
    driftY = Math.sin(hero.floatT / 11) * CFG.floatBob * hero.floatAmount;
    tilt = clampNum(-hero.vy * CFG.airTilt, -CFG.floatSway, CFG.floatSway);
    if (hero.takeoff > 0) {              /* stretch on the push off */
      var push = hero.takeoff / CFG.takeoffFrames * 0.06;
      scaleY += push;
      scaleX -= push * 0.6;
    }
  } else if (hero.state === 'land') {
    /* a soft squash that eases back to normal over the landing */
    var done = 1 - hero.landTimer / CFG.landFrames;
    var squash = (1 - done) * (1 - done) * (0.10 + hero.landPower * 0.12);
    scaleY -= squash;
    scaleX += squash * 0.85;
  } else if (hero.state === 'walk') {
    /* a soft settling bob between steps, and a lean into the direction
       of travel */
    driftY = Math.sin(hero.walkTimer / SPRITE_ANIM.walk.length * Math.PI * 2) * 1.8;
    tilt = clampNum(hero.vx * 0.012, -0.06, 0.06);
  }

  ctx.save();
  ctx.translate(x, y + driftY);
  ctx.rotate(tilt);
  ctx.scale(hero.facing * scaleX, scaleY);

  if (drawSprite(ctx, frame, -48, -86, 96, 96)) {
    ctx.restore();
  } else {
    fallbackAstronaut(ctx, '#e8eef8');
    ctx.restore();
  }
}

function drawParticles(ctx, camX) {
  for (var i = 0; i < particles.length; i++) {
    var p = particles[i];
    var a = p.life;
    if (a <= 0) { continue; }
    ctx.beginPath();
    ctx.arc(p.x - camX, p.y, p.r * a, 0, Math.PI * 2);
    ctx.fillStyle = p.colour + a.toFixed(3) + ')';
    ctx.fill();
  }
}

/* ------------------------------------------------------------
   12. THE MAIN DRAW
   ------------------------------------------------------------ */

function render() {
  var c = world.canvas;
  if (!c) { return; }
  var ctx = world.ctx;
  if (!ctx) { return; }

  var w = world.viewW;
  var h = world.viewH;

  ctx.setTransform(world.dpr, 0, 0, world.dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  var shakeX = camera.shake ? (Math.random() - 0.5) * camera.shake : 0;
  var shakeY = camera.shake ? (Math.random() - 0.5) * camera.shake : 0;

  var camX = Math.round(camera.x + shakeX);
  var camY = Math.round(shakeY + (world.viewH - CFG.viewHeight) + camera.drop);

  /* --- background layers (screen space, lightly parallaxed) --- */
  drawSky(ctx, w, h);
  drawStars(ctx, camX);
  /* Earth sits in the sky, kept clear of the HUD panels at the top. */
  drawEarth(ctx, w / 2, Math.min(h * 0.30, 230), 40);
  drawHills(ctx, camX);

  /* --- world layers --- */
  ctx.save();
  ctx.translate(0, camY);
  drawGround(ctx, camX);
  drawSolids(ctx, camX);
  drawPlatforms(ctx, camX);
  drawStations(ctx, camX);
  drawPickups(ctx, camX);
  drawParticles(ctx, camX);
  drawHero(ctx, camX);
  ctx.restore();

  /* dim overlay while paused or a panel is open */
  if (world.paused) {
    ctx.fillStyle = 'rgba(4,8,22,0.55)';
    ctx.fillRect(0, 0, w, h);
  }

  drawPrompt(ctx, w, h, camY);
}

/* the "Press E" bubble above the astronaut */
function drawPrompt(ctx, w, h, camY) {
  if (!nearbyStation || world.paused) { return; }
  var s = nearbyStation;
  var bx = hero.x - camera.x;
  var by = hero.y + camY - 108;

  ctx.save();
  ctx.font = 'bold 13px "Segoe UI", sans-serif';
  var label = 'Press E  \u2022  ' + s.name;
  var tw = ctx.measureText(label).width + 24;
  var th = 30;

  ctx.fillStyle = 'rgba(8,20,44,0.9)';
  ctx.strokeStyle = '#4fd1e0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(bx - tw / 2, by - th, tw, th, 9);
  ctx.fill(); ctx.stroke();

  /* little tail */
  ctx.beginPath();
  ctx.moveTo(bx - 7, by - 1);
  ctx.lineTo(bx + 7, by - 1);
  ctx.lineTo(bx, by + 9);
  ctx.closePath();
  ctx.fillStyle = 'rgba(8,20,44,0.9)';
  ctx.fill();

  ctx.fillStyle = '#eef3ff';
  ctx.textAlign = 'center';
  ctx.fillText(label, bx, by - 9);
  ctx.restore();
}

/* ------------------------------------------------------------
   13. THE LOOP
   ------------------------------------------------------------ */

var world = {
  canvas: null,
  ctx: null,
  dpr: 1,
  viewW: 1280,
  viewH: 620,
  running: false,
  paused: false,
  loopHandle: null,
  lastTime: 0,
  stationEvent: null
};

function worldLoop(now) {
  if (!world.running) { return; }

  if (!world.lastTime) { world.lastTime = now; }
  var dt = (now - world.lastTime) / 16.6667;
  world.lastTime = now;
  if (dt > 3) { dt = 3; }        /* never let a stall teleport anyone */

  t += dt;

  /* The astronaut freezes while a station panel is open, so the
     player cannot walk away mid-decision. */
  var panelOpen = (typeof game !== 'undefined' && game && game.stationOpen);

  if (!world.paused && !panelOpen) {
    updateHero();
    updateCamera();
    updateParticles();
    nearbyStation = nearestStation();
  }

  /* The repair animation runs on the loop itself rather than inside
     updateHero, because the astronaut is frozen while the panel that
     triggered it is open. Running it last also means it wins over the
     walk and idle poses for exactly as long as it lasts. */
  if (!world.paused) { tickWorkAnim(); }

  render();
  world.loopHandle = window.requestAnimationFrame(worldLoop);
}

/* Count down the standing repair animation. */
function tickWorkAnim() {
  if (hero.workTimer > 0) {
    hero.workTimer--;
    hero.state = 'work';
  } else if (hero.state === 'work' && Math.abs(hero.vx) <= CFG.walkSpeedForAnim) {
    /* only step back to idle if the astronaut is not already moving */
    hero.state = 'idle';
  }
}

function resizeWorld() {
  var c = world.canvas;
  if (!c) { return; }
  world.dpr = Math.min(window.devicePixelRatio || 1, 2);
  world.viewW = c.clientWidth;
  world.viewH = c.clientHeight;
  c.width = Math.floor(world.viewW * world.dpr);
  c.height = Math.floor(world.viewH * world.dpr);
}

function startWorld() {
  world.canvas = document.getElementById('game-canvas');
  if (!world.canvas) { return; }
  world.ctx = world.canvas.getContext('2d');
  if (!world.ctx) { return; }

  resizeWorld();
  window.addEventListener('resize', function () {
    if (world.running) { resizeWorld(); }
  });

  world.running = true;
  world.paused = false;
  if (world.loopHandle) { window.cancelAnimationFrame(world.loopHandle); }
  world.loopHandle = window.requestAnimationFrame(worldLoop);
}

function stopWorld() {
  world.running = false;
  if (world.loopHandle) {
    window.cancelAnimationFrame(world.loopHandle);
    world.loopHandle = null;
  }
}

function togglePause() {
  if (!world.running) { return; }
  world.paused = !world.paused;
  if (typeof setPausedUI === 'function') { setPausedUI(world.paused); }
}

/* ------------------------------------------------------------
   14. PUBLIC API  (script.js calls these)
   ------------------------------------------------------------ */

world.reset = function () {
  hero.x = 240;
  hero.y = CFG.groundY;
  hero.vx = 0;
  hero.vy = 0;
  hero.onGround = true;
  hero.facing = 1;
  hero.walkFrame = 0;
  hero.walkTimer = 0;
  hero.idleTimer = 0;
  hero.landTimer = 0;
  hero.landPower = 0;
  hero.workTimer = 0;
  hero.coyote = CFG.coyoteTime;
  hero.takeoff = 0;
  hero.jumpBuffer = 0;
  hero.floatT = 0;
  hero.floatAmount = 0;
  hero.dustTimer = 0;
  hero.jumpType = 'jump_rise';
  hero.state = 'idle';

  camera.x = 0;
  camera.targetX = 0;
  camera.drop = 0;
  camera.shake = 0;

  world.paused = false;
  world.stationEvent = null;

  nearbyStation = null;
  t = 0;
  buildStations();
  buildTerrain();
  buildStars();
  if (typeof setPausedUI === 'function') { setPausedUI(false); }
};

/* Put a base on the surface. Anything without a usable layout falls
   back to the starting one, so the world is never left empty. */
world.applyLayout = function (layout) {
  baseLayout = (layout && layout.length) ? copyLayout(layout) : copyLayout(DEFAULT_LAYOUT);
  buildStations();
  buildTerrain();
  return baseLayout;
};

/* The base currently on the surface, as a fresh copy. */
world.currentLayout = function () {
  return copyLayout(baseLayout);
};

/* Tell the world which kind of structure hosts today's mission. */
world.setStationEvent = function (stationType) {
  world.stationEvent = stationType;
};

/* Small shake used by repair effects. */
world.bump = function (amount) {
  camera.shake = Math.min(camera.shake + amount, 7);
};

/* Show the working animation for a moment. The frames are counted
   down by tickWorkAnim on the main loop, so the pose survives for the
   whole animation instead of being replaced by the idle pose on the
   very next frame. */
world.playWork = function (frames) {
  hero.workTimer = frames || 40;
  hero.state = 'work';
};

/* ------------------------------------------------------------
   15. BOOT
   ------------------------------------------------------------ */

loadSprites();
world.applyLayout(DEFAULT_LAYOUT);   /* structures first: terrain keeps clear of them */
buildStars();
setupInput();

/* Start the loop whenever the game screen becomes visible. */
(function watchScreen() {
  var screen = document.getElementById('screen-game');
  if (!screen) { return; }
  var started = false;

  var obs = new MutationObserver(function () {
    if (!screen.hidden) {
      if (!started || !world.running) { startWorld(); started = true; }
      resizeWorld();
    } else {
      stopWorld();
      started = false;
    }
  });
  obs.observe(screen, { attributes: true, attributeFilter: ['hidden'] });

  window.addEventListener('load', function () {
    if (!screen.hidden) { startWorld(); started = true; }
  });
})();

/* exposed for the HUD and for tests */
window.world = world;
window.hero = hero;
window.STATIONS = STATIONS;
window.STATION_TYPES = STATION_TYPES;
window.DEFAULT_LAYOUT = DEFAULT_LAYOUT;
