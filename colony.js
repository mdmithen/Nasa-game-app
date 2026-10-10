/* ============================================================
   THE LUNAR COLONY - a 2.5D isometric survey of the base
   ============================================================

   WHY THIS IS A SECOND VIEW AND NOT A REPLACEMENT
   ------------------------------------------------
   The game has always been a Canvas 2D side-scroller. That is not a
   limitation to be apologetic about: it is why the whole thing is 11
   script tags, one sprite sheet and no libraries at all. Swapping it
   for a 3D engine would mean rewriting the renderer, the physics, the
   sprite pipeline, the builder overlay and every test that touches
   any of them. So this file does not touch the engine.

   What it adds is a second way of LOOKING at the same base:

     screen-game     the 2D play view that already existed
     screen-colony   this file - the same base, seen from above

   Both read the same `game.layout`, so the colony is not a model of
   the base, it IS the base. Move a module here and it moves in the
   play view. The mission simulation, the scoring, the objectives and
   the sixteen day limit are untouched, because nothing in this file
   is allowed to write to them.

   HOW THE LANDSCAPE IS BUILT
   --------------------------
   Everything here is generated, not stored. Terrain is a heightfield
   with craters cut into it, sampled from a seeded random number
   generator so it is identical every time the page loads - which is
   what lets the tests assert on it. The generation happens once and
   is cached; the per-frame cost is drawing.

   THE THREE RULES THIS FILE NEVER BREAKS
   --------------------------------------
   1. It never writes to `game` except through the same public
      functions the rest of the game uses.
   2. It never stops the 2D world loop from outside. The existing
      MutationObserver in world.js already stops the world when its
      screen is hidden, and this file lives on its own screen.
   3. It is loaded last and defends itself. If this file is missing
      the game is exactly as it was before.
   ============================================================ */

/* ------------------------------------------------------------
   1. SETTINGS
   ------------------------------------------------------------ */

var COLONY = {
  /* The colony is much bigger than the crew. It is 4x wider than the
     2D play strip and several times deeper, because the whole point
     of a settlement is that it is spread out. */
  worldW: 9600,
  worldD: 6800,
  cell: 40,            /* heightfield resolution, in world units */
  relief: 190,         /* tallest a hill or crater rim may reach */

  /* Isometric foreshortening. 2:1 is the classic pixel-art ratio:
     one world unit across becomes half a unit wide, and one unit
     away from the camera becomes half as far down the screen. */
  isoX: 0.50,
  isoY: 0.25,
  /* Height is exaggerated a little. Real lunar relief is far flatter
     than this at settlement scale, and without the exaggeration a
     building and a footpath look identical from above. */
  isoZ: 0.72,

  zoomMin: 0.42,
  zoomMax: 1.55,
  zoomStep: 1.14,

/* The regolith palette. Cold, desaturated greys with a faint warm
     cast, which is how lunar soil photographs actually looks. There
     is no green, no blue and no saturated colour anywhere in here. */
  palette: {
    deep:   [26, 28, 34],
    shade:  [44, 47, 55],
    low:    [68, 71, 80],
    mid:    [98, 101, 110],
    high:   [132, 134, 141],
    peak:   [168, 169, 174],
    sky:    '#05060b',
    lit:    'rgba(226,228,234,'
  }
};

/* ------------------------------------------------------------
   1b. DAY/NIGHT CYCLE AND SUN POSITION
   ------------------------------------------------------------ */

/* Compute current sun position based on mission day/time.
   Returns { azimuth, altitude } in radians. */
function colonyGetSunPosition() {
  /* Base sun position from settings */
  var baseAz = COLONY.sunAzimuth;
  var baseAlt = COLONY.sunAltitude;

  /* If we have a live mission, compute sun position from mission day/time */
  if (typeof game !== 'undefined' && game && game.day) {
    /* Lunar day = 29.5 Earth days. Mission day 1-16 maps to lunar day.
       Sun altitude varies: at south pole, sun circles horizon. */
    var dayProgress = ((game.day - 1) % 29.5) / 29.5;  /* 0-1 over lunar month */
    var alt = Math.sin(dayProgress * Math.PI * 2) * 0.5;  /* -0.5 to 0.5 rad */
    var az = dayProgress * Math.PI * 2;  /* full circle */
    return { azimuth: az, altitude: Math.max(0.05, alt) };
  }

  /* Fallback: use animated cycle for visual appeal when no mission */
  var cycleProgress = (colony.t % COLONY.dayCycleMs) / COLONY.dayCycleMs;
  var alt = Math.sin(cycleProgress * Math.PI * 2) * 0.4 + 0.2;  /* 0 to 0.6 rad */
  var az = cycleProgress * Math.PI * 2;
  return { azimuth: az, altitude: Math.max(0.05, alt) };
}

/* Compute current sun direction vector for lighting/shadows */
function colonyGetSunDirection() {
  var pos = colonyGetSunPosition();
  var sx = Math.cos(pos.azimuth) * Math.cos(pos.altitude);
  var sy = Math.sin(pos.altitude);
  var sz = Math.sin(pos.azimuth) * Math.cos(pos.altitude);
  return { x: sx, y: sy, z: sz };
}

/* ------------------------------------------------------------
   2. SEEDED RANDOM AND VALUE NOISE

   Terrain must be identical on every load, otherwise the tests would
   be asserting against a different Moon each run and the player
   would find their colony had moved. Math.random() is therefore
   never used for anything that ends up stored.
   ------------------------------------------------------------ */

function colonyHash(x, y, seed) {
  var h = x * 374761393 + y * 668265263 + seed * 1274126177;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return (h >>> 0) / 4294967295;
}

/* Smooth 2D value noise. Cheap, and smooth enough that the terrain
   never shows the grid it was sampled on. */
function colonyNoise(x, y, seed) {
  var xi = Math.floor(x), yi = Math.floor(y);
  var xf = x - xi, yf = y - yi;
  var u = xf * xf * (3 - 2 * xf);
  var v = yf * yf * (3 - 2 * yf);

  var a = colonyHash(xi, yi, seed);
  var b = colonyHash(xi + 1, yi, seed);
  var c = colonyHash(xi, yi + 1, seed);
  var d = colonyHash(xi + 1, yi + 1, seed);

  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

/* Several octaves at once. One octave looks like a gentle hill; four
   looks like regolith, which has been ground down and re-deposited
   for four billion years. */
function colonyFbm(x, y, seed) {
  var total = 0, amp = 1, freq = 1, norm = 0;
  for (var o = 0; o < 4; o++) {
    total += colonyNoise(x * freq, y * freq, seed + o * 101) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.07;
  }
  return total / norm;
}

/* A number in a stable range for a given site, so every landing site
   gets its own landscape but the same site always gets the same one. */
function colonySeedFor(zoneId) {
  var s = 0;
  var id = zoneId || 'nobile';
  for (var i = 0; i < id.length; i++) {
    s = (s * 31 + id.charCodeAt(i)) >>> 0;
  }
  return s % 100000;
}

/* ------------------------------------------------------------
   3. THE ZONES

   Six functional areas, laid out the way a real settlement would be:
   the crew and their machines together, the power field out on its
   own where there is nothing to shadow it, and the landing pad kept
   away from everything so a descending ship has room.
   ------------------------------------------------------------ */

var COLONY_ZONES = [
  {
    id: 'habitat', name: 'Habitat Zone', short: 'HAB',
    x: 2150, z: 1750, w: 2100, d: 1750,
    blurb: 'Crew quarters, galley and the pressurised greenhouse.'
  },
  {
    id: 'power', name: 'Power Zone', short: 'PWR',
    x: 7050, z: 1500, w: 2300, d: 1750,
    blurb: 'Solar arrays and battery storage. Nothing shades this field.'
  },
  {
    id: 'research', name: 'Research Zone', short: 'RES',
    x: 7700, z: 4300, w: 2200, d: 1900,
    blurb: 'Labs, the telescope dome and the long-range antenna.'
  },
  {
    id: 'resource', name: 'Resource Zone', short: 'RSRC',
    x: 2450, z: 5100, w: 2200, d: 1800,
    blurb: 'Water processing, oxygen generation and the stores.'
  },
  {
    id: 'exploration', name: 'Exploration Zone', short: 'EXP',
    x: 1200, z: 3600, w: 1900, d: 1750,
    blurb: 'Rover parking, tool racks and the sample field.'
  },
  {
    id: 'landing', name: 'Landing Zone', short: 'LDG',
    x: 4900, z: 5350, w: 2400, d: 1750,
    blurb: 'The landing pad and the rover route to it.'
  }
];

/* Where the crew's own buildings sit inside the colony, and which
   zone each one belongs to. This is the mapping between the eight
   structure types and the six areas of the brief. */
var COLONY_TYPE_ZONE = {
  habitat: 'habitat',
  oxygen:  'habitat',
  console: 'research',
  water:   'resource',
  food:    'resource',
  depot:   'resource',
  solar:   'power',
  pad:     'landing'
};

/* ------------------------------------------------------------
   4. TERRAIN

   Generated once per landing site and then cached. The heightfield is
   a flat array indexed by row and column; sampling it is a bilinear
   lookup, so the renderer can ask "how high is the ground here"
   thousands of times a frame without noticing.
   ------------------------------------------------------------ */

var colonyTerrain = null;

function colonyBuildTerrain(zoneId) {
  var seed = colonySeedFor(zoneId);
  var cell = COLONY.cell;
  var cols = Math.ceil(COLONY.worldW / cell) + 1;
  var rows = Math.ceil(COLONY.worldD / cell) + 1;

  /* --- craters first, because they cut through everything else ---
     Real craters are bowls with raised rims. Both halves matter: a
     crater drawn as a flat disc reads as a stain, and one drawn
     without the rim reads as a hole. */
  var craters = [];
  var craterCount = 11;
  for (var c = 0; c < craterCount; c++) {
    var r1 = colonyHash(c, 17, seed);
    var r2 = colonyHash(c, 91, seed);
    var r3 = colonyHash(c, 233, seed);
    /* Keep craters off the middle of the settlement so the colony
       itself sits on usable, buildable ground. */
    var cx = 400 + r1 * (COLONY.worldW - 800);
    var cz = 400 + r2 * (COLONY.worldD - 800);
    var away = Math.abs(cx - 4700) + Math.abs(cz - 3300);
    if (away < 1500) { cx += (cx < 4700 ? -1 : 1) * 900; cz += (cz < 3300 ? -1 : 1) * 900; }
    craters.push({
      x: cx,
      z: cz,
      r: 190 + r3 * 420,
      depth: 34 + r3 * 62,
      rim: 26 + r1 * 34,
      fresh: r2 > 0.66      /* young craters have crisp bright rays */
    });
  }

  /* --- boulders: scattered rocks that catch the light --- */
  var boulders = [];
  for (var b = 0; b < 340; b++) {
    var bx = colonyHash(b, 7, seed + 3) * COLONY.worldW;
    var bz = colonyHash(b, 13, seed + 5) * COLONY.worldD;
    boulders.push({
      x: bx,
      z: bz,
      r: 6 + colonyHash(b, 29, seed + 9) * 21,
      tone: colonyHash(b, 51, seed + 11),
      spin: colonyHash(b, 77, seed + 13) * Math.PI * 2
    });
  }

  /* --- the heightfield itself --- */
  var h = new Float32Array(cols * rows);
  for (var j = 0; j < rows; j++) {
    for (var i = 0; i < cols; i++) {
      var wx = i * cell;
      var wz = j * cell;

      /* Broad rolling ground. Scaled right down, because real lunar
         relief over a few kilometres is gentle. */
      var v = (colonyFbm(wx / 2400, wz / 2400, seed) - 0.5) * COLONY.relief;

      /* A slow tilt so the colony is not sitting on a table. */
      v += (wx / COLONY.worldW - 0.5) * 26;
      v += (wz / COLONY.worldD - 0.5) * 18;

      /* Craters cut into it. The profile is a bowl with a raised rim,
         which is the shape a real impact leaves behind. */
      for (var k = 0; k < craters.length; k++) {
        var cr = craters[k];
        var dx = wx - cr.x, dz = wz - cr.z;
        var d = Math.sqrt(dx * dx + dz * dz);
        if (d > cr.r * 1.55) { continue; }
        var t = d / cr.r;
        if (t < 0.78) {
          /* the bowl */
          v -= cr.depth * (1 - (t / 0.78) * (t / 0.78)) * 0.9;
        } else if (t < 1.0) {
          /* the inner wall climbing back out */
          v -= cr.depth * (1 - Math.pow(t / 0.78, 2)) * 0.9;
          v += cr.rim * (t - 0.78) / 0.22;
        } else if (t < 1.4) {
          /* the raised rim, falling away again outside it */
          v += cr.rim * (1 - (t - 1.0) / 0.4);
        }
      }

      h[j * cols + i] = v;
    }
  }

  /* --- flatten the pads ---
     A settlement cannot be built on a slope. Each zone gets a very
     gentle slope rather than a flat plane, because a perfectly flat
     patch reads as a bug, but gentle enough to build on. */
  for (var zi = 0; zi < COLONY_ZONES.length; zi++) {
    var zone = COLONY_ZONES[zi];
    var c0 = Math.max(0, Math.floor((zone.x - zone.w / 2) / cell));
    var c1 = Math.min(cols - 1, Math.ceil((zone.x + zone.w / 2) / cell));
    var r0 = Math.max(0, Math.floor((zone.z - zone.d / 2) / cell));
    var r1 = Math.min(rows - 1, Math.ceil((zone.z + zone.d / 2) / cell));
    var target = h[Math.floor(zone.z / cell) * cols + Math.floor(zone.x / cell)];
    for (var jj = r0; jj <= r1; jj++) {
      for (var ii = c0; ii <= c1; ii++) {
        var t2 = h[jj * cols + ii] * 0.82 + target * 0.18;
        h[jj * cols + ii] = t2;
      }
    }
  }

  var terrain = {
    seed: seed,
    cell: cell,
    cols: cols,
    rows: rows,
    h: h,
    craters: craters,
    boulders: boulders,
    /* a cheap cache of the low and high points, for the minimap */
    min: Infinity,
    max: -Infinity
  };
  for (var q = 0; q < h.length; q++) {
    if (h[q] < terrain.min) { terrain.min = h[q]; }
    if (h[q] > terrain.max) { terrain.max = h[q]; }
  }
  return terrain;
}

/* Bilinear sample of the cached heightfield. */
function colonyHeightAt(x, z) {
  var t = colonyTerrain;
  if (!t) { return 0; }
  var fx = x / t.cell, fz = z / t.cell;
  var i = Math.floor(fx), j = Math.floor(fz);
  if (i < 0) { i = 0; } if (j < 0) { j = 0; }
  if (i > t.cols - 2) { i = t.cols - 2; }
  if (j > t.rows - 2) { j = t.rows - 2; }
  var u = fx - i, v = fz - j;
  var cols = t.cols;
  var h00 = t.h[j * cols + i];
  var h10 = t.h[j * cols + i + 1];
  var h01 = t.h[(j + 1) * cols + i];
  var h11 = t.h[(j + 1) * cols + i + 1];
  return (h00 * (1 - u) + h10 * u) * (1 - v) + (h01 * (1 - u) + h11 * u) * v;
}

/* The ground normal, used for shading. Approximated from the
   neighbouring samples rather than differentiated analytically,
   because it is only ever read at grid corners anyway. */
function colonyShadeAt(x, z) {
  var d = COLONY.cell;
  var hL = colonyHeightAt(x - d, z);
  var hR = colonyHeightAt(x + d, z);
  var hU = colonyHeightAt(x, z - d);
  var hD = colonyHeightAt(x, z + d);
  var nx = (hL - hR) / (2 * d);
  var nz = (hU - hD) / (2 * d);
  var len = Math.sqrt(nx * nx + 1 + nz * nz);
  return { x: nx / len, y: 1 / len, z: nz / len };
}

/* ------------------------------------------------------------
   5. THE ISOMETRIC PROJECTION
   ------------------------------------------------------------ */

function colonyIsoX(wx, wz) { return (wx - wz) * COLONY.isoX; }
function colonyIsoY(wx, wz, wy) { return (wx + wz) * COLONY.isoY - (wy || 0) * COLONY.isoZ; }

function colonyProject(wx, wy, wz) {
  return { x: colonyIsoX(wx, wz), y: colonyIsoY(wx, wz, wy) };
}

/* Screen position of a world point, given the camera. */
function colonyToScreen(wx, wy, wz) {
  var p = colonyProject(wx, wy, wz);
  return {
    x: (p.x - colonyCamera.isoX) * colonyCamera.zoom + colonyCamera.vw / 2,
    y: (p.y - colonyCamera.isoY) * colonyCamera.zoom + colonyCamera.vh / 2
  };
}

/* Screen position back into the ground plane, which is what a click
   on the terrain needs. Because the projection has no height term
   this is exact for any point on the flat plane; the caller adds the
   terrain height back in afterwards. */
function colonyScreenToGround(sx, sy) {
  var ix = (sx - colonyCamera.vw / 2) / colonyCamera.zoom + colonyCamera.isoX;
  var iy = (sy - colonyCamera.vh / 2) / colonyCamera.zoom + colonyCamera.isoY;
  /* ix = (wx - wz) * 0.5 ; iy = (wx + wz) * 0.25
     so  wx = ix/0.5 + iy/0.25 ; wz = -ix/0.5 + iy/0.25 */
  return {
    x: ix / COLONY.isoX + iy / COLONY.isoY,
    z: -ix / COLONY.isoX + iy / COLONY.isoY
  };
}

/* ------------------------------------------------------------
   6. THE CAMERA
   ------------------------------------------------------------ */

var colonyCamera = {
  isoX: 0, isoY: 0,
  vw: 0, vh: 0,
  zoom: 0.8,
  /* follow the astronaut by default, but let the player drag free */
  follow: true,
  dragging: false,
  dragMoved: false,
  lastX: 0, lastY: 0,
  /* set while the player has deliberately panned, so a click is not
     mistaken for the end of a drag */
  movedSincePress: false
};

function colonyClampCamera() {
  var pad = 240;
  var halfW = colonyCamera.vw / 2 / colonyCamera.zoom;
  var halfH = colonyCamera.vh / 2 / colonyCamera.zoom;

  /* The playable area corners, in isometric space. */
  var corners = [
    colonyProject(0, 0, 0),
    colonyProject(COLONY.worldW, 0, 0),
    colonyProject(0, 0, COLONY.worldD),
    colonyProject(COLONY.worldW, 0, COLONY.worldD)
  ];
  var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (var i = 0; i < corners.length; i++) {
    if (corners[i].x < minX) { minX = corners[i].x; }
    if (corners[i].x > maxX) { maxX = corners[i].x; }
    if (corners[i].y < minY) { minY = corners[i].y; }
    if (corners[i].y > maxY) { maxY = corners[i].y; }
  }
  colonyCamera.minX = minX - pad;
  colonyCamera.maxX = maxX + pad;
  colonyCamera.minY = minY - pad;
  colonyCamera.maxY = maxY + pad;

  colonyCamera.isoX = Math.max(minX - pad, Math.min(maxX + pad, colonyCamera.isoX));
  colonyCamera.isoY = Math.max(minY - pad, Math.min(maxY + pad, colonyCamera.isoY));

  /* When the view is zoomed out past the size of the colony, centring
     is nicer than letting the edges show void. */
  if ((maxX - minX) < halfW * 2) { colonyCamera.isoX = (minX + maxX) / 2; }
  if ((maxY - minY) < halfH * 2) { colonyCamera.isoY = (minY + maxY) / 2; }
}

function colonyZoomAt(sx, sy, factor) {
  var before = colonyScreenToGround(sx, sy);
  colonyCamera.zoom = Math.max(COLONY.zoomMin,
                       Math.min(COLONY.zoomMax, colonyCamera.zoom * factor));
  /* Keep the point under the cursor where it was. */
  var after = colonyScreenToGround(sx, sy);
  colonyCamera.isoX += (after.x - before.x) * COLONY.isoX - (after.z - before.z) * COLONY.isoX;
  colonyCamera.isoY -= ((after.x - before.x) + (after.z - before.z)) * COLONY.isoY;
  colonyClampCamera();
}

/* ------------------------------------------------------------
   7. COLONY STATE
   ------------------------------------------------------------ */

var colony = {
  open: false,
  running: false,
  loopHandle: null,
  lastTime: 0,
  t: 0,
  selected: null,        /* uid of the inspected structure */
  armed: null,           /* type id waiting to be placed */
  draggingUid: null,
  draggingFrom: null,
  mode: 'survey',        /* 'survey' or 'build' */
  astronaut: { x: 4700, z: 3300, facing: 1, walkPhase: 0 },
  message: '',
  messageUntil: 0,
  hoverUid: null,
  /* Dust storm state */
  dustStorm: { active: false, intensity: 0, particles: [], nextStorm: 0 },
  /* Emergency/failure visual state */
  emergencies: {},       /* type -> { active: true, since: time } */
  /* Day/night cycle */
  dayCyclePhase: 0,
  /* Resource flow animation */
  flowAnimTime: 0,
  /* Screen shake for emergencies */
  screenShake: 0
};

function colonyNotify(text, seconds) {
  colony.message = text;
  colony.messageUntil = colony.t + (seconds || 3);
}

function colonyIsEditable() {
  /* Building is offered exactly where it already is: in the 2D
     builder, before the mission launches. `builder.open` is the honest
     signal for that, because `startMission` closes the builder and
     deliberately stops `game.layout` being changed halfway through a
     mission. Reaching this view from the builder therefore gives a
     plan you can edit; reaching it from the game HUD gives a survey
     you can inspect and service but not rebuild. */
  return (typeof builder !== 'undefined' && !!builder && builder.open === true);
}

/* ------------------------------------------------------------
   8. THE BRIDGE TO THE REAL BASE

   This is the only place the colony touches layout data. It reads
   whichever layout is currently authoritative - the builder's plan
   before launch, the mission's layout after - and writes back
   through the same public functions the rest of the game uses.
   ------------------------------------------------------------ */

function colonyLayout() {
  if (typeof builder !== 'undefined' && builder && builder.layout) { return builder.layout; }
  if (typeof game !== 'undefined' && game && game.layout) { return game.layout; }
  return [];
}

function colonyTypeInfo(type) {
  if (typeof STATION_TYPE_INDEX !== 'undefined' && STATION_TYPE_INDEX[type]) {
    return STATION_TYPE_INDEX[type];
  }
  return { id: type, name: type, role: '', cost: 0, limit: 1 };
}

/* A stable, well spread slot for every placed structure.

   The player's layout is a line of x positions along the 2D strip.
   Here that line is turned into a place in a real settlement: the
   position along the strip chooses the slot inside the zone, and the
   zone decides where in the colony that is. The result is spread out
   rather than a row, and it is stable, so moving a module in the 2D
   builder visibly moves it here too. */
function colonySlots() {
  var layout = colonyLayout();
  var byZone = {};
  var i, z;

  for (z = 0; z < COLONY_ZONES.length; z++) { byZone[COLONY_ZONES[z].id] = []; }

  /* sort by x so the order the player built in is respected */
  var sorted = layout.slice().sort(function (a, b) { return a.x - b.x; });
  var counts = {};
  for (i = 0; i < sorted.length; i++) {
    var zoneId = COLONY_TYPE_ZONE[sorted[i].type] || 'habitat';
    counts[zoneId] = (counts[zoneId] || 0);
    byZone[zoneId].push(sorted[i]);
    counts[zoneId]++;
  }

  /* each zone gets a row of buildable plots, inside its rectangle */
  var PLOT_W = 330, PLOT_D = 300;
  var out = [];
  for (z = 0; z < COLONY_ZONES.length; z++) {
    var zone = COLONY_ZONES[z];
    var items = byZone[zone.id];
    var cols = Math.max(1, Math.min(4, Math.ceil(Math.sqrt(items.length || 1))));
    for (i = 0; i < items.length; i++) {
      var col = i % cols, row = Math.floor(i / cols);
      var rowsUsed = Math.max(1, Math.ceil(items.length / cols));
      /* centred in the zone */
      var ox = zone.x - ((cols - 1) * PLOT_W) / 2 + col * PLOT_W;
      var oz = zone.z - ((rowsUsed - 1) * PLOT_D) / 2 + row * PLOT_D;
      out.push({
        uid: items[i].uid,
        type: items[i].type,
        zone: zone.id,
        x: ox,
        z: oz,
        ground: colonyHeightAt(ox, oz)
      });
    }
  }
  return out;
}

/* A free plot inside a zone, for placing a new structure. */
function colonyFreePlot(zoneId, layout) {
  var zone = null, i;
  for (i = 0; i < COLONY_ZONES.length; i++) {
    if (COLONY_ZONES[i].id === zoneId) { zone = COLONY_ZONES[i]; }
  }
  if (!zone) { return null; }

  var taken = colonySlots();
  var PLOT_W = 330, PLOT_D = 300;
  for (var row = 0; row < 3; row++) {
    for (var col = 0; col < 4; col++) {
      var px = zone.x - (3 * PLOT_W) / 2 + col * PLOT_W;
      var pz = zone.z - PLOT_D + row * PLOT_D;
      var clash = false;
      for (i = 0; i < taken.length; i++) {
        if (Math.abs(taken[i].x - px) < 200 && Math.abs(taken[i].z - pz) < 200) {
          clash = true; break;
        }
      }
      if (clash) { continue; }
      /* never inside a crater bowl */
      var gy = colonyHeightAt(px, pz);
      var slope = Math.abs(colonyHeightAt(px + 60, pz) - gy) +
                  Math.abs(colonyHeightAt(px, pz + 60) - gy);
      if (slope > 26) { continue; }
      return { x: px, z: pz, ground: gy };
    }
  }
  return null;
}

/* ------------------------------------------------------------
   9. ISO DRAWING PRIMITIVES

   Everything in the colony is built from these four shapes. Keeping
   them here means a habitat, a storage container and a solar array
   are all lit from the same direction and cast the same shadows.
   ------------------------------------------------------------ */

function colonyIsoBox(ctx, cx, cy, cz, w, h, d, colTop, colLeft, colRight) {
  /* cx,cz centre of the footprint; cy is the ground it stands on */
  var hw = w / 2, hd = d / 2;
  var t = COLONY.isoZ * h;

  var a = colonyIsoX(cx - hw, cz - hd), b = colonyIsoY(cx - hw, cz - hd, cy);
  var bq = colonyIsoX(cx + hw, cz - hd), bqy = colonyIsoY(cx + hw, cz - hd, cy);
  var c = colonyIsoX(cx + hw, cz + hd), cyy = colonyIsoY(cx + hw, cz + hd, cy);
  var e = colonyIsoX(cx - hw, cz + hd), ey = colonyIsoY(cx - hw, cz + hd, cy);

  /* the two visible sides */
  ctx.fillStyle = colLeft;
  ctx.beginPath();
  ctx.moveTo(a, b - t); ctx.lineTo(bq, bqy - t); ctx.lineTo(bq, bqy); ctx.lineTo(a, b);
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = colRight;
  ctx.beginPath();
  ctx.moveTo(bq, bqy - t); ctx.lineTo(c, cyy - t); ctx.lineTo(c, cyy); ctx.lineTo(bq, bqy);
  ctx.closePath(); ctx.fill();

  /* the top */
  ctx.fillStyle = colTop;
  ctx.beginPath();
  ctx.moveTo(a, b - t); ctx.lineTo(bq, bqy - t); ctx.lineTo(c, cyy - t); ctx.lineTo(e, ey - t);
  ctx.closePath(); ctx.fill();
}

/* A horizontal disc: the base of every cylinder, dome and tank. */
function colonyIsoDisc(ctx, cx, cy, cz, r, fill, stroke) {
  ctx.beginPath();
  for (var i = 0; i <= 18; i++) {
    var a = (i / 18) * Math.PI * 2;
    var px = cx + Math.cos(a) * r;
    var pz = cz + Math.sin(a) * r;
    var sx = colonyIsoX(px, pz), sy = colonyIsoY(px, pz, cy);
    if (i === 0) { ctx.moveTo(sx, sy); } else { ctx.lineTo(sx, sy); }
  }
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
}

/* A vertical cylinder. Used for habitats, tanks and masts. */
function colonyIsoCylinder(ctx, cx, cy, cz, r, h, colBody, colTop) {
  var steps = 14;
  var t = COLONY.isoZ * h;

  /* Only the near half of the cylinder is drawn: the far half is
     always hidden behind the near half from this angle. */
  ctx.beginPath();
  for (var i = 0; i <= steps; i++) {
    var a = (i / steps) * Math.PI;
    var px = cx + Math.cos(Math.PI + a) * r;
    var pz = cz + Math.sin(Math.PI + a) * r;
    var sx = colonyIsoX(px, pz), sy = colonyIsoY(px, pz, cy);
    if (i === 0) { ctx.moveTo(sx, sy); } else { ctx.lineTo(sx, sy); }
  }
  for (var j = steps; j >= 0; j--) {
    var b = (j / steps) * Math.PI;
    var qx = cx + Math.cos(Math.PI + b) * r, qz = cz + Math.sin(Math.PI + b) * r;
    ctx.lineTo(colonyIsoX(qx, qz), colonyIsoY(qx, qz, cy + h));
  }
  ctx.closePath();
  ctx.fillStyle = colBody; ctx.fill();

  /* cap */
  colonyIsoDisc(ctx, cx, cy + h, cz, r, colTop, null);
}

/* A geodesic glass dome. The meridians are what make it read as a
   geodesic rather than a party tent. */
function colonyIsoDome(ctx, cx, cy, cz, r, h, glass, frame) {
  var steps = 16;
  var t = COLONY.isoZ * h;

  /* shell */
  ctx.beginPath();
  for (var i = 0; i <= steps; i++) {
    var a = (i / steps) * Math.PI;
    var px = cx + Math.cos(Math.PI + a) * r;
    var pz = cz + Math.sin(Math.PI + a) * r;
    var sx = colonyIsoX(px, pz), sy = colonyIsoY(px, pz, cy);
    if (i === 0) { ctx.moveTo(sx, sy); } else { ctx.lineTo(sx, sy); }
  }
  ctx.lineTo(colonyIsoX(cx, cz), colonyIsoY(cx, cz, cy + h));
  ctx.lineTo(colonyIsoX(cx + r, cz), colonyIsoY(cx + r, cz, cy));
  ctx.closePath();
  ctx.fillStyle = glass; ctx.fill();

  /* meridians */
  ctx.strokeStyle = frame;
  ctx.lineWidth = 1;
  for (var m = 1; m < 5; m++) {
    var ang = (m / 5) * Math.PI;
    var ex = cx + Math.cos(ang) * r * 0.92;
    var ez = cz + Math.sin(ang) * r * 0.92;
    ctx.beginPath();
    ctx.moveTo(colonyIsoX(ex, ez), colonyIsoY(ex, ez, cy));
    ctx.quadraticCurveTo(
      colonyIsoX((cx + ex) / 2, (cz + ez) / 2),
      colonyIsoY((cx + ex) / 2, (cz + ez) / 2, cy + h * 0.72),
      colonyIsoX(cx, cz), colonyIsoY(cx, cz, cy + h));
    ctx.stroke();
  }

  /* latitude hoops */
  for (var L = 1; L <= 2; L++) {
    var f = L / 3;
    var rr = r * Math.cos(f * Math.PI / 2);
    var yy = cy + h * Math.sin(f * Math.PI / 2);
    ctx.beginPath();
    for (var k = 0; k <= steps; k++) {
      var b = (k / steps) * Math.PI * 2;
      var qx = cx + Math.cos(b) * rr, qz = cz + Math.sin(b) * rr;
      var qx2 = colonyIsoX(qx, qz), qy2 = colonyIsoY(qx, qz, yy);
      if (k === 0) { ctx.moveTo(qx2, qy2); } else { ctx.lineTo(qx2, qy2); }
    }
    ctx.closePath();
    ctx.stroke();
  }
}

/* A solar panel on a mast, tilted to face the sun. */
function colonyIsoPanel(ctx, cx, cy, cz, w, d, tilt, frame) {
  var hw = w / 2, hd = d / 2;
  var lift = COLONY.isoZ * (cy + 26);

  ctx.save();
  var s = colonyToScreen(cx, cy + 26, cz);
  ctx.translate(s.x, s.y);

  /* the quad, skewed by the isometric angles and tipped toward the sun */
  ctx.beginPath();
  ctx.moveTo(-hw * COLONY.isoX * 2, -lift * 0 + tilt * 6);
  ctx.lineTo(0, -hd * COLONY.isoY * 2 - tilt * 10);
  ctx.lineTo(w * COLONY.isoX, 0 - tilt * 6);
  ctx.lineTo(0, hd * COLONY.isoY * 2 - tilt * 10);
  ctx.closePath();
  var g = ctx.createLinearGradient(-w * COLONY.isoX, 0, w * COLONY.isoX, 0);
  g.addColorStop(0, '#1b2740');
  g.addColorStop(0.5, '#2e4370');
  g.addColorStop(1, '#16203a');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = frame; ctx.lineWidth = 1.2; ctx.stroke();

  /* cell divisions */
  ctx.strokeStyle = 'rgba(150,180,230,0.35)';
  ctx.lineWidth = 0.6;
  for (var i = 1; i < 5; i++) {
    var f = i / 5;
    ctx.beginPath();
    ctx.moveTo(-hw * COLONY.isoX * 2 + (hw * COLONY.isoX * 2) * f, -hd * COLONY.isoY * 2 * f - tilt * 10 + tilt * 6 * f);
    ctx.lineTo(w * COLONY.isoX * f, -hd * COLONY.isoY * 2 * f - tilt * 10 + hd * COLONY.isoY * 2 * f);
    ctx.stroke();
  }
  ctx.restore();

  /* mast */
  var base = colonyToScreen(cx, cy, cz);
  ctx.strokeStyle = '#6c7280';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(base.x, base.y);
  ctx.lineTo(s.x, s.y);
  ctx.stroke();
}

function colonyShadow(ctx, cx, cy, cz, w, d, h) {
  var sun = colonyGetSunDirection();
  var len = h / Math.tan(Math.max(0.05, COLONY.sunAltitude));
  var dx = sun.x * len;
  var dz = sun.z * len;

  var a = colonyIsoX(cx - w / 2 + dx, cz - d / 2 + dz);
  var ay = colonyIsoY(cx - w / 2 + dx, cz - d / 2 + dz, cy);
  var b = colonyIsoX(cx + w / 2 + dx, cz - d / 2 + dz);
  var by = colonyIsoY(cx + w / 2 + dx, cz - d / 2 + dz, cy);
  var c = colonyIsoX(cx + w / 2 + dx, cz + d / 2 + dz);
  var cyy = colonyIsoY(cx + w / 2 + dx, cz + d / 2 + dz, cy);
  var e = colonyIsoX(cx - w / 2 + dx, cz + d / 2 + dz);
  var ey = colonyIsoY(cx - w / 2 + dx, cz + d / 2 + dz, cy);

  ctx.beginPath();
  ctx.moveTo(a, ay); ctx.lineTo(b, by); ctx.lineTo(c, cyy); ctx.lineTo(e, ey);
  ctx.closePath();
  ctx.fillStyle = 'rgba(2,3,7,0.46)';
  ctx.fill();
}

/* ------------------------------------------------------------
   10. THE STRUCTURES

   Every one of the eight buildable types gets its own silhouette,
   because a player who has to read a label to tell the oxygen plant
   from the water recycler has not been given a colony, they have
   been given a spreadsheet.
   ------------------------------------------------------------ */

var COLONY_STRUCTURE_HEIGHT = {
  habitat: 74, oxygen: 62, water: 58, food: 56,
  solar: 40, depot: 48, console: 66, pad: 14
};

function colonyDrawStructure(ctx, slot, index) {
  var gy = slot.ground;
  var type = slot.type;
  var info = colonyTypeInfo(type);
  var w = 190, d = 150;
  var h = COLONY_STRUCTURE_HEIGHT[type] || 50;

  /* Check for emergency/failure state */
  var isEmergency = colony.emergencies[type] && colony.emergencies[type].active;
  var isFailed = false;
  if (typeof conditionOf === 'function') {
    try { isFailed = conditionOf(type) < 35; } catch (e) {}
  }

  /* the shadow goes down first, on the ground */
  colonyShadow(ctx, slot.x, gy, slot.z, w, d, h);

  /* Emergency pulse effect */
  if (isEmergency) {
    var pulse = 0.5 + 0.5 * Math.sin(colony.t * 0.01);
    ctx.save();
    ctx.globalAlpha = 0.3 + 0.3 * Math.sin(colony.t * 0.02);
    colonyShadow(ctx, slot.x, gy, slot.z, w + 20, d + 20, h + 10);
    ctx.restore();
  }

  var metal = '#8d939f', metalDark = '#5d626d', metalTop = '#b6bcc6';
  var panel = '#d7a13a';
  var glass = 'rgba(120,190,215,0.42)';
  var frame = 'rgba(200,225,240,0.55)';

  if (type === 'habitat') {
    /* A pressurised module is a cylinder on end, not a box. The
       colony has three of them clustered, joined by an airlock. */
    colonyIsoCylinder(ctx, slot.x - 70, gy, slot.z, 46, 62, metalDark, metal);
    colonyIsoCylinder(ctx, slot.x + 60, gy, slot.z - 26, 40, 54, metal, metalTop);
    colonyIsoBox(ctx, slot.x - 6, gy, slot.z + 44, 70, 40, 44, metalTop, metalDark, metal);
    /* gold foil, which is what every real lander is wrapped in */
    colonyIsoBox(ctx, slot.x + 60, gy, slot.z + 18, 46, 22, 40, panel, '#9c6f1e', '#b98526');
  } else if (type === 'oxygen') {
    /* gas spheres on a skid, with pipework between them */
    colonyIsoDisc(ctx, slot.x, gy, slot.z, 74, 'rgba(0,0,0,0.18)');
    colonyIsoCylinder(ctx, slot.x - 44, gy, slot.z, 34, 78, '#cfd4dc', '#e6e9ee');
    colonyIsoCylinder(ctx, slot.x + 44, gy, slot.z - 12, 30, 62, '#c2c8d2', '#dfe3e9');
    ctx.strokeStyle = '#9aa2ae'; ctx.lineWidth = 4;
    var p1 = colonyToScreen(slot.x - 44, gy + 30, slot.z);
    var p2 = colonyToScreen(slot.x + 44, gy + 30, slot.z - 12);
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    colonyIsoBox(ctx, slot.x, gy, slot.z + 52, 120, 26, 34, metalTop, metalDark, metal);
  } else if (type === 'water') {
    /* round storage tanks, low and wide */
    colonyIsoDisc(ctx, slot.x, gy, slot.z, 78, 'rgba(0,0,0,0.18)');
    colonyIsoCylinder(ctx, slot.x - 52, gy, slot.z - 8, 38, 46, '#7f8794', '#a8b0bd');
    colonyIsoCylinder(ctx, slot.x + 48, gy, slot.z + 6, 34, 42, '#767e8b', '#9ea6b3');
    colonyIsoBox(ctx, slot.x, gy, slot.z + 58, 140, 34, 40, metalTop, metalDark, metal);
  } else if (type === 'food') {
    /* a geodesic glass dome with something green under it - the only
       living colour in the whole colony, and it earns it */
    colonyIsoDome(ctx, slot.x, gy, slot.z, 82, 66, 'rgba(126,200,170,0.38)', 'rgba(214,240,230,0.7)');
    colonyIsoDisc(ctx, slot.x, gy + 2, slot.z, 58, 'rgba(76,150,104,0.55)', null);
    colonyIsoBox(ctx, slot.x + 96, gy, slot.z + 30, 60, 30, 44, metalTop, metalDark, metal);
  } else if (type === 'solar') {
    /* a big array of rows plus one small array, which is what the
       brief asks for: large AND small solar arrays */
    for (var r = 0; r < 3; r++) {
      for (var c = 0; c < 3; c++) {
        colonyIsoPanel(ctx,
          slot.x - 78 + c * 78, gy, slot.z - 70 + r * 62,
          86, 52, 14, '#8fa2c8');
      }
    }
    colonyIsoPanel(ctx, slot.x + 108, gy, slot.z + 54, 58, 40, 14, '#8fa2c8');
    colonyIsoBox(ctx, slot.x, gy, slot.z + 96, 96, 22, 30, metalTop, metalDark, metal);
  } else if (type === 'depot') {
    /* stacked containers and a rover parked alongside */
    colonyIsoBox(ctx, slot.x - 62, gy, slot.z - 30, 74, 40, 60, '#9aa1ad', '#61666f', '#7b8089');
    colonyIsoBox(ctx, slot.x - 62, gy + 40, slot.z - 30, 74, 34, 60, '#a6adb9', '#6a6f78', '#848a94');
    colonyIsoBox(ctx, slot.x + 30, gy, slot.z + 18, 66, 34, 54, '#8f96a2', '#5c616a', '#767b84');
    colonyIsoBox(ctx, slot.x + 96, gy, slot.z - 40, 46, 26, 38, metalTop, metalDark, metal);
  } else if (type === 'console') {
    /* a low operations block with an antenna mast and a dish */
    colonyIsoBox(ctx, slot.x, gy, slot.z + 20, 150, 40, 76, metalTop, metalDark, metal);
    colonyIsoBox(ctx, slot.x - 40, gy + 40, slot.z + 20, 58, 20, 52, '#9fd8e8', '#4d7f90', '#6fa8bb');
    ctx.strokeStyle = '#7b828e'; ctx.lineWidth = 3;
    var base = colonyToScreen(slot.x + 56, gy, slot.z - 30);
    var top = colonyToScreen(slot.x + 56, gy + 150, slot.z - 30);
    ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(top.x, top.y); ctx.stroke();
    ctx.fillStyle = '#c8453f';
    ctx.beginPath(); ctx.arc(top.x, top.y, 4, 0, Math.PI * 2); ctx.fill();
    /* dish */
    ctx.fillStyle = '#b9bfc9';
    ctx.beginPath(); ctx.ellipse(base.x + 2, base.y - 26, 22, 9, -0.5, 0, Math.PI * 2); ctx.fill();
  } else if (type === 'pad') {
    /* a marked landing pad: a ring of chevrons and four beacons */
    colonyIsoDisc(ctx, slot.x, gy + 1, slot.z, 128, 'rgba(20,22,28,0.55)', 'rgba(210,215,225,0.5)');
    colonyIsoDisc(ctx, slot.x, gy + 2, slot.z, 96, 'rgba(40,44,52,0.5)', 'rgba(210,215,225,0.28)');
    ctx.strokeStyle = 'rgba(226,230,240,0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(colonyIsoX(slot.x - 44, slot.z), colonyIsoY(slot.x - 44, slot.z, gy + 3));
    ctx.lineTo(colonyIsoX(slot.x + 44, slot.z), colonyIsoY(slot.x + 44, slot.z, gy + 3));
    ctx.moveTo(colonyIsoX(slot.x, slot.z - 44), colonyIsoY(slot.x, slot.z - 44, gy + 3));
    ctx.lineTo(colonyIsoX(slot.x, slot.z + 44), colonyIsoY(slot.x, slot.z + 44, gy + 3));
    ctx.stroke();
    for (var b = 0; b < 4; b++) {
      var ba = (b / 4) * Math.PI * 2 + Math.PI / 4;
      colonyIsoDisc(ctx, slot.x + Math.cos(ba) * 122, gy + 4, slot.z + Math.sin(ba) * 122,
        7, '#d8b64a', null);
    }
  }

  /* a selection ring, so the player can see what they clicked */
  if (colony.selected === slot.uid || colony.hoverUid === slot.uid) {
    var sel = colony.selected === slot.uid;
    ctx.strokeStyle = sel ? '#ffd166' : 'rgba(255,209,102,0.45)';
    ctx.lineWidth = sel ? 2.5 : 1.5;
    ctx.beginPath();
    for (var i = 0; i <= 24; i++) {
      var ang = (i / 24) * Math.PI * 2;
      var px = slot.x + Math.cos(ang) * (w / 2 + 16);
      var pz = slot.z + Math.sin(ang) * (d / 2 + 16);
      var sx = colonyIsoX(px, pz), sy = colonyIsoY(px, pz, gy + 2);
      if (i === 0) { ctx.moveTo(sx, sy); } else { ctx.lineTo(sx, sy); }
    }
    ctx.closePath(); ctx.stroke();
  }

  /* Emergency/failure indicator on top of structure */
  if (isEmergency || isFailed) {
    var lp = colonyToScreen(slot.x, gy + h + 30, slot.z);
    ctx.save();
    var pulse = 0.5 + 0.5 * Math.sin(colony.t * 0.015);
    ctx.fillStyle = isFailed ? 'rgba(251, 113, 133, ' + (0.8 + 0.2 * Math.sin(colony.t * 0.02)) + ')' : 'rgba(251, 191, 36, ' + (0.8 + 0.2 * Math.sin(colony.t * 0.02)) + ')';
    ctx.beginPath();
    ctx.arc(lp.x, lp.y - 20, 8 * colonyCamera.zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = 'bold 10px "Segoe UI", sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(isFailed ? 'FAILED' : 'EMERGENCY', lp.x, lp.y + 4);
    ctx.restore();
  }

  /* a floating label, small, only when zoomed in enough to read */
  if (colonyCamera.zoom > 0.62) {
    var lp = colonyToScreen(slot.x, gy + h + 26, slot.z);
    var label = info.name;
    ctx.font = '600 12px "Segoe UI", sans-serif';
    var tw = ctx.measureText(label).width + 16;
    ctx.fillStyle = 'rgba(8,10,18,0.82)';
    ctx.beginPath();
    ctx.roundRect(lp.x - tw / 2, lp.y - 15, tw, 21, 6);
    ctx.fill();
    ctx.strokeStyle = sel ? '#ffd166' : 'rgba(140,160,190,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = sel ? '#ffd166' : '#d6dde8';
    ctx.textAlign = 'center';
    ctx.fillText(label, lp.x, lp.y);
  }
}

/* ------------------------------------------------------------
   11. SCENERY

   The rest of the settlement: the parts that make it a place rather
   than a diagram. None of this is interactive, and all of it is
   generated from the same seed as the terrain.
   ------------------------------------------------------------ */

function colonyScenery() {
  var items = [];
  var seed = colonyTerrain ? colonyTerrain.seed : 1;
  var i, j;

  /* ---- paths between the zones ---- */
  var hub = { x: 4700, z: 3300 };
  for (i = 0; i < COLONY_ZONES.length; i++) {
    var z0 = COLONY_ZONES[i];
    items.push({ kind: 'path', a: { x: hub.x, z: hub.z }, b: { x: z0.x, z: z0.z } });
  }
  /* and a ring road, so the zones are not a star */
  for (i = 0; i < COLONY_ZONES.length; i++) {
    var za = COLONY_ZONES[i];
    var zb = COLONY_ZONES[(i + 1) % COLONY_ZONES.length];
    items.push({ kind: 'path', a: { x: za.x, z: za.z }, b: { x: zb.x, z: zb.z } });
  }

  /* ---- per-zone scenery ---- */
  for (i = 0; i < COLONY_ZONES.length; i++) {
    var zone = COLONY_ZONES[i];

    if (zone.id === 'habitat') {
      items.push({ kind: 'dome', x: zone.x - 420, z: zone.z + 260, r: 120, h: 96, hue: 'green' });
      items.push({ kind: 'dome', x: zone.x + 430, z: zone.z - 300, r: 96, h: 78, hue: 'glass' });
      items.push({ kind: 'cylinder', x: zone.x - 430, z: zone.z - 300, r: 44, h: 66 });
      items.push({ kind: 'box', x: zone.x + 20, z: zone.z + 420, w: 190, h: 30, d: 110 });
      items.push({ kind: 'mast', x: zone.x + 480, z: zone.z + 300 });
      /* Additional habitat modules */
      items.push({ kind: 'cylinder', x: zone.x - 600, z: zone.z + 100, r: 38, h: 58 });
      items.push({ kind: 'cylinder', x: zone.x - 580, z: zone.z - 180, r: 36, h: 54 });
      items.push({ kind: 'dome', x: zone.x + 200, z: zone.z - 400, r: 80, h: 70, hue: 'green' });
    }

    if (zone.id === 'power') {
      for (j = 0; j < 3; j++) {
        items.push({ kind: 'panels', x: zone.x - 560 + j * 500, z: zone.z - 320, rows: 3, cols: 3 });
      }
      items.push({ kind: 'panels', x: zone.x - 100, z: zone.z + 400, rows: 1, cols: 2, small: true });
      items.push({ kind: 'cylinder', x: zone.x + 520, z: zone.z + 250, r: 40, h: 52 });
      items.push({ kind: 'cylinder', x: zone.x + 620, z: zone.z + 180, r: 40, h: 52 });
      items.push({ kind: 'box', x: zone.x + 80, z: zone.z + 120, w: 150, h: 34, d: 100 });
      /* Additional solar arrays */
      items.push({ kind: 'panels', x: zone.x - 800, z: zone.z - 100, rows: 2, cols: 4 });
      items.push({ kind: 'panels', x: zone.x + 900, z: zone.z + 500, rows: 1, cols: 3, small: true });
      items.push({ kind: 'cylinder', x: zone.x - 400, z: zone.z + 400, r: 30, h: 40 });
    }

    if (zone.id === 'research') {
      items.push({ kind: 'dome', x: zone.x - 380, z: zone.z - 300, r: 132, h: 108, hue: 'glass' });
      items.push({ kind: 'box', x: zone.x + 60, z: zone.z - 120, w: 240, h: 44, d: 130 });
      items.push({ kind: 'box', x: zone.x + 60, z: zone.z + 90, w: 180, h: 36, d: 110 });
      items.push({ kind: 'mast', x: zone.x + 420, z: zone.z + 300, tall: true });
      items.push({ kind: 'dish', x: zone.x - 120, z: zone.z + 380 });
      /* Additional research modules */
      items.push({ kind: 'dome', x: zone.x - 600, z: zone.z + 200, r: 90, h: 80, hue: 'glass' });
      items.push({ kind: 'box', x: zone.x - 400, z: zone.z - 400, w: 160, h: 40, d: 100 });
      items.push({ kind: 'mast', x: zone.x + 600, z: zone.z - 200, tall: true });
    }

    if (zone.id === 'resource') {
      items.push({ kind: 'cylinder', x: zone.x - 470, z: zone.z - 260, r: 52, h: 62 });
      items.push({ kind: 'cylinder', x: zone.x - 350, z: zone.z - 320, r: 46, h: 54 });
      items.push({ kind: 'box', x: zone.x + 120, z: zone.z - 240, w: 200, h: 46, d: 120 });
      for (j = 0; j < 4; j++) {
        items.push({ kind: 'container', x: zone.x - 300 + j * 120, z: zone.z + 300, stack: j % 2 });
      }
      items.push({ kind: 'mast', x: zone.x + 480, z: zone.z - 340 });
      /* Additional resource modules */
      items.push({ kind: 'cylinder', x: zone.x - 600, z: zone.z + 100, r: 40, h: 50 });
      items.push({ kind: 'cylinder', x: zone.x + 500, z: zone.z + 400, r: 36, h: 48 });
    }

    if (zone.id === 'exploration') {
      for (j = 0; j < 3; j++) {
        items.push({ kind: 'rover', x: zone.x - 320 + j * 300, z: zone.z + 300, rot: 0.4 });
      }
      items.push({ kind: 'box', x: zone.x + 40, z: zone.z - 300, w: 170, h: 30, d: 96 });
      for (j = 0; j < 6; j++) {
        items.push({
          kind: 'marker',
          x: zone.x - 600 + colonyHash(j, 3, seed) * 1200,
          z: zone.z - 500 + colonyHash(j, 9, seed) * 380
        });
      }
      /* Additional rovers and activity */
      items.push({ kind: 'rover', x: zone.x - 500, z: zone.z - 200, rot: 0.8 });
      items.push({ kind: 'rover', x: zone.x + 200, z: zone.z + 500, rot: -0.3 });
      items.push({ kind: 'rover', x: zone.x + 600, z: zone.z - 400, rot: 1.2 });
    }

    if (zone.id === 'landing') {
      items.push({ kind: 'pad', x: zone.x, z: zone.z });
      items.push({ kind: 'mast', x: zone.x + 470, z: zone.z - 300 });
      items.push({ kind: 'rover', x: zone.x - 420, z: zone.z + 300, rot: -0.6 });
      items.push({ kind: 'container', x: zone.x + 380, z: zone.z + 320, stack: 1 });
      /* Additional landing zone elements */
      items.push({ kind: 'pad', x: zone.x + 600, z: zone.z + 200 });
      items.push({ kind: 'rover', x: zone.x - 200, z: zone.z - 400, rot: 0.2 });
    }
  }

  /* ---- a few scattered boulders out in the open ---- */
  return items;
}

function colonyDrawSceneryItem(ctx, it) {
  var gy = colonyHeightAt(it.x, it.z);
  var metal = '#8d939f', metalDark = '#5d626d', metalTop = '#b6bcc6';

  if (it.kind === 'path') { return; }   /* drawn under everything */

  if (it.kind === 'dome') {
    colonyShadow(ctx, it.x, gy, it.z, it.r * 1.7, it.r * 1.7, it.h);
    var glass = it.hue === 'green' ? 'rgba(126,200,170,0.34)' : 'rgba(130,190,220,0.36)';
    colonyIsoDome(ctx, it.x, gy, it.z, it.r, it.h, glass, 'rgba(205,228,242,0.55)');
    if (it.hue === 'green') {
      colonyIsoDisc(ctx, it.x, gy + 2, it.z, it.r * 0.7, 'rgba(76,150,104,0.5)', null);
    }
  } else if (it.kind === 'cylinder') {
    colonyShadow(ctx, it.x, gy, it.z, it.r * 2, it.r * 2, it.h);
    colonyIsoCylinder(ctx, it.x, gy, it.z, it.r, it.h, metal, metalTop);
  } else if (it.kind === 'box') {
    colonyShadow(ctx, it.x, gy, it.z, it.w, it.d, it.h);
    colonyIsoBox(ctx, it.x, gy, it.z, it.w, it.h, it.d, metalTop, metalDark, metal);
  } else if (it.kind === 'container') {
    colonyShadow(ctx, it.x, gy, it.z, 96, 72, 40 + it.stack * 34);
    colonyIsoBox(ctx, it.x, gy, it.z, 96, 40, 72, '#a2a9b5', '#63686f', '#7e838c');
    if (it.stack) {
      colonyIsoBox(ctx, it.x + 4, gy + 40, it.z + 4, 92, 34, 68, '#adb4c0', '#6b7078', '#878d96');
    }
  } else if (it.kind === 'panels') {
    var rows = it.rows, cols = it.cols;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var px = it.x - ((cols - 1) * 74) / 2 + c * 74;
        var pz = it.z - ((rows - 1) * 58) / 2 + r * 58;
        colonyIsoPanel(ctx, px, colonyHeightAt(px, pz), pz,
          it.small ? 54 : 84, it.small ? 38 : 50, 14, '#8fa2c8');
      }
    }
  } else if (it.kind === 'mast') {
    var hgt = it.tall ? 210 : 140;
    colonyShadow(ctx, it.x, gy, it.z, 16, 16, hgt);
    var b = colonyToScreen(it.x, gy, it.z);
    var t = colonyToScreen(it.x, gy + hgt, it.z);
    ctx.strokeStyle = '#767d89'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(t.x, t.y); ctx.stroke();
    ctx.strokeStyle = 'rgba(150,158,170,0.6)'; ctx.lineWidth = 1;
    for (var k = 1; k <= 3; k++) {
      var f = k / 4;
      var mx = b.x + (t.x - b.x) * f, my = b.y + (t.y - b.y) * f;
      ctx.beginPath();
      ctx.moveTo(mx - 12 * (1 - f), my); ctx.lineTo(mx + 12 * (1 - f), my);
      ctx.stroke();
    }
    ctx.fillStyle = '#d8564f';
    ctx.beginPath(); ctx.arc(t.x, t.y, 4, 0, Math.PI * 2); ctx.fill();
  } else if (it.kind === 'dish') {
    colonyShadow(ctx, it.x, gy, it.z, 70, 70, 60);
    var db = colonyToScreen(it.x, gy, it.z);
    ctx.strokeStyle = '#767d89'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(db.x, db.y); ctx.lineTo(db.x, db.y - 46); ctx.stroke();
    ctx.fillStyle = '#c3c9d3';
    ctx.beginPath(); ctx.ellipse(db.x, db.y - 52, 30, 13, -0.45, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7c838f';
    ctx.beginPath(); ctx.ellipse(db.x, db.y - 52, 30, 13, -0.45, 0, Math.PI * 2);
    ctx.stroke(); ctx.stroke();
  } else if (it.kind === 'rover') {
    colonyShadow(ctx, it.x, gy, it.z, 92, 62, 28);
    var ry = gy;
    colonyIsoBox(ctx, it.x, ry, it.z, 84, 18, 54, '#b8bec8', '#5f646c', '#7d838c');
    colonyIsoBox(ctx, it.x - 16, ry + 18, it.z, 44, 16, 42, '#cfd5de', '#6b7079', '#8b919b');
    ctx.strokeStyle = '#2b2f36'; ctx.lineWidth = 4;
    var w1 = colonyToScreen(it.x - 44, ry, it.z - 20);
    var w2 = colonyToScreen(it.x + 44, ry, it.z - 20);
    var w3 = colonyToScreen(it.x - 44, ry, it.z + 20);
    var w4 = colonyToScreen(it.x + 44, ry, it.z + 20);
    ctx.beginPath();
    ctx.moveTo(w1.x, w1.y); ctx.lineTo(w2.x, w2.y);
    ctx.moveTo(w3.x, w3.y); ctx.lineTo(w4.x, w4.y);
    ctx.stroke();
  } else if (it.kind === 'marker') {
    var mp = colonyToScreen(it.x, gy, it.z);
    ctx.strokeStyle = 'rgba(230,120,110,0.75)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(mp.x, mp.y); ctx.lineTo(mp.x, mp.y - 22); ctx.stroke();
    ctx.fillStyle = 'rgba(230,120,110,0.85)';
    ctx.beginPath();
    ctx.moveTo(mp.x, mp.y - 22); ctx.lineTo(mp.x + 13, mp.y - 17); ctx.lineTo(mp.x, mp.y - 12);
    ctx.closePath(); ctx.fill();
  } else if (it.kind === 'pad') {
    colonyIsoDisc(ctx, it.x, gy + 1, it.z, 150, 'rgba(20,22,28,0.5)', 'rgba(210,215,225,0.45)');
    colonyIsoDisc(ctx, it.x, gy + 2, it.z, 112, 'rgba(42,46,54,0.45)', 'rgba(210,215,225,0.25)');
    ctx.strokeStyle = 'rgba(226,230,240,0.4)'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(colonyIsoX(it.x - 52, it.z), colonyIsoY(it.x - 52, it.z, gy + 3));
    ctx.lineTo(colonyIsoX(it.x + 52, it.z), colonyIsoY(it.x + 52, it.z, gy + 3));
    ctx.moveTo(colonyIsoX(it.x, it.z - 52), colonyIsoY(it.x, it.z - 52, gy + 3));
    ctx.lineTo(colonyIsoX(it.x, it.z + 52), colonyIsoY(it.x, it.z + 52, gy + 3));
    ctx.stroke();
    for (var b2 = 0; b2 < 4; b2++) {
      var ba = (b2 / 4) * Math.PI * 2 + Math.PI / 4;
      colonyIsoDisc(ctx, it.x + Math.cos(ba) * 144, gy + 4, it.z + Math.sin(ba) * 144,
        8, '#d8b64a', null);
    }
  }
}

/* ------------------------------------------------------------
   12. TERRAIN RENDERING

   The terrain is drawn as a grid of quads, shaded by the surface
   normal against the single sun. Quads are grouped into runs of the
   same shade so the renderer changes fillStyle a handful of times per
   row instead of once per quad, and everything outside the view is
   skipped entirely.
   ------------------------------------------------------------ */

var COLONY_SHADES = ['#3c4048', '#4a4e57', '#585c66', '#666a74',
                     '#757983', '#848892', '#9397a1', '#a2a6af',
                     '#b1b5bd', '#c0c3ca', '#cfd1d7'];

function colonyDrawTerrain(ctx) {
  var t = colonyTerrain;
  if (!t) { return; }

  /* Which world rectangle is on screen? Solved from the four screen
     corners mapped back through the inverse projection. */
  var pts = [
    colonyScreenToGround(0, 0),
    colonyScreenToGround(colonyCamera.vw, 0),
    colonyScreenToGround(0, colonyCamera.vh),
    colonyScreenToGround(colonyCamera.vw, colonyCamera.vh)
  ];
  var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (var p = 0; p < pts.length; p++) {
    minX = Math.min(minX, pts[p].x); maxX = Math.max(maxX, pts[p].x);
    minZ = Math.min(minZ, pts[p].z); maxZ = Math.max(maxZ, pts[p].z);
  }

  var i0 = Math.max(0, Math.floor(minX / t.cell) - 1);
  var i1 = Math.min(t.cols - 2, Math.ceil(maxX / t.cell) + 1);
  var j0 = Math.max(0, Math.floor(minZ / t.cell) - 1);
  var j1 = Math.min(t.rows - 2, Math.ceil(maxZ / t.cell) + 1);

  var sun = colonyGetSunDirection();
  var sx = sun.x, sy = sun.y, sz = sun.z;

  /* Back to front, so nearer ground is drawn over further ground. */
  for (var j = j0; j <= j1; j++) {
    for (var i = i0; i <= i1; i++) {
      var wx = i * t.cell, wz = j * t.cell;
      var n = colonyShadeAt(wx, wz);
      var lam = n.x * sx + n.y * sy + n.z * sz;
      var idx = Math.round(lam * (COLONY_SHADES.length - 1));
      if (idx < 0) { idx = 0; }
      if (idx > COLONY_SHADES.length - 1) { idx = COLONY_SHADES.length - 1; }

      var h00 = t.h[j * t.cols + i];
      var h10 = t.h[j * t.cols + i + 1];
      var h11 = t.h[(j + 1) * t.cols + i + 1];
      var h01 = t.h[(j + 1) * t.cols + i];

      var ax = wx, az = wz, bx = wx + t.cell, bz = wz;
      var cx2 = wx + t.cell, cz2 = wz + t.cell, dx2 = wx, dz2 = wz + t.cell;

      var p0 = colonyToScreen(ax, h00, az);
      var p1 = colonyToScreen(bx, h10, bz);
      var p2 = colonyToScreen(cx2, h11, cz2);
      var p3 = colonyToScreen(dx2, h01, dz2);

      /* cheap back-face reject */
      var area = (p1.x - p0.x) * (p2.y - p0.y) - (p2.x - p0.x) * (p1.y - p0.y);
      if (area <= 0) { continue; }

      ctx.fillStyle = COLONY_SHADES[idx];
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y);
      ctx.closePath();
      ctx.fill();
    }
  }
}

/* Rover tracks, painted on the ground under everything else. */
function colonyDrawPaths(ctx, scenery) {
  for (var i = 0; i < scenery.length; i++) {
    var it = scenery[i];
    if (it.kind !== 'path') { continue; }
    var steps = 22;
    var left = [], right = [];
    for (var s = 0; s <= steps; s++) {
      var f = s / steps;
      var px = it.a.x + (it.b.x - it.a.x) * f;
      var pz = it.a.z + (it.b.z - it.a.z) * f;
      var dx = it.b.x - it.a.x, dz = it.b.z - it.a.z;
      var len = Math.sqrt(dx * dx + dz * dz) || 1;
      var nx = -dz / len, nz = dx / len;
      var w = 26;
      var gy = colonyHeightAt(px, pz);
      var l = colonyToScreen(px + nx * w, gy, pz + nz * w);
      var r = colonyToScreen(px - nx * w, gy, pz - nz * w);
      left.push(l); right.push(r);
    }
    ctx.strokeStyle = 'rgba(24,26,32,0.5)';
    ctx.lineWidth = 30 * colonyCamera.zoom;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    var startPt = colonyToScreen(it.a.x, colonyHeightAt(it.a.x, it.a.z), it.a.z);
    ctx.moveTo(startPt.x, startPt.y);
    for (var q = 1; q <= steps; q++) {
      var mx = (left[q].x + right[q].x) / 2;
      var my = (left[q].y + right[q].y) / 2;
      ctx.lineTo(mx, my);
    }
    ctx.stroke();
  }
}

/* The painted zone markings: a dashed border and the zone name on the
   ground, which is how a real site is signed. */
function colonyDrawZoneMarks(ctx) {
  for (var i = 0; i < COLONY_ZONES.length; i++) {
    var zone = COLONY_ZONES[i];
    var hw = zone.w / 2, hd = zone.d / 2;
    var corners = [
      { x: zone.x - hw, z: zone.z - hd },
      { x: zone.x + hw, z: zone.z - hd },
      { x: zone.x + hw, z: zone.z + hd },
      { x: zone.x - hw, z: zone.z + hd }
    ];
    ctx.save();
    ctx.setLineDash([14, 10]);
    ctx.strokeStyle = 'rgba(226,230,240,0.28)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (var c = 0; c <= 4; c++) {
      var pt = corners[c % 4];
      var gy = colonyHeightAt(pt.x, pt.z);
      var sp = colonyToScreen(pt.x, gy, pt.z);
      if (c === 0) { ctx.moveTo(sp.x, sp.y); } else { ctx.lineTo(sp.x, sp.y); }
    }
    ctx.stroke();
    ctx.restore();

    /* the designation, laid flat on the ground near the front edge */
    var lx = zone.x, lz = zone.z + hd - 40;
    var lp = colonyToScreen(lx, colonyHeightAt(lx, lz), lz);
    ctx.save();
    ctx.font = '700 15px "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(226,230,240,0.34)';
    ctx.textAlign = 'center';
    ctx.fillText(zone.name.toUpperCase(), lp.x, lp.y);
    ctx.font = '600 11px "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(226,230,240,0.2)';
    ctx.fillText(zone.blurb, lp.x, lp.y + 15);
    ctx.restore();
  }
}

/* ------------------------------------------------------------
   13. THE SKY

   Black, because there is no atmosphere. Stars, because there is
   nothing to wash them out. And Earth, which is the one thing a
   person standing on the Moon would actually look up for.
   ------------------------------------------------------------ */

var colonyStars = null;

function colonyBuildStars() {
  var stars = [];
  for (var i = 0; i < 260; i++) {
    stars.push({
      x: colonyHash(i, 1, 77),
      y: colonyHash(i, 2, 77) * 0.62,
      r: colonyHash(i, 3, 77) * 1.2 + 0.3,
      a: 0.25 + colonyHash(i, 4, 77) * 0.7,
      tw: colonyHash(i, 5, 77) * Math.PI * 2
    });
  }
  return stars;
}

function colonyDrawSky(ctx, w, h) {
  var g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#04050a');
  g.addColorStop(0.55, '#070912');
  g.addColorStop(1, '#0a0d16');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  if (!colonyStars) { colonyStars = colonyBuildStars(); }

  /* the sky is pinned to the camera, so panning does not drag the
     stars sideways faster than the ground */
  for (var i = 0; i < colonyStars.length; i++) {
    var st = colonyStars[i];
    var sx = (st.x * 2.4 - colonyCamera.isoX * 0.0006) % 1;
    if (sx < 0) { sx += 1; }
    var sy = st.y + Math.sin(colony.t / 9 + st.tw) * 0.0008;
    ctx.globalAlpha = st.a;
    ctx.fillStyle = '#dfe6f2';
    ctx.beginPath();
    ctx.arc(sx * w, sy * h, st.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  /* Sun position based on time of day */
  var sunPos = colonyGetSunPosition();
  var sunScreen = {
    x: w * 0.5 + Math.cos(sunPos.azimuth) * w * 0.4,
    y: h * 0.5 - Math.sin(sunPos.altitude) * h * 0.6
  };
  var sunRadius = Math.min(w, h) * 0.04;
  var sunGlow = ctx.createRadialGradient(sunScreen.x, sunScreen.y, 0, sunScreen.x, sunScreen.y, sunRadius * 3);
  sunGlow.addColorStop(0, 'rgba(255, 245, 200, 1)');
  sunGlow.addColorStop(0.3, 'rgba(255, 230, 150, 0.6)');
  sunGlow.addColorStop(1, 'rgba(255, 200, 50, 0)');
  ctx.fillStyle = sunGlow;
  ctx.beginPath(); ctx.arc(sunScreen.x, sunScreen.y, sunRadius * 3, 0, Math.PI * 2); ctx.fill();

  /* Sun disc */
  var sunGrad = ctx.createRadialGradient(sunScreen.x - sunRadius * 0.3, sunScreen.y - sunRadius * 0.3, 0, sunScreen.x, sunScreen.y, sunRadius);
  sunGrad.addColorStop(0, '#fff8e0');
  sunGrad.addColorStop(0.5, '#ffe8a0');
  sunGrad.addColorStop(1, '#ffcc00');
  ctx.fillStyle = sunGrad;
  ctx.beginPath(); ctx.arc(sunScreen.x, sunScreen.y, sunRadius, 0, Math.PI * 2); ctx.fill();

  if (!colonyStars) { colonyStars = colonyBuildStars(); }

  /* the sky is pinned to the camera, so panning does not drag the
     stars sideways faster than the ground */
  for (var i = 0; i < colonyStars.length; i++) {
    var st = colonyStars[i];
    var sx = (st.x * 2.4 - colonyCamera.isoX * 0.0006) % 1;
    if (sx < 0) { sx += 1; }
    var sy = st.y + Math.sin(colony.t / 9 + st.tw) * 0.0008;
    ctx.globalAlpha = st.a;
    ctx.fillStyle = '#dfe6f2';
    ctx.beginPath();
    ctx.arc(sx * w, sy * h, st.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  /* Earth, low over the horizon, because that is where it is from
     the lunar south pole. */
  var ex = w * 0.72, ey = h * 0.20;
  var er = Math.min(w, h) * 0.075;
  var eg = ctx.createRadialGradient(ex - er * 0.35, ey - er * 0.35, er * 0.1, ex, ey, er);
  eg.addColorStop(0, 'rgba(150,190,235,1)');
  eg.addColorStop(0.6, 'rgba(60,110,180,1)');
  eg.addColorStop(1, 'rgba(16,34,70,1)');
  ctx.fillStyle = eg;
  ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.fill();
  /* a crescent shadow, because the sun is in the same direction */
  ctx.fillStyle = 'rgba(4,5,10,0.72)';
  ctx.beginPath(); ctx.arc(ex + er * 0.42, ey - er * 0.18, er * 0.94, 0, Math.PI * 2); ctx.fill();
  /* glow */
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#8fc0ff';
  ctx.beginPath(); ctx.arc(ex, ey, er * 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------
   14. THE ASTRONAUT

   The same sprite sheet the 2D world uses, drawn upright on the
   terrain. The animation frames are shared so the walk cycle is the
   same walk cycle.
   ------------------------------------------------------------ */

function colonyDrawAstronaut(ctx) {
  var a = colony.astronaut;
  var gy = colonyHeightAt(a.x, a.z);
  colonyShadow(ctx, a.x, gy, a.z, 44, 30, 74);

  var s = colonyToScreen(a.x, gy, a.z);
  var size = 96 * colonyCamera.zoom;
  if (size < 14) { return; }

  var frame = 'idle_0';
  if (typeof SPRITE_ANIM !== 'undefined' && SPRITE_ANIM) {
    if (a.walkPhase > 0 && SPRITE_ANIM.walk) {
      frame = SPRITE_ANIM.walk[Math.floor(a.walkPhase) % SPRITE_ANIM.walk.length];
    } else if (SPRITE_ANIM.idle) {
      frame = SPRITE_ANIM.idle[Math.floor(colony.t / 14) % SPRITE_ANIM.idle.length];
    }
  }

  /* shadow is drawn by colonyShadow; draw the sprite in screen space */
  var tmp = colony._spriteCtx || (colony._spriteCtx = document.createElement('canvas'));
  if (typeof drawSprite !== 'function') {
    /* no sprite helper: a simple marker, so the astronaut is still
       findable if world.js ever changes */
    ctx.fillStyle = '#dfe6f2';
    ctx.beginPath(); ctx.arc(s.x, s.y - size * 0.4, size * 0.18, 0, Math.PI * 2); ctx.fill();
    return;
  }
  var ok = drawSprite(tmp.getContext('2d'), frame, 0, 0, 96, 96);
  if (!ok) { return; }
  ctx.drawImage(tmp, s.x - size / 2, s.y - size, size, size);
}

/* ------------------------------------------------------------
   15. PICKING
   ------------------------------------------------------------ */

function colonyPick(screenX, screenY) {
  var slots = colonySlots();
  var best = null, bestD = Infinity;
  for (var i = 0; i < slots.length; i++) {
    var sp = colonyToScreen(slots[i].x, slots[i].ground, slots[i].z);
    var h = COLONY_STRUCTURE_HEIGHT[slots[i].type] || 50;
    var top = colonyToScreen(slots[i].x, slots[i].ground + h, slots[i].z);
    /* a generous box around the footprint plus its height */
    var halfW = 120 * colonyCamera.zoom;
    var dy = screenY - sp.y;
    if (screenX >= sp.x - halfW && screenX <= sp.x + halfW &&
        screenY >= top.y - 10 && screenY <= sp.y + 18 * colonyCamera.zoom) {
      var d = Math.abs(screenX - sp.x) + Math.abs(dy);
      if (d < bestD) { bestD = d; best = slots[i]; }
    }
  }
  return best;
}

/* ------------------------------------------------------------
   16. THE INSPECTOR

   Reads the live simulation, so the panel is telling the truth about
   the mission rather than a snapshot taken when the base was built.
   ------------------------------------------------------------ */

function colonyInspectorHtml() {
  if (!colony.selected) {
    return '<p class="colony-hint">Click any module to see what it does and how it is ' +
           'doing. Drag the ground to look around, scroll to zoom.</p>';
  }
  var slot = null;
  var slots = colonySlots();
  for (var i = 0; i < slots.length; i++) {
    if (slots[i].uid === colony.selected) { slot = slots[i]; }
  }
  if (!slot) { return '<p class="colony-hint">That module is no longer here.</p>'; }

  var info = colonyTypeInfo(slot.type);
  var zone = null;
  for (var z = 0; z < COLONY_ZONES.length; z++) {
    if (COLONY_ZONES[z].id === slot.zone) { zone = COLONY_ZONES[z]; }
  }

  var rows = '';
  rows += colonyStatRow('Role', info.role || info.blurb || '-');
  rows += colonyStatRow('Zone', zone ? zone.name : '-');
  rows += colonyStatRow('Cargo cost', info.cost + ' units');

  /* live condition, if this type has a maintenance system */
  if (typeof conditionOf === 'function' && typeof MAINT_SYSTEMS !== 'undefined') {
    var cond = null;
    for (var m = 0; m < MAINT_SYSTEMS.length; m++) {
      if (MAINT_SYSTEMS[m] === slot.type || MAINT_SYSTEMS[m].host === slot.type) {
        cond = conditionOf(MAINT_SYSTEMS[m]);
      }
    }
    if (cond !== null) {
      rows += colonyStatRow('Condition', Math.round(cond) + '%');
      rows += colonyStatBar(cond);
    }
  }

  /* live daily balance, if the mission is running */
  if (typeof projectedDailyDeltas === 'function' && typeof baseCapabilities === 'function' &&
      typeof siteFactors === 'function' &&
      typeof game !== 'undefined' && game && !game.finished) {
    try {
      var plan = projectedDailyDeltas(baseCapabilities(), siteFactors());
      var key = { solar: 'power', depot: 'oxygen' }[slot.type] || slot.type;
      if (plan && typeof plan[key] === 'number') {
        var v = plan[key];
        rows += colonyStatRow('Daily effect', (v > 0 ? '+' : '') + v.toFixed(1) +
          '  ' + colonyResourceName(key));
      }
    } catch (e) { /* the simulation is optional; never break the panel */ }
  }

  var actions = '';
  if (typeof doService === 'function' && typeof game !== 'undefined' && game && !game.finished) {
    actions += '<button class="btn btn-small" data-colony-act="service">Service this module</button>';
  }
  if (colonyIsEditable()) {
    actions += '<button class="btn btn-small btn-ghost" data-colony-act="remove">Remove</button>';
  }

  return '<h3 class="colony-panel-title">' + info.name + '</h3>' +
         '<p class="colony-panel-sub">' + (info.blurb || '') + '</p>' +
         '<div class="colony-stats">' + rows + '</div>' +
         (actions ? '<div class="colony-actions">' + actions + '</div>' : '') +
         (colonyIsEditable() ? '' : '<p class="colony-note">Building is locked once the ' +
            'mission starts, exactly as in the 2D builder.</p>');
}

function colonyResourceName(key) {
  if (typeof RESOURCES !== 'undefined' && RESOURCES[key]) { return RESOURCES[key].name.toLowerCase(); }
  return key;
}

function colonyStatRow(label, value) {
  return '<div class="colony-stat"><span>' + label + '</span><strong>' + value + '</strong></div>';
}

function colonyStatBar(pct) {
  var p = Math.max(0, Math.min(100, pct));
  return '<div class="colony-bar"><i style="width:' + p + '%"></i></div>';
}

/* ------------------------------------------------------------
   17. PLACEMENT, USING THE BUILDER'S OWN RULES

   The colony never invents its own idea of what is allowed. Cost,
   limits and the budget are all read from the same builder the 2D
   game uses, so a module that cannot be built there cannot be built
   here either.
   ------------------------------------------------------------ */

function colonyPlace(type) {
  if (!colonyIsEditable()) {
    colonyNotify('Building is locked during a mission.', 3);
    return;
  }
  var zoneId = COLONY_TYPE_ZONE[type] || 'habitat';
  var plot = colonyFreePlot(zoneId);
  if (!plot) { colonyNotify('No free plot in that zone.', 3); return; }

  /* the real validation, from builder.js */
  if (typeof builderCheck === 'function' && typeof builderFirstFreeSpot === 'function') {
    var probe = builderPlace(type, builderFirstFreeSpot(type));
    if (!probe.ok) {
      colonyNotify(probe.reason || 'That cannot be built here.', 4);
      return;
    }
    /* undo the probe: we re-place it properly below */
    var added = builder.layout.pop();
    if (added) { builderApply(); }
  } else if (typeof typeOf === 'function') {
    var info = typeOf(type);
    if (info && info.limit && typeof builderCount === 'function' &&
        builderCount(type) >= info.limit) {
      colonyNotify('Only ' + info.limit + ' ' + info.name + ' allowed in one base.', 4);
      return;
    }
  }

  var placed = false;
  if (typeof builderPlace === 'function') {
    var r = builderPlace(type, builderFirstFreeSpot(type));
    if (!r.ok) { colonyNotify(r.reason || 'That cannot be built here.', 4); return; }
    placed = true;
  }
  colony.armed = null;
  colonyRenderPalette();
  colonyNotify((colonyTypeInfo(type).name || type) + ' placed.', 2.5);
  colonyDraw();
  return placed;
}

function colonyRemoveSelected() {
  if (!colonyIsEditable()) {
    colonyNotify('Building is locked during a mission.', 3);
    return;
  }
  if (!colony.selected) { return; }
  if (typeof builderRemove === 'function') {
    builderRemove(colony.selected);
    colony.selected = null;
    colonyNotify('Module removed and cargo refunded.', 3);
    colonyDraw();
  }
}

function colonyServiceSelected() {
  if (typeof doService !== 'function' || !colony.selected) { return; }
  var slot = null;
  var slots = colonySlots();
  for (var i = 0; i < slots.length; i++) {
    if (slots[i].uid === colony.selected) { slot = slots[i]; }
  }
  if (slot) { doService(slot.type); }
}

/* ------------------------------------------------------------
   18. THE PALETTE
   ------------------------------------------------------------ */

function colonyRenderPalette() {
  var host = document.getElementById('colony-palette');
  if (!host) { return; }
  if (!colonyIsEditable()) {
    host.innerHTML = '<p class="colony-hint">The base is locked while the mission is ' +
      'running. Open this view from the map screen to plan a layout.</p>';
    return;
  }
  var html = '';
  for (var i = 0; i < STATION_TYPES.length; i++) {
    var t = STATION_TYPES[i];
    var have = (typeof builderCount === 'function') ? builderCount(t.id) : 0;
    var full = have >= t.limit;
    html += '<button class="colony-chip' + (colony.armed === t.id ? ' is-armed' : '') +
      (full ? ' is-full' : '') + '" data-colony-build="' + t.id + '" type="button">' +
      '<span class="chip-name">' + t.name + '</span>' +
      '<span class="chip-meta">' + have + '/' + t.limit + ' &middot; ' + t.cost + '</span>' +
      '</button>';
  }
  host.innerHTML = html;
}

/* ------------------------------------------------------------
   19. INPUT
   ------------------------------------------------------------ */

var colonyKeys = {};

/* ------------------------------------------------------------
   Resource Flow Visualization
   ------------------------------------------------------------ */
/* ------------------------------------------------------------
   Construction Zone Visualization
   ------------------------------------------------------------ */
function colonyDrawConstructionZones(ctx) {
  if (!colonyIsEditable()) { return; }

  var zones = COLONY_ZONES;
  for (var i = 0; i < zones.length; i++) {
    var zone = zones[i];
    var hw = zone.w / 2, hd = zone.d / 2;
    var corners = [
      { x: zone.x - hw, z: zone.z - hd },
      { x: zone.x + hw, z: zone.z - hd },
      { x: zone.x + hw, z: zone.z + hd },
      { x: zone.x - hw, z: zone.z + hd }
    ];

    ctx.save();
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = 'rgba(79, 209, 224, 0.4)';
    ctx.lineWidth = 2 * colonyCamera.zoom;
    ctx.beginPath();
    for (var c = 0; c <= 4; c++) {
      var pt = corners[c % 4];
      var gy = colonyHeightAt(pt.x, pt.z);
      var sp = colonyToScreen(pt.x, gy, pt.z);
      if (c === 0) { ctx.moveTo(sp.x, sp.y); } else { ctx.lineTo(sp.x, sp.y); }
    }
    ctx.stroke();
    ctx.restore();

    /* Zone label with cargo info */
    var lx = zone.x, lz = zone.z + zone.d / 2 - 60;
    var lp = colonyToScreen(lx, colonyHeightAt(lx, lz), lz);
    ctx.save();
    ctx.font = '600 12px "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(79, 209, 224, 0.7)';
    ctx.textAlign = 'center';
    ctx.fillText(zone.name.toUpperCase() + ' ZONE', lp.x, lp.y);
    ctx.font = '500 10px "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(226,230,240,0.5)';
    ctx.fillText('Build zone for ' + (COLONY_TYPE_ZONE[zone.id] ? COLONY_TYPE_ZONE[zone.id] : 'structures'), lp.x, lp.y + 16);
    ctx.restore();
  }
}

/* Draw buildable plot indicators */
function colonyDrawBuildPlots(ctx) {
  if (!colonyIsEditable() || !colony.armed) { return; }

  var type = colony.armed;
  var zoneId = COLONY_TYPE_ZONE[type] || 'habitat';
  var zone = null;
  for (var i = 0; i < COLONY_ZONES.length; i++) {
    if (COLONY_ZONES[i].id === zoneId) { zone = COLONY_ZONES[i]; break; }
  }
  if (!zone) { return; }

  var PLOT_W = 330, PLOT_D = 300;
  var taken = colonySlots();
  var cols = 4, rows = 3;

  for (var row = 0; row < rows; row++) {
    for (var col = 0; col < cols; col++) {
      var px = zone.x - ((cols - 1) * 330) / 2 + col * 330;
      var pz = zone.z - (2 * 300) / 2 + row * 300;
      var clash = false;
      for (var i = 0; i < colonySlots().length; i++) {
        if (Math.abs(colonySlots()[i].x - px) < 200 && Math.abs(colonySlots()[i].z - pz) < 200) {
          clash = true; break;
        }
      }
      if (clash) { continue; }

      var gy = colonyHeightAt(px, pz);
      var slope = Math.abs(colonyHeightAt(px + 60, pz) - gy) +
                  Math.abs(colonyHeightAt(px, pz + 60) - gy);
      if (slope > 26) { continue; }

      var plotCenter = colonyToScreen(px, gy, pz);
      var plotW = 200 * colonyCamera.zoom;
      var plotD = 180 * colonyCamera.zoom;

      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      var hw = 100 * colonyCamera.zoom, hd = 90 * colonyCamera.zoom;
      var cx = colonyToScreen(px - PLOT_W/2, gy, pz - PLOT_D/2);
      ctx.moveTo(cx.x, cx.y);
      ctx.lineTo(cx.x + plotW, cx.y);
      ctx.lineTo(cx.x + plotW, cx.y + plotD);
      ctx.lineTo(cx.x, cx.y + plotD);
      ctx.closePath();
      ctx.stroke();
ctx.restore();
  }
}
  var slots = colonySlots();
  if (slots.length < 2) { return; }

  /* Build adjacency based on proximity and type compatibility */
  var connections = [];
  for (var i = 0; i < slots.length; i++) {
    for (var j = i + 1; j < slots.length; j++) {
      var a = slots[i], b = slots[j];
      var dx = a.x - b.x, dz = a.z - b.z;
      var dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 800) {  /* within connection range */
        connections.push({ a: a, b: b, dist: dist });
      }
    }
  }

  if (connections.length === 0) { return; }

  var t = colony.flowAnimTime % 1;

  for (var c = 0; c < connections.length; c++) {
    var conn = connections[c];
    var a = conn.a, b = conn.b;
    var ga = a.ground, gb = b.ground;

    /* Determine flow type based on structure types */
    var flowType = colonyGetFlowType(a.type, b.type);
    if (!flowType) { continue; }

    var pa = colonyToScreen(a.x, ga + 20, a.z);
    var pb = colonyToScreen(b.x, gb + 20, b.z);

    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 2 * colonyCamera.zoom;
    ctx.lineCap = 'round';

    if (flowType === 'power') {
      ctx.strokeStyle = '#ffd166';
      ctx.shadowColor = '#ffd166';
      ctx.shadowBlur = 8 * colonyCamera.zoom;
    } else if (flowType === 'water') {
      ctx.strokeStyle = '#6aa6ff';
      ctx.shadowColor = '#6aa6ff';
      ctx.shadowBlur = 8 * colonyCamera.zoom;
    } else if (flowType === 'oxygen') {
      ctx.strokeStyle = '#7fd4f5';
      ctx.shadowColor = '#7fd1e0';
      ctx.shadowBlur = 8 * colonyCamera.zoom;
    } else if (flowType === 'water_recycle') {
      ctx.strokeStyle = '#9ad36a';
      ctx.shadowColor = '#4ade80';
      ctx.shadowBlur = 6 * colonyCamera.zoom;
    } else {
      ctx.strokeStyle = '#9fb0d4';
    }

    /* Main connection line */
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();

    /* Animated flow particle */
    var px = pa.x + (pb.x - pa.x) * (colony.flowAnimTime % 1);
    var py = pa.y + (pb.y - pa.y) * (colony.flowAnimTime % 1);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.arc(px, py, 4 * colonyCamera.zoom, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

function colonyGetFlowType(typeA, typeB) {
  /* Power flows from solar to everything */
  if ((typeA === 'solar' && typeB !== 'solar') || (typeB === 'solar' && typeA !== 'solar')) {
    return 'power';
  }
  /* Water flows from water recycler to habitat, food, oxygen */
  if ((typeA === 'water' && (typeB === 'habitat' || typeB === 'food' || typeB === 'oxygen')) ||
      (typeB === 'water' && (typeA === 'habitat' || typeA === 'food' || typeA === 'oxygen'))) {
    return 'water';
  }
  /* Oxygen flows from oxygen system to habitat */
  if ((typeA === 'oxygen' && typeB === 'habitat') || (typeB === 'oxygen' && typeA === 'habitat')) {
    return 'oxygen';
  }
  /* Water recycling loop */
  if ((typeA === 'water' && typeB === 'food') || (typeB === 'water' && typeA === 'food')) {
    return 'water_recycle';
  }
  /* Depot supplies everything */
  if (typeA === 'depot' || typeB === 'depot') {
    return 'supply';
  }
  return null;
}

var colonyKeys = {};

function colonySetupInput() {
  var canvas = document.getElementById('colony-canvas');
  if (!canvas) { return; }

  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    var r = canvas.getBoundingClientRect();
    colonyZoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? COLONY.zoomStep : 1 / COLONY.zoomStep);
  }, { passive: false });

  canvas.addEventListener('pointerdown', function (e) {
    canvas.setPointerCapture(e.pointerId);
    colonyCamera.dragging = true;
    colonyCamera.dragMoved = false;
    colonyCamera.lastX = e.clientX;
    colonyCamera.lastY = e.clientY;

    var r = canvas.getBoundingClientRect();
    var hit = colonyPick(e.clientX - r.left, e.clientY - r.top);
    if (hit && colony.armed) {
      colony.selected = hit.uid;
      colonyRenderPanel();
    } else if (hit) {
      colony.selected = hit.uid;
      colony.draggingUid = hit.uid;
      colony.draggingFrom = { x: hit.x, z: hit.z };
      colonyRenderPanel();
    }
  });

  canvas.addEventListener('pointermove', function (e) {
    var r = canvas.getBoundingClientRect();
    var mx = e.clientX - r.left, my = e.clientY - r.top;

    if (!colonyCamera.dragging) {
      var hover = colonyPick(mx, my);
      colony.hoverUid = hover ? hover.uid : null;
      canvas.style.cursor = hover ? 'pointer' : 'grab';
      return;
    }

    var dx = e.clientX - colonyCamera.lastX;
    var dy = e.clientY - colonyCamera.lastY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) { colonyCamera.dragMoved = true; }
    colonyCamera.lastX = e.clientX;
    colonyCamera.lastY = e.clientY;

    colonyCamera.isoX -= dx / colonyCamera.zoom;
    colonyCamera.isoY -= dy / colonyCamera.zoom;
    colonyCamera.follow = false;
    colonyClampCamera();
  });

  canvas.addEventListener('pointerup', function (e) {
    canvas.releasePointerCapture(e.pointerId);
    var wasDrag = colonyCamera.dragMoved;
    colonyCamera.dragging = false;
    colony.draggingUid = null;
    if (!wasDrag) {
      var r = canvas.getBoundingClientRect();
      var g = colonyScreenToGround(e.clientX - r.left, e.clientY - r.top);
      if (colony.armed) {
        var zone = colonyZoneAt(g.x, g.z);
        if (zone) { colonyPlace(colony.armed); }
        else { colonyNotify('Build inside one of the marked zones.', 3); }
      }
    }
  });

  document.addEventListener('keydown', function (e) {
    if (!colony.open) { return; }
    colonyKeys[e.code] = true;
    if (e.code === 'Escape') {
      if (colony.armed) { colony.armed = null; colonyRenderPalette(); }
      else { colonyClose(); }
    }
  });
  document.addEventListener('keyup', function (e) { colonyKeys[e.code] = false; });

  window.addEventListener('resize', function () {
    if (colony.open) { colonyResize(); }
  });
}

function colonyZoneAt(x, z) {
  for (var i = 0; i < COLONY_ZONES.length; i++) {
    var zn = COLONY_ZONES[i];
    if (Math.abs(x - zn.x) <= zn.w / 2 && Math.abs(z - zn.z) <= zn.d / 2) { return zn; }
  }
  return null;
}

/* ------------------------------------------------------------
   20. THE LOOP
   ------------------------------------------------------------ */

function colonyUpdate(dt) {
  /* Day/night cycle */
  colony.dayCyclePhase = (colony.dayCyclePhase + dt / COLONY.dayCycleMs) % 1;

  /* Dust storm simulation */
  colonyUpdateDustStorm(dt);

  /* Emergency/failure tracking */
  colonyUpdateEmergencies();

  /* Resource flow animation */
  colony.flowAnimTime += dt * 0.001;

  /* Screen shake decay */
  if (colony.screenShake > 0) {
    colony.screenShake = Math.max(0, colony.screenShake - dt * 0.01);
  }

  /* Astronaut movement */
  var a = colony.astronaut;
  var mx = 0, mz = 0;
  if (colonyKeys['KeyW'] || colonyKeys['ArrowUp'])    { mz -= 1; }
  if (colonyKeys['KeyS'] || colonyKeys['ArrowDown'])  { mz += 1; }
  if (colonyKeys['KeyA'] || colonyKeys['ArrowLeft'])  { mx -= 1; }
  if (colonyKeys['KeyD'] || colonyKeys['ArrowRight']) { mx += 1; }

  if (mx !== 0 || mz !== 0) {
    var len = Math.sqrt(mx * mx + mz * mz);
    mx /= len; mz /= len;
    var step = COLONY.walkSpeed * (dt / 16.6667);
    a.x = Math.max(60, Math.min(COLONY.worldW - 60, a.x + mx * step));
    a.z = Math.max(60, Math.min(COLONY.worldD - 60, a.z + mz * step));
    if (mx !== 0) { a.facing = mx > 0 ? 1 : -1; }
    a.walkPhase += dt * 0.5;
    colonyCamera.follow = true;
  } else {
    a.walkPhase = 0;
  }

  if (colonyCamera.follow) {
    var target = colonyProject(a.x, colonyHeightAt(a.x, a.z), a.z);
    colonyCamera.isoX += (target.x - colonyCamera.isoX) * 0.09;
    colonyCamera.isoY += (target.y - colonyCamera.isoY) * 0.09;
    colonyClampCamera();
  }
}

/* ------------------------------------------------------------
   Dust Storm Simulation
   ------------------------------------------------------------ */
function colonyUpdateDustStorm(dt) {
  var ds = colony.dustStorm;
  
  /* Check if a dust storm should start (based on mission day or random) */
  if (!ds.active) {
    ds.nextStorm -= dt;
    if (ds.nextStorm <= 0) {
      /* Check if mission has a dust storm scheduled */
      var hasStorm = false;
      if (typeof game !== 'undefined' && game && game.storms) {
        hasStorm = true;
      } else {
        /* Random storm chance when no mission */
        hasStorm = Math.random() < 0.0001;
      }
      if (hasStorm) {
        ds.active = true;
        ds.intensity = 0;
        ds.particles = [];
        ds.nextStorm = 300000 + Math.random() * 600000; /* 5-15 min */
        colonyNotify('Dust storm approaching!', 5);
      } else {
        ds.nextStorm = 60000 + Math.random() * 120000; /* 1-3 min */
      }
    }
    return;
  }

  /* Ramp up intensity */
  if (ds.intensity < 1) {
    ds.intensity = Math.min(1, ds.intensity + dt * 0.0005);
  }

  /* Maintain particle count */
  var targetCount = Math.floor(200 * ds.intensity);
  while (ds.particles.length < targetCount) {
    ds.particles.push({
      x: Math.random() * COLONY.worldW,
      z: Math.random() * COLONY.worldD,
      y: colonyHeightAt(Math.random() * COLONY.worldW, Math.random() * COLONY.worldD),
      vx: (Math.random() - 0.5) * 50,
      vz: (Math.random() - 0.5) * 50,
      vy: Math.random() * 20,
      life: 1,
      size: 1 + Math.random() * 3
    });
  }

  /* Update particles */
  for (var i = ds.particles.length - 1; i >= 0; i--) {
    var p = ds.particles[i];
    p.x += p.vx * dt * 0.001;
    p.z += p.vz * dt * 0.001;
    p.y += p.vy * dt * 0.001;
    p.vy -= 0.5 * dt * 0.001; /* gravity */
    p.life -= dt * 0.0003;
    if (p.life <= 0 || p.y < colonyHeightAt(p.x, p.z)) {
      ds.particles.splice(i, 1);
    }
  }

  /* Storm ends */
  if (ds.intensity >= 1 && Math.random() < dt * 0.00001) {
    ds.active = false;
    ds.intensity = 0;
    ds.particles = [];
    colonyNotify('Dust storm passed.', 3);
  }
}

/* ------------------------------------------------------------
   Emergency/Failure Tracking
   ------------------------------------------------------------ */
function colonyUpdateEmergencies() {
  var oldEmergencies = colony.emergencies;
  colony.emergencies = {};

  if (typeof game !== 'undefined' && game && game.faults) {
    for (var sys in game.faults) {
      if (game.faults[sys]) {
        colony.emergencies[sys] = { active: true, since: colony.t };
      }
    }
  }

  /* Trigger screen shake for new emergencies */
  for (var sys in colony.emergencies) {
    if (!oldEmergencies[sys]) {
      colony.screenShake = Math.max(colony.screenShake, 0.5);
    }
  }
}

function colonyDraw() {
  var canvas = document.getElementById('colony-canvas');
  if (!canvas) { return; }
  var ctx = canvas.getContext('2d');
  if (!ctx) { return; }

  var w = colonyCamera.vw, h = colonyCamera.vh;
  ctx.setTransform(colonyCamera.dpr, 0, 0, colonyCamera.dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  colonyDrawSky(ctx, w, h);
  colonyDrawTerrain(ctx);

  var scenery = colony._scenery || (colony._scenery = colonyScenery());
  colonyDrawPaths(ctx, scenery);
  colonyDrawZoneMarks(ctx);

  /* Construction zone visualization (build mode) */
  if (colonyIsEditable()) {
    colonyDrawConstructionZones(ctx);
    colonyDrawBuildPlots(ctx);
  }

  /* boulders sit on the ground and are cheap, so they go with the
     terrain rather than in the sorted pass */
  colonyDrawBoulders(ctx);

  /* Dust storm overlay */
  colonyDrawDustStorm(ctx);

  /* everything that stands up is sorted back to front, otherwise a
     habitat in front of a mast would be drawn behind it */
  var drawables = [];
  for (var i = 0; i < scenery.length; i++) {
    if (scenery[i].kind !== 'path') {
      drawables.push({ depth: scenery[i].x + scenery[i].z, item: scenery[i], player: false });
    }
  }
  var slots = colonySlots();
  for (var s = 0; s < slots.length; s++) {
    drawables.push({ depth: slots[s].x + slots[s].z, slot: slots[s], player: true });
  }
  var a = colony.astronaut;
  drawables.push({ depth: a.x + a.z, astronaut: true, player: true });
  drawables.sort(function (p, q) { return p.depth - q.depth; });

  for (var d = 0; d < drawables.length; d++) {
    var it = drawables[d];
    if (it.player && it.slot) { colonyDrawStructure(ctx, it.slot, d); }
    else if (it.player) { colonyDrawAstronaut(ctx); }
    else { colonyDrawSceneryItem(ctx, it.item); }
  }

  /* Resource flow visualization (drawn on top of structures) */
  colonyDrawResourceFlows(ctx);

  /* the ghost of the thing about to be placed */
  if (colony.armed) {
    var zone = colonyZoneAt(colony.astronaut.x, colony.astronaut.z);
    var plot = colonyFreePlot(COLONY_TYPE_ZONE[colony.armed] || 'habitat');
    if (plot) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      colonyDrawStructure(ctx, { uid: null, type: colony.armed, x: plot.x, z: plot.z,
        ground: plot.ground }, 0);
      ctx.restore();
    }
  }

  if (colony.message && colony.t < colony.messageUntil) {
    ctx.font = '600 14px "Segoe UI", sans-serif';
    var tw = ctx.measureText(colony.message).width + 28;
    ctx.fillStyle = 'rgba(8,10,18,0.9)';
    ctx.beginPath(); ctx.roundRect(w / 2 - tw / 2, h - 64, tw, 36, 10); ctx.fill();
    ctx.strokeStyle = '#4fd1e0'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#dfe9f5';
    ctx.textAlign = 'center';
    ctx.fillText(colony.message, w / 2, h - 41);
  }
}

/* Draw dust storm particles */
function colonyDrawDustStorm(ctx) {
  var ds = colony.dustStorm;
  if (!ds.active || ds.particles.length === 0) { return; }

  ctx.save();
  ctx.globalAlpha = 0.3 * ds.intensity;

  for (var i = 0; i < ds.particles.length; i++) {
    var p = ds.particles[i];
    var sp = colonyToScreen(p.x, p.y, p.z);
    if (sp.x < -50 || sp.x > colonyCamera.vw + 50 || sp.y < -50 || sp.y > colonyCamera.vh + 50) {
      continue;
    }
    var size = Math.max(1, p.size * colonyCamera.zoom * 0.5);
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, Math.max(1, size * colonyCamera.zoom), 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(120,100,80,' + (0.4 * p.life) + ')';
    ctx.fill();
  }
  ctx.restore();
}

function colonyLoop(now) {
  if (!colony.running) { return; }
  if (!colony.lastTime) { colony.lastTime = now; }
  var dt = now - colony.lastTime;
  colony.lastTime = now;
  if (dt > 100) { dt = 16.6667; }

  colony.t += dt;
  colonyUpdate(dt);
  colonyDraw();
  colonyUpdateDayNightIndicator();
  colony.loopHandle = window.requestAnimationFrame(colonyLoop);
}

/* ------------------------------------------------------------
   21. OPEN, CLOSE, RESIZE
   ------------------------------------------------------------ */

function colonyResize() {
  var canvas = document.getElementById('colony-canvas');
  if (!canvas) { return; }
  colonyCamera.dpr = Math.min(window.devicePixelRatio || 1, 2);
  colonyCamera.vw = canvas.clientWidth;
  colonyCamera.vh = canvas.clientHeight;
  canvas.width = Math.max(1, Math.round(colonyCamera.vw * colonyCamera.dpr));
  canvas.height = Math.max(1, Math.round(colonyCamera.vh * colonyCamera.dpr));
}

function colonyOpen() {
  var screen = document.getElementById('screen-colony');
  if (!screen) { return; }

  /* Terrain is generated for the site the player actually chose, and
     only when it changes - it is the most expensive thing here. */
  var zoneId = (typeof game !== 'undefined' && game && game.zoneId)
    ? game.zoneId
    : ((typeof selectedZone === 'function' && selectedZone()) ? selectedZone().id : null);
  if (!colonyTerrain || colonyTerrain.zoneId !== zoneId) {
    colonyTerrain = colonyBuildTerrain(zoneId);
    colonyTerrain.zoneId = zoneId;
    colony._scenery = colonyScenery();
    colony._spriteCtx = null;
  }

  /* the astronaut starts at the hub, and the camera starts on them */
  var layout = colonyLayout();
  if (layout.length) {
    colony.astronaut.x = 4700; colony.astronaut.z = 3300;
  }

  colony.open = true;
  colonyResize();
  var target = colonyProject(colony.astronaut.x,
                             colonyHeightAt(colony.astronaut.x, colony.astronaut.z),
                             colony.astronaut.z);
  colonyCamera.isoX = target.x;
  colonyCamera.isoY = target.y;
  colonyCamera.follow = true;
  colonyCamera.zoom = 0.8;
  colonyClampCamera();

  showScreen('colony');
  colonyRenderPalette();
  colonyRenderPanel();

  colony.running = true;
  colony.lastTime = 0;
  if (colony.loopHandle) { window.cancelAnimationFrame(colony.loopHandle); }
  colony.loopHandle = window.requestAnimationFrame(colonyLoop);
}

function colonyClose() {
  colony.open = false;
  colony.running = false;
  colony.armed = null;
  if (colony.loopHandle) {
    window.cancelAnimationFrame(colony.loopHandle);
    colony.loopHandle = null;
  }
  var back = document.getElementById('btn-colony-back');
  var cameFromColony = colony.returnTo || 'game';
  colony.returnTo = null;
  showScreen(cameFromColony);
}

function colonyRenderPanel() {
  var host = document.getElementById('colony-panel');
  if (!host) { return; }
  host.innerHTML = colonyInspectorHtml();
}

/* ------------------------------------------------------------
   22. WIRING

   Deliberately all of it here, in the file that owns the feature, so
   that nothing in script.js has to change and the mission logic cannot
   drift out of step with the colony.
   ------------------------------------------------------------ */

function colonyWire() {
  var openBtn = document.getElementById('btn-colony');
  if (openBtn) {
    openBtn.addEventListener('click', function () {
      colony.returnTo = 'game';
      colonyOpen();
    });
  }

  var backBtn = document.getElementById('btn-colony-back');
  if (backBtn) {
    backBtn.addEventListener('click', function () { colonyClose(); });
  }

  var zoomIn = document.getElementById('btn-colony-zoom-in');
  if (zoomIn) {
    zoomIn.addEventListener('click', function () {
      colonyZoomAt(colonyCamera.vw / 2, colonyCamera.vh / 2, COLONY.zoomStep);
    });
  }
  var zoomOut = document.getElementById('btn-colony-zoom-out');
  if (zoomOut) {
    zoomOut.addEventListener('click', function () {
      colonyZoomAt(colonyCamera.vw / 2, colonyCamera.vh / 2, 1 / COLONY.zoomStep);
    });
  }
  var centreBtn = document.getElementById('btn-colony-centre');
  if (centreBtn) {
    centreBtn.addEventListener('click', function () {
      colonyCamera.follow = true;
    });
  }

  /* delegated: the panel is re-rendered constantly, so its buttons
     cannot each carry their own listener */
  var panel = document.getElementById('colony-panel');
  if (panel) {
    panel.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-colony-act]') : null;
      if (!t) { return; }
      var act = t.getAttribute('data-colony-act');
      if (act === 'service') { colonyServiceSelected(); }
      if (act === 'remove') { colonyRemoveSelected(); }
    });
  }

  var palette = document.getElementById('colony-palette');
  if (palette) {
    palette.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-colony-build]') : null;
      if (!t) { return; }
      var type = t.getAttribute('data-colony-build');
      colony.armed = (colony.armed === type) ? null : type;
      colonyRenderPalette();
      if (colony.armed) { colonyNotify('Pick a marked zone to place it.', 3); }
    });
  }

  colonySetupInput();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', colonyWire);
  } else {
    colonyWire();
  }
}

/* Exposed for the tests, exactly as world.js and builder.js do. */
if (typeof window !== 'undefined') {
  window.COLONY = COLONY;
  window.COLONY_ZONES = COLONY_ZONES;
  window.colony = colony;
  window.colonyOpen = colonyOpen;
  window.colonyClose = colonyClose;
  window.colonySlots = colonySlots;
  window.colonyLayout = colonyLayout;
  window.colonyHeightAt = colonyHeightAt;
  window.colonyBuildTerrain = colonyBuildTerrain;
  window.colonyPick = colonyPick;
  window.colonyPlace = colonyPlace;
  window.colonyIsEditable = colonyIsEditable;
}