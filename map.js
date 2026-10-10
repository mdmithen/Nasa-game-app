/* ============================================================
   PHASE 1 - THE INTERACTIVE MOON LANDING MAP
   ------------------------------------------------------------
   Draws the lunar south pole, lets the player pick a landing site,
   compare sites side by side, and confirm one.

   This file is about the MAP only. It reads ZONES from sites.js
   and hands the chosen site to the rules file through currentPlan().
   It decides nothing about the mission itself.

   HOW THE MAP IS PROJECTED
   The Moon is drawn from above the south pole, using a polar
   stereographic projection: the south pole sits at the centre, and
   distance from the centre grows with distance away from the pole.
   This is the same kind of map NASA uses for polar mission targets,
   and it keeps every site comfortably spaced instead of bunched up
   along the edge of a globe.
   ============================================================ */

var mapState = {
  selected: null,      // zone id the player has chosen
  compare: [],         // zone ids pinned for the comparison table
  running: false,
  loopHandle: null,
  lastTime: 0,
  t: 0,
  hitAreas: [],         // filled in while drawing, used for clicking
  labelAreas: []        // the label chips, which are the roomy targets
};

var mapCanvas = null;
var mapCtx = null;
var mapDpr = 1;
var mapW = 0;
var mapH = 0;
var mapReduceMotion = false;

/* Marker hit radius, in CSS pixels. Deliberately generous so the
   sites are easy to tap on a phone. */
var MAP_HIT_RADIUS = 26;

/* A local clamp, so this file never depends on world.js or script.js
   being loaded. The map has to survive on its own. */
function mapClamp(v, low, high) {
  if (v < low) { return low; }
  if (v > high) { return high; }
  return v;
}

/* ------------------------------------------------------------
   1. PROJECTION
   Latitude is negative in the south. `colat` is degrees away from
   the south pole, so 0 at the pole and 90 at the equator. The disc
   edge is the equator.
   ------------------------------------------------------------ */

function projectLatLon(lat, lon, cx, cy, radius) {
  var colat = 90 + lat;
  var rho = Math.tan(colat * Math.PI / 360);      /* 0 at the pole, 1 at the equator */
  var a = lon * Math.PI / 180;
  return {
    x: cx + rho * radius * Math.sin(a),
    y: cy - rho * radius * Math.cos(a)
  };
}

/* ------------------------------------------------------------
   2. SCREEN AND LOOP
   ------------------------------------------------------------ */

/* Called every time the map screen becomes visible, so it picks up
   a new window size and the latest selection. */
function mapShow() {
  var section = document.getElementById('screen-map');
  var canvas = document.getElementById('map-canvas');
  if (!section || !canvas) { return; }

  mapCanvas = canvas;
  var ctx = canvas.getContext ? canvas.getContext('2d') : null;
  if (!ctx) {
    /* no canvas support: the list of sites in the side panel still
       works, so the game can still be played */
    mapStop();
    return;
  }
  mapCtx = ctx;

  mapReduceMotion = false;
  try {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      mapReduceMotion = true;
    }
  } catch (e) { /* older browsers simply animate */ }

  resizeMap();
  renderMapPanel();

  mapStop();
  if (mapReduceMotion) {
    drawMap(0);
  } else {
    mapState.lastTime = 0;
    mapState.running = true;
    mapState.loopHandle = window.requestAnimationFrame(mapLoop);
  }
}

function mapStop() {
  mapState.running = false;
  if (mapState.loopHandle) {
    window.cancelAnimationFrame(mapState.loopHandle);
    mapState.loopHandle = null;
  }
}

function mapLoop(now) {
  if (!mapState.running) { return; }

  if (!mapState.lastTime) { mapState.lastTime = now; }
  var dt = now - mapState.lastTime;
  mapState.lastTime = now;
  if (dt > 64) { dt = 64; }

  mapState.t += dt;
  drawMap(mapState.t);

  mapState.loopHandle = window.requestAnimationFrame(mapLoop);
}

function resizeMap() {
  var c = mapCanvas;
  if (!c) { return; }
  mapDpr = Math.min(window.devicePixelRatio || 1, 2);   /* same cap as the game world */
  mapW = c.clientWidth;
  mapH = c.clientHeight;
  if (mapW === 0 || mapH === 0) { return; }
  c.width = Math.floor(mapW * mapDpr);
  c.height = Math.floor(mapH * mapDpr);
}

/* ------------------------------------------------------------
   3. DRAWING THE MOON
   ------------------------------------------------------------ */

/* Where the disc sits inside the canvas. */
function mapDisc() {
  var pad = 18;
  var radius = Math.max(40, Math.min(mapW, mapH) / 2 - pad);
  return {
    cx: mapW / 2,
    cy: mapH / 2,
    r: radius
  };
}

function drawMap(time) {
  if (!mapCtx || mapW === 0 || mapH === 0) { return; }

  var ctx = mapCtx;
  ctx.setTransform(mapDpr, 0, 0, mapDpr, 0, 0);
  ctx.clearRect(0, 0, mapW, mapH);

  var d = mapDisc();

  drawDisc(ctx, d);
  drawGraticule(ctx, d);
  drawPoleMarker(ctx, d, time);

  drawZoneDots(ctx, d, time);
  drawZoneLabels(ctx, d);
  drawLegend(ctx, d);
}

/* The Moon itself, lit from the top left like every other light
   source in this game. */
function drawDisc(ctx, d) {
  var g = ctx.createRadialGradient(d.cx - d.r * 0.35, d.cy - d.r * 0.4, d.r * 0.05,
                                   d.cx, d.cy, d.r);
  g.addColorStop(0, '#b9c0cb');
  g.addColorStop(0.55, '#8d929e');
  g.addColorStop(1, '#4a4e59');

  ctx.save();
  ctx.beginPath();
  ctx.arc(d.cx, d.cy, d.r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();

  /* a scatter of crater marks so the surface is not a flat ball */
  ctx.fillStyle = 'rgba(46,50,60,0.30)';
  for (var i = 0; i < 90; i++) {
    var a = i * 2.399;                                  /* golden angle, so it spreads */
    var rr = Math.sqrt((i + 1) / 90) * d.r * 0.97;
    var x = d.cx + Math.cos(a) * rr;
    var y = d.cy + Math.sin(a) * rr;
    var cr = 2 + ((i * 7) % 11);
    ctx.beginPath();
    ctx.ellipse(x, y, cr, cr * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /* permanent shadow near the pole, matching the real thing */
  var sh = ctx.createRadialGradient(d.cx, d.cy, 0, d.cx, d.cy, d.r * 0.42);
  sh.addColorStop(0, 'rgba(8,12,26,0.55)');
  sh.addColorStop(1, 'rgba(8,12,26,0)');
  ctx.fillStyle = sh;
  ctx.fillRect(d.cx - d.r, d.cy - d.r, d.r * 2, d.r * 2);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(d.cx, d.cy, d.r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(150,175,215,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

/* Latitude circles and the prime meridian, so the map can be read. */
function drawGraticule(ctx, d) {
  ctx.save();
  ctx.strokeStyle = 'rgba(20,28,52,0.28)';
  ctx.lineWidth = 1;

  var rings = [
    { lat: -30, label: '30°S' },
    { lat: -60, label: '60°S' },
    { lat: -80, label: '80°S' }
  ];
  ctx.font = '10px "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(35,48,82,0.75)';

  for (var i = 0; i < rings.length; i++) {
    var p = projectLatLon(rings[i].lat, 0, d.cx, d.cy, d.r);
    ctx.beginPath();
    ctx.arc(d.cx, d.cy, Math.abs(p.y - d.cy), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillText(rings[i].label, d.cx + 4, Math.abs(p.y - d.cy) + d.cy - 4);
  }

  /* prime meridian */
  ctx.beginPath();
  ctx.moveTo(d.cx, d.cy - d.r);
  ctx.lineTo(d.cx, d.cy + d.r);
  ctx.stroke();
  ctx.restore();
}

function drawPoleMarker(ctx, d, time) {
  var pulse = 0.5 + 0.5 * Math.sin(time / 900);
  ctx.save();
  ctx.strokeStyle = 'rgba(226,240,255,' + (0.35 + pulse * 0.35).toFixed(2) + ')';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(d.cx, d.cy, 5 + pulse * 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = 'bold 10px "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(226,240,255,0.8)';
  ctx.textAlign = 'center';
  ctx.fillText('SOUTH POLE', d.cx, d.cy + 26);
  ctx.restore();
}

/* ------------------------------------------------------------
   4. THE SITE MARKERS
   Sites near the pole sit very close together in a polar
   projection, which is geographically honest but unreadable. So
   the dots stay at their real coordinates and the labels are laid
   out on a ring, in geographic order, joined by a leader line.
   ------------------------------------------------------------ */

function drawZoneDots(ctx, d, time) {
  mapState.hitAreas = [];

  for (var i = 0; i < ZONES.length; i++) {
    var zone = ZONES[i];
    var p = projectLatLon(zone.lat, zone.lon, d.cx, d.cy, d.r);
    var isSelected = mapState.selected === zone.id;
    var isCompared = mapState.compare.indexOf(zone.id) >= 0;

    /* only let a hit area fall near the disc, so an off-disc marker
       cannot be picked up through the panel behind it */
    var off = Math.sqrt((p.x - d.cx) * (p.x - d.cx) + (p.y - d.cy) * (p.y - d.cy));
    if (off < d.r - 4) {
      mapState.hitAreas.push({ id: zone.id, x: p.x, y: p.y });
    }

    var pulse = 0.5 + 0.5 * Math.sin(time / 700 + zone.lat);

    ctx.save();

    if (isSelected) {
      var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, MAP_HIT_RADIUS);
      g.addColorStop(0, 'rgba(255,209,102,0.55)');
      g.addColorStop(1, 'rgba(255,209,102,0)');
      ctx.fillStyle = g;
      ctx.fillRect(p.x - MAP_HIT_RADIUS, p.y - MAP_HIT_RADIUS,
                   MAP_HIT_RADIUS * 2, MAP_HIT_RADIUS * 2);

      ctx.beginPath();
      ctx.arc(p.x, p.y, 11 + pulse * 4, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,209,102,0.9)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(p.x, p.y, isSelected ? 7 : 5.5, 0, Math.PI * 2);
    ctx.fillStyle = isSelected ? '#ffd166' : (isCompared ? '#4fd1e0' : '#eef3ff');
    ctx.fill();
    ctx.strokeStyle = '#0b1226';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}

/* Labels on a ring, ordered by their true bearing so the map still
   reads as geography rather than a random wheel. */
function drawZoneLabels(ctx, d) {
  var order = ZONES.slice().sort(function (a, b) { return bearingOf(a, d) - bearingOf(b, d); });
  var ringR = d.r * 0.74;
  var step = (Math.PI * 2) / order.length;

  mapState.labelAreas = [];

  for (var i = 0; i < order.length; i++) {
    var zone = order[i];
    var p = projectLatLon(zone.lat, zone.lon, d.cx, d.cy, d.r);
    var isSelected = mapState.selected === zone.id;
    var isCompared = mapState.compare.indexOf(zone.id) >= 0;

    var a = -Math.PI / 2 + i * step;
    var lx = d.cx + Math.cos(a) * ringR;
    var ly = d.cy + Math.sin(a) * ringR;

    var colour = isSelected ? '#ffd166' : (isCompared ? '#4fd1e0' : '#eef3ff');

    ctx.save();
    ctx.font = 'bold 11px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    var tw = ctx.measureText(zone.name).width + 14;
    var th = 18;

    /* keep the whole chip inside the disc */
    lx = mapClamp(lx, d.cx - d.r + tw / 2, d.cx + d.r - tw / 2);
    ly = mapClamp(ly, d.cy - d.r + th / 2, d.cy + d.r - th / 2);

    /* the chip is a large, easy target. The dots near the pole are
       only a few pixels apart, so this is the route to use on a phone */
    mapState.labelAreas.push({ id: zone.id, x: lx, y: ly, w: tw, h: th });

    /* leader line from the real position to the chip */
    var vx = lx - p.x;
    var vy = ly - p.y;
    var len = Math.sqrt(vx * vx + vy * vy) || 1;
    var stop = (tw / 2 + 3) / len;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(lx - vx * stop, ly - vy * stop);
    ctx.strokeStyle = isSelected ? 'rgba(255,209,102,0.75)' : 'rgba(159,176,212,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    /* the chip */
    ctx.fillStyle = isSelected ? 'rgba(60,44,10,0.92)' : 'rgba(8,16,36,0.86)';
    ctx.beginPath();
    ctx.roundRect(lx - tw / 2, ly - th / 2, tw, th, 6);
    ctx.fill();
    ctx.strokeStyle = isSelected ? '#ffd166' : 'rgba(120,140,180,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = colour;
    ctx.fillText(zone.name, lx, ly + 4);
    ctx.restore();
  }
}

/* Where a site sits around the pole, used only for label ordering. */
function bearingOf(zone, d) {
  var p = projectLatLon(zone.lat, zone.lon, d.cx, d.cy, d.r);
  return Math.atan2(p.y - d.cy, p.x - d.cx);
}

/* A short note about the projection, drawn inside the disc. */
function drawLegend(ctx, d) {
  ctx.save();
  ctx.font = '10px "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(20,32,62,0.85)';
  ctx.textAlign = 'center';
  ctx.fillText('South polar view  ·  markers sit at their real coordinates',
               d.cx, d.cy + d.r + 15);
  ctx.restore();
}

/* ------------------------------------------------------------
   5. CLICKING A SITE
   ------------------------------------------------------------ */

function mapHitTest(x, y) {
  /* the label chips win first: they are far apart and easy to hit,
     while the dots near the pole are only a few pixels from each other */
  if (mapState.labelAreas) {
    for (var l = 0; l < mapState.labelAreas.length; l++) {
      var a = mapState.labelAreas[l];
      if (Math.abs(x - a.x) <= a.w / 2 && Math.abs(y - a.y) <= a.h / 2) {
        return a.id;
      }
    }
  }

  var best = null;
  var bestDist = MAP_HIT_RADIUS * MAP_HIT_RADIUS;
  for (var i = 0; i < mapState.hitAreas.length; i++) {
    var h = mapState.hitAreas[i];
    var dx = h.x - x;
    var dy = h.y - y;
    var dist = dx * dx + dy * dy;
    if (dist <= bestDist) {
      bestDist = dist;
      best = h.id;
    }
  }
  return best;
}

function selectZone(id) {
  mapState.selected = id;
  renderMapPanel();
}

/* Pinned zones for the side-by-side table. Three at most. */
function toggleCompare(id) {
  var at = mapState.compare.indexOf(id);
  if (at >= 0) {
    mapState.compare.splice(at, 1);
  } else {
    if (mapState.compare.length >= 3) { mapState.compare.shift(); }
    mapState.compare.push(id);
  }
  renderMapPanel();
}

function setupMapInput() {
  var canvas = document.getElementById('map-canvas');
  if (!canvas) { return; }

  function pick(event) {
    if (!mapState.hitAreas.length) { return; }
    var rect = canvas.getBoundingClientRect();
    var clientX, clientY;

    /* one code path for mouse, pen and touch */
    if (event.changedTouches && event.changedTouches.length) {
      clientX = event.changedTouches[0].clientX;
      clientY = event.changedTouches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }

    var id = mapHitTest(clientX - rect.left, clientY - rect.top);
    if (id) { selectZone(id); }
  }

  canvas.addEventListener('click', pick);
  canvas.addEventListener('touchend', function (e) { e.preventDefault(); pick(e); },
                          { passive: false });

  window.addEventListener('resize', function () {
    if (!document.getElementById('screen-map').hidden) {
      resizeMap();
      if (mapReduceMotion) { drawMap(0); }
    }
  });
}

/* ------------------------------------------------------------
   6. THE SIDE PANEL
   Everything here is also reachable by keyboard, so the map is
   never the only way to choose a site.
   ------------------------------------------------------------ */

function starRating(n) {
  var out = '';
  for (var i = 0; i < 5; i++) {
    out += (i < n ? '★' : '☆');
  }
  return out;
}

/* A labelled meter. Every number this shows is a GAME ESTIMATE. */
function meter(label, value, note) {
  var pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  var cls = 'zone-meter-fill';
  if (value >= 0.66) { cls += ' is-high'; }
  else if (value >= 0.33) { cls += ' is-mid'; }
  else { cls += ' is-low'; }

  return '<div class="zone-meter">' +
           '<span class="zone-meter-label">' + label + '</span>' +
           '<span class="zone-meter-track"><span class="' + cls +
             '" style="width:' + pct + '%"></span></span>' +
           '<span class="zone-meter-value">' + pct + '%</span>' +
         '</div>' +
         (note ? '<p class="zone-meter-note">' + note + '</p>' : '');
}

/* Power is a multiplier rather than a 0-100 amount, so it gets its
   own row instead of a bar that would read as "0% is normal". */
function multiplierRow(label, value, note) {
  var text = '×' + value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '.0');
  var cls = 'zone-multiplier';
  if (value >= 1.15) { cls += ' is-good'; }
  else if (value >= 0.95) { cls += ' is-mid'; }
  else { cls += ' is-bad'; }

  return '<div class="zone-meter">' +
           '<span class="zone-meter-label">' + label + '</span>' +
           '<span class="' + cls + '">' + text + '</span>' +
         '</div>' +
         (note ? '<p class="zone-meter-note">' + note + '</p>' : '');
}

function renderMapPanel() {
  var panel = document.getElementById('zone-panel');
  var list = document.getElementById('zone-list');
  var compareBox = document.getElementById('zone-compare');
  var confirm = document.getElementById('btn-confirm-site');
  if (!panel || !list || !confirm) { return; }

  /* ---- the list, always visible, always keyboard reachable ---- */
  var listHtml = '';
  for (var i = 0; i < ZONES.length; i++) {
    var z = ZONES[i];
    var cls = 'zone-chip' + (mapState.selected === z.id ? ' is-selected' : '');
    listHtml +=
      '<button class="' + cls + '" type="button" data-zone="' + z.id + '">' +
        '<span class="zone-chip-name">' + z.name + '</span>' +
        '<span class="zone-chip-meta">' + starRating(z.difficulty) + ' · ' + z.coords + '</span>' +
      '</button>';
  }
  list.innerHTML = listHtml;

  var chips = list.querySelectorAll('.zone-chip');
  for (var c = 0; c < chips.length; c++) {
    chips[c].addEventListener('click', function (e) {
      selectZone(e.currentTarget.getAttribute('data-zone'));
    });
  }

  /* ---- the detail card ---- */
  var zone = zoneById(mapState.selected);
  if (!zone) {
    panel.innerHTML =
      '<p class="zone-empty">Pick a landing site on the map, or choose one from the list. ' +
      'Tap a marker to read what it is like.</p>';
    confirm.hidden = true;
  } else {
    var mods = zoneModsFor(zone);
    var prosHtml = '';
    for (var p = 0; p < zone.pros.length; p++) {
      prosHtml += '<li>' + zone.pros[p] + '</li>';
    }
    var consHtml = '';
    for (var n = 0; n < zone.cons.length; n++) {
      consHtml += '<li>' + zone.cons[n] + '</li>';
    }
    var factsHtml = '';
    for (var f = 0; f < zone.facts.length; f++) {
      factsHtml += '<li>' + zone.facts[f] + '</li>';
    }

    var isPinned = mapState.compare.indexOf(zone.id) >= 0;

    panel.innerHTML =
      '<h2 class="panel-title">' + zone.name + '</h2>' +
      '<p class="zone-coords">' + zone.coords + ' · ' + zone.terrain + '</p>' +
      '<p class="zone-summary">' + zone.summary + '</p>' +

      '<div class="zone-scores">' +
        '<div class="zone-score"><span class="zone-score-label">Landing difficulty</span>' +
          '<span class="zone-score-value">' + starRating(zone.difficulty) + '</span></div>' +
        '<div class="zone-score"><span class="zone-score-label">Cargo delivered</span>' +
          '<span class="zone-score-value">' + zone.cargo + '</span></div>' +
      '</div>' +

      '<div class="zone-meters">' +
        meter('Sunlight', zone.sunlight,
              'Share of the cycle with usable Sun. <strong>GAME ESTIMATE</strong>') +
        multiplierRow('Solar power benefit', mods.powerBonus,
              'Multiplier on generated electricity. <strong>GAME ESTIMATE</strong>') +
        meter('Water ice research', zone.ice,
              'How close usable ice is. <strong>GAME ESTIMATE</strong>') +
        meter('Lunar dust risk', zone.dust,
              'Dust clogs seals and buries panels. <strong>GAME ESTIMATE</strong>') +
        meter('Heat management', zone.heat,
              'How hard the site is to keep warm. <strong>GAME ESTIMATE</strong>') +
      '</div>' +

      '<div class="zone-cols">' +
        '<div class="zone-col"><h3 class="zone-pro">Advantages</h3><ul>' + prosHtml + '</ul></div>' +
        '<div class="zone-col"><h3 class="zone-con">Disadvantages</h3><ul>' + consHtml + '</ul></div>' +
      '</div>' +

      '<h3 class="zone-facts-head">What is actually known about ' + zone.name +
        ' <span class="tag tag-fact">REAL SCIENCE</span></h3>' +
      '<ul class="zone-facts">' + factsHtml + '</ul>' +

      '<p class="zone-estimate-note">Every percentage, rating and cargo figure on this ' +
      'card is a <span class="tag tag-game">GAME ESTIMATE</span> invented for this game. ' +
      'They are not NASA measurements and not mission-planning figures.</p>' +

      '<button class="btn btn-ghost btn-block" type="button" id="btn-compare-site">' +
        (isPinned ? 'Remove from comparison' : 'Add to comparison') + '</button>';

    confirm.hidden = false;

    var cmpBtn = document.getElementById('btn-compare-site');
    if (cmpBtn) {
      cmpBtn.addEventListener('click', function () { toggleCompare(zone.id); });
    }
  }

  /* ---- the comparison table ---- */
  if (!compareBox) { return; }

  if (mapState.compare.length < 1) {
    compareBox.innerHTML = '';
    compareBox.hidden = true;
    return;
  }
  compareBox.hidden = false;

  var head = '<tr><th>Compare</th>';
  var body = '';
  for (var k = 0; k < mapState.compare.length; k++) {
    var cz = zoneById(mapState.compare[k]);
    if (!cz) { continue; }
    head += '<th>' + cz.name + '</th>';
  }
  head += '</tr>';

  function row(label, fn) {
    var r = '<tr><th>' + label + '</th>';
    for (var q = 0; q < mapState.compare.length; q++) {
      var qz = zoneById(mapState.compare[q]);
      r += '<td>' + (qz ? fn(qz) : '') + '</td>';
    }
    return r + '</tr>';
  }

  body =
    row('Difficulty', function (z) { return starRating(z.difficulty); }) +
    row('Coordinates', function (z) { return z.coords; }) +
    row('Terrain', function (z) { return z.terrain; }) +
    row('Sunlight <em>(game)</em>', function (z) { return Math.round(z.sunlight * 100) + '%'; }) +
    row('Water ice <em>(game)</em>', function (z) { return Math.round(z.ice * 100) + '%'; }) +
    row('Dust risk <em>(game)</em>', function (z) { return Math.round(z.dust * 100) + '%'; }) +
    row('Cargo <em>(game)</em>', function (z) { return String(z.cargo); });

  compareBox.innerHTML =
    '<h3 class="panel-title">Side by side</h3>' +
    '<div class="zone-compare-scroll"><table class="zone-compare-table">' +
      '<thead>' + head + '</thead><tbody>' + body + '</tbody>' +
    '</table></div>' +
    '<p class="zone-estimate-note">Rows marked <em>game</em> are ' +
    '<span class="tag tag-game">GAME ESTIMATE</span> values.</p>';
}

/* ------------------------------------------------------------
   7. LEAVING THE MAP
   ------------------------------------------------------------ */

/* Open the map from the welcome screen. */
function openMap() {
  mapState.selected = null;
  mapState.compare = [];
  showScreen('map');
  mapShow();
}

/* The site the player chose, or null if they have not chosen one. */
function selectedZone() {
  return zoneById(mapState.selected);
}

function confirmLandingSite() {
  var zone = selectedZone();
  if (!zone) { return false; }
  if (typeof startMission === 'function') { startMission(); }
  return true;
}