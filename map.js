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
  maxColat: 90,        // how far out the view reaches, in degrees from the pole
  hitAreas: [],         // filled in while drawing, used for clicking
  labelAreas: [],       // the label chips, which are the roomy targets
  edgeAreas: []         // chevrons for sites that are outside the zoomed view
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
   the south pole, so 0 at the pole and 90 at the equator.

   Phase 4 added `maxColat`, which is how far out the view reaches.
   At 90 it is the whole hemisphere from the pole, which is what the
   map always used to draw. Zooming in to 20 or 45 degrees is what
   makes the real craters big enough to see: Shackleton is 20.9 km
   across and Cabeus is 100.58 km, and on a whole-hemisphere view
   both are a handful of pixels. Drawing them to scale is honest but
   useless without a way to zoom.
   ------------------------------------------------------------ */

/* The Moon's mean radius. Used only to turn an angle into kilometres
   so the scale bar and the crater rings are real distances. */
var MOON_RADIUS_KM = 1737.4;

var MAP_ZOOMS = [
  { colat: 90, label: 'Whole hemisphere' },
  { colat: 45, label: 'Outer polar region' },
  { colat: 20, label: 'Inner polar region' }
];

function mapZoomIndex() {
  for (var i = 0; i < MAP_ZOOMS.length; i++) {
    if (MAP_ZOOMS[i].colat === mapState.maxColat) { return i; }
  }
  return 0;
}

/* How far out the current view reaches, in degrees from the pole. */
function mapMaxColat() {
  return (typeof mapState.maxColat === 'number') ? mapState.maxColat : 90;
}

/* Distance from the pole as a fraction of the disc, 0 at the pole and
   1 at the edge of the current view. */
function mapRho(lat) {
  var edge = Math.tan(mapMaxColat() * Math.PI / 360);
  if (edge <= 0) { return 0; }
  return Math.tan((90 + lat) * Math.PI / 360) / edge;
}

/* Ground kilometres per screen pixel at this distance from the pole.

   For this projection the un-normalised radius is tan(colat/2), and the
   ground distance out to it is 2R*atan(that). The map normalises the
   radius by the current view, so `k` is the factor the view divided
   the projection by - and the whole point of that factor is that
   zooming in genuinely makes the map cover fewer kilometres. Leaving
   it out made the scale bar lie at every zoom level except one. */
function mapKmPerPx(rho, radiusPx) {
  if (radiusPx <= 0) { return Infinity; }
  var k = Math.tan(mapMaxColat() * Math.PI / 360);
  return (2 * MOON_RADIUS_KM * k) / ((1 + k * k * rho * rho) * radiusPx);
}

function projectLatLon(lat, lon, cx, cy, radius) {
  var rho = mapRho(lat);
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
  drawCraterRings(ctx, d);
  drawPoleMarker(ctx, d, time);

  drawZoneDots(ctx, d, time);
  drawZoneLabels(ctx, d);
  drawEdgeMarkers(ctx, d);
  drawLegend(ctx, d);
  drawScaleBar(ctx, d);
}

/* Phase 4: the real craters, drawn at their published size.

   Shackleton is 20.9 km across and Cabeus is 100.58 km, and the ring
   is the crater's actual diameter on the actual Moon, not a decorative
   circle. On the whole-hemisphere view both are only a few pixels
   across, which is itself the point - which is why there is a zoom. */
function drawCraterRings(ctx, d) {
  if (typeof ZONE_LIST === 'undefined' || typeof lunarSiteData !== 'function') { return; }

  var maxRho = 1;

  for (var i = 0; i < ZONE_LIST.length; i++) {
    var data = lunarSiteData(ZONE_LIST[i].id);
    if (!data || !data.crater || typeof data.crater.diameterKm !== 'number') { continue; }

    /* Draw the ring at the published crater centre when there is one.
       Where there is not, draw it at the landing site instead and say
       so, rather than inventing a position. */
    var centred = typeof data.crater.centerLat === 'number';
    var lat = centred ? data.crater.centerLat : ZONE_LIST[i].lat;
    var lon = centred ? data.crater.centerLon : ZONE_LIST[i].lon;
    var p = projectLatLon(lat, lon, d.cx, d.cy, d.r);

    var off = Math.sqrt((p.x - d.cx) * (p.x - d.cx) + (p.y - d.cy) * (p.y - d.cy));
    if (off > d.r * 1.25) { continue; }

    var rho = mapRho(lat);
    var kmPerPx = mapKmPerPx(rho, d.r);
    var rPx = (data.crater.diameterKm / 2) / kmPerPx;
    if (!isFinite(rPx) || rPx <= 0) { continue; }

    var isSelected = mapState.selected === ZONE_LIST[i].id;
    var tint = isSelected ? 'rgba(255,209,102,0.55)' : 'rgba(150,205,255,0.38)';

    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, rPx, 0, Math.PI * 2);
    ctx.fillStyle = isSelected ? 'rgba(255,209,102,0.10)' : 'rgba(120,180,255,0.07)';
    ctx.fill();
    ctx.strokeStyle = tint;
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    /* Only label the ring when it is big enough to carry text, so the
       map never turns into a pile of overlapping labels. */
    if (rPx > 26) {
      ctx.font = 'bold 10px "Segoe UI", sans-serif';
      ctx.fillStyle = isSelected ? 'rgba(255,225,160,0.95)' : 'rgba(180,215,255,0.85)';
      ctx.textAlign = 'center';
      ctx.fillText(data.crater.diameterKm + ' km', p.x, p.y - rPx - 5);
    }
    ctx.restore();
  }
}

/* A scale bar in real kilometres. Without the zoom control a reader
   cannot tell how big anything is; with it, they can. */
function drawScaleBar(ctx, d) {
  var kmPerPx = mapKmPerPx(0, d.r);
  if (!isFinite(kmPerPx) || kmPerPx <= 0) { return; }

  /* pick a round distance that lands between 60 and 160 pixels */
  var candidates = [10, 25, 50, 100, 200, 500, 1000, 2000];
  var km = candidates[candidates.length - 1];
  for (var i = 0; i < candidates.length; i++) {
    if (candidates[i] / kmPerPx > 150) { break; }
    km = candidates[i];
  }

  var w = km / kmPerPx;
  if (!isFinite(w) || w < 10 || w > d.r * 0.8) { return; }

  var x = d.cx - w / 2;
  var y = d.cy + d.r - 16;

  ctx.save();
  ctx.strokeStyle = 'rgba(226,240,255,0.75)';
  ctx.fillStyle = 'rgba(226,240,255,0.75)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x + w, y);
  ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4);
  ctx.moveTo(x + w, y - 4); ctx.lineTo(x + w, y + 4);
  ctx.stroke();
  ctx.font = '10px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(km + ' km', x + w / 2, y - 7);
  ctx.restore();
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
    var rr = mapRho(rings[i].lat) * d.r;
    /* only draw a ring that fits inside the current view, and label it
       on the right-hand side so it cannot sit under the pole marker */
    if (rr > d.r - 6 || rr < 12) { continue; }
    ctx.beginPath();
    ctx.arc(d.cx, d.cy, rr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillText(rings[i].label, d.cx + 4, d.cy + rr - 4);
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

  for (var i = 0; i < ZONE_LIST.length; i++) {
    var zone = ZONE_LIST[i];
    var p = projectLatLon(zone.lat, zone.lon, d.cx, d.cy, d.r);
    var isSelected = mapState.selected === zone.id;
    var isCompared = mapState.compare.indexOf(zone.id) >= 0;

    var off = Math.sqrt((p.x - d.cx) * (p.x - d.cx) + (p.y - d.cy) * (p.y - d.cy));

    /* When the view is zoomed in, a site further out than the edge is
       not drawn at all here - it gets a chevron on the rim instead, so
       it can still be selected. */
    if (off < d.r - 4) {
      mapState.hitAreas.push({ id: zone.id, x: p.x, y: p.y });
    } else {
      continue;
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

/* A small chevron on the rim for every site outside the current view,
   pointing the way it lies. It is a real button: clicking it selects
   the site, so zooming in can never make a site unreachable. */
function drawEdgeMarkers(ctx, d) {
  mapState.edgeAreas = [];

  for (var i = 0; i < ZONE_LIST.length; i++) {
    var zone = ZONE_LIST[i];
    var rho = mapRho(zone.lat);
    if (rho <= 1.02) { continue; }

    var p = projectLatLon(zone.lat, zone.lon, d.cx, d.cy, d.r);
    var dx = p.x - d.cx;
    var dy = p.y - d.cy;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var ux = dx / len;
    var uy = dy / len;
    var edge = d.r - 11;

    var ex = d.cx + ux * edge;
    var ey = d.cy + uy * edge;
    var ang = Math.atan2(uy, ux);

    var isSelected = mapState.selected === zone.id;

    /* the chevron is drawn in unrotated space and then turned to face
       outward, so the arrow head always points the right way */
    var w = 13, h = 9;
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(-w / 2, -h / 2);
    ctx.lineTo(-w / 2 + 4, 0);
    ctx.lineTo(-w / 2, h / 2);
    ctx.closePath();
    ctx.fillStyle = isSelected ? '#ffd166' : 'rgba(190,210,245,0.75)';
    ctx.fill();
    ctx.strokeStyle = '#0b1226';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    /* a bigger, square hit target, because this is a small thing to tap */
    mapState.edgeAreas.push({ id: zone.id, x: ex, y: ey, w: 34, h: 30 });
  }
}

/* Labels on a ring, ordered by their true bearing so the map still
   reads as geography rather than a random wheel. */
function drawZoneLabels(ctx, d) {
  var order = ZONE_LIST.slice().sort(function (a, b) { return bearingOf(a, d) - bearingOf(b, d); });
  var ringR = d.r * 0.74;
  var step = (Math.PI * 2) / order.length;

  mapState.labelAreas = [];

  for (var i = 0; i < order.length; i++) {
    var zone = order[i];

    /* a site outside the current view gets a rim chevron instead, and
       is left out of the ring so the two never contradict each other */
    if (mapRho(zone.lat) > 1.02) { continue; }

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

  /* the crater rings are real data, so say so and name the source */
  if (typeof lunarSource === 'function') {
    var src = lunarSource('tye2015') || lunarSource('gazetteer');
    ctx.font = '9px "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(20,32,62,0.7)';
    ctx.fillText('Dashed rings: real craters, to scale  ·  ' +
                 (src ? src.short : 'IAU Gazetteer'), d.cx, d.cy + d.r + 27);
  }
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

  /* then the rim chevrons, so a site outside the zoom is still a
     one-click choice rather than something you have to find in a list */
  if (mapState.edgeAreas) {
    for (var e = 0; e < mapState.edgeAreas.length; e++) {
      var c = mapState.edgeAreas[e];
      if (Math.abs(x - c.x) <= c.w / 2 && Math.abs(y - c.y) <= c.h / 2) {
        return c.id;
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

/* Change how far out the map looks. The selection, the comparison pins
   and the marker layout all survive, and every site stays reachable
   through its rim chevron. */
function setMapZoom(colat) {
  for (var i = 0; i < MAP_ZOOMS.length; i++) {
    if (MAP_ZOOMS[i].colat === colat) {
      mapState.maxColat = colat;
      break;
    }
  }
  if (!mapW || !mapH) { return; }
  if (mapReduceMotion) { drawMap(0); } else { drawMap(mapState.t); }
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

/* The zoom buttons. The map is drawn to scale, and at the default
   whole-hemisphere view a 20.9 km crater really is only a few pixels
   across. Zooming is what makes the real data readable. */
function renderMapZoom() {
  var box = document.getElementById('map-zoom');
  if (!box) { return; }

  var html = '';
  for (var i = 0; i < MAP_ZOOMS.length; i++) {
    var z = MAP_ZOOMS[i];
    var on = (z.colat === mapMaxColat());
    html += '<button class="map-zoom-btn' + (on ? ' is-on' : '') +
            '" type="button" data-colat="' + z.colat + '"' +
            (on ? ' aria-current="true"' : '') + '>' + z.label + '</button>';
  }
  box.innerHTML = html;

  var btns = box.querySelectorAll('.map-zoom-btn');
  for (var b = 0; b < btns.length; b++) {
    btns[b].addEventListener('click', function (e) {
      setMapZoom(Number(e.currentTarget.getAttribute('data-colat')));
    });
  }
}

function renderMapPanel() {
  var panel = document.getElementById('zone-panel');
  var list = document.getElementById('zone-list');
  var compareBox = document.getElementById('zone-compare');
  var confirm = document.getElementById('btn-confirm-site');
  if (!panel || !list || !confirm) { return; }

  /* ---- the list, always visible, always keyboard reachable ---- */
  var listHtml = '';
  for (var i = 0; i < ZONE_LIST.length; i++) {
    var z = ZONE_LIST[i];
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

      /* ---- Phase 4: the measured record comes FIRST, above the
         invented numbers, because that is the honest order. Real
         data, then the photograph, then this game's estimates. ---- */
      '<div class="zone-evidence">' + renderSiteScience(zone) + '</div>' +
      '<div id="site-images" class="site-images"></div>' +

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

      '<h3 class="zone-meters-head">What this game makes of it ' +
        '<span class="tag tag-game">GAME ESTIMATE</span></h3>' +

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

    /* Phase 4: fetch a real photograph of the crater the player just
       picked. Deliberately done after the panel is on screen, so a slow
       or failing network never delays the map itself. */
    if (typeof loadSiteImage === 'function') { loadSiteImage(zone); }
  }

  renderMapZoom();

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
   6b. THE SITE SCIENCE PANEL
   Phase 4. This is the panel that does the actual teaching, and it is
   the reason the map can now say anything specific about a crater.

   It is built in three blocks and the blocks are never mixed:

     VERIFIED      a published number, with the source that reported it
     INTERPRETED   a conclusion drawn from those numbers, marked as one
     NOT AVAILABLE a measurement that genuinely exists but is not in
                   this game, with a link to where it does exist

   The last block is the important one. Elevation and slope for every
   one of these sites is real, published NASA data - it is just a set
   of 5 m/pixel GeoTIFF rasters that a browser cannot query for one
   point. Saying so, and linking to it, teaches more than a made-up
   number ever could.
   ------------------------------------------------------------ */

/* A tiny local escaper. The only untrusted strings reaching this
   panel come from NASA's own API, but a broken response should never
   be able to inject markup into the page. */
function mapText(s) {
  return String(s === undefined || s === null ? '' : s).replace(/[<>]/g, '');
}

function sourceLink(sourceId) {
  var src = (typeof lunarSource === 'function') ? lunarSource(sourceId) : null;
  if (!src) { return ''; }
  return '<a class="ev-src" href="' + mapText(src.url) +
         '" target="_blank" rel="noopener">' + mapText(src.short) + '</a>';
}

function evidenceRow(label, value, detail, sourceId, tier) {
  var cls = 'ev-row is-' + (tier || 'verified');
  return '<li class="' + cls + '">' +
           '<span class="ev-label">' + label + '</span>' +
           '<span class="ev-value">' + value + '</span>' +
           (detail ? '<span class="ev-detail">' + detail + '</span>' : '') +
           (sourceId ? '<span class="ev-cite">Source: ' + sourceLink(sourceId) + '</span>' : '') +
         '</li>';
}

function renderSiteScience(zone) {
  if (typeof lunarSiteData !== 'function') { return ''; }

  var data = lunarSiteData(zone.id);
  if (!data) { return ''; }

  var verified = '';
  var interpreted = '';
  var missing = '';

  /* ---- verified ---- */
  if (data.crater) {
    var centreNote = '';
    if (typeof data.crater.centerLat === 'number') {
      centreNote = 'Centred on ' + data.crater.centerLat + '°, ' + data.crater.centerLon + '°.' +
        (data.crater.featureId ? ' IAU feature ' + data.crater.featureId + '.' : '');
    } else {
      centreNote = 'The published centre coordinates were not verified here, so the ring on ' +
        'the map is drawn at the landing site rather than at the crater centre.';
    }
    verified += evidenceRow(
      'Crater size',
      data.crater.diameterKm + ' km',
      data.crater.name + ' across. ' + centreNote,
      data.crater.sourceId, 'verified');
  }

  if (data.illumination) {
    if (typeof data.illumination.pct === 'number') {
      verified += evidenceRow(
        'Sunlight',
        data.illumination.pct + '% of the lunar year',
        data.illumination.note,
        data.illumination.sourceId, 'verified');
    } else {
      /* No published figure for this exact spot. Saying "we do not have
         a number for here" is the honest answer, and it is more
         interesting than another invented percentage. */
      missing += evidenceRow(
        'Sunlight at this spot',
        'Not published',
        data.illumination.note + ' Illumination modelling has been done for specific polar ' +
        'points, not for every crater, so no percentage is given here rather than a guess.',
        'mazarico', 'missing');
    }
  }

  if (data.ice) {
    var badge = {
      detected: 'Measured here',
      cluster: 'Detected nearby',
      'not-detected': 'None found',
      'out-of-band': 'Too far from the pole'
    }[data.ice.status] || 'Unknown';
    verified += evidenceRow('Water ice', badge, data.ice.detail, data.ice.sourceId, 'verified');
  }

  /* ---- not available, but it exists ---- */
  var lola = (typeof lunarSource === 'function') ? lunarSource('lolaDem') : null;
  missing +=
    evidenceRow('Elevation', 'Not in this game',
      'Real elevation is published for this whole region as a 5 m/pixel digital elevation model ' +
      'from the Lunar Orbiter Laser Altimeter. It is a large GeoTIFF product that a browser cannot ' +
      'query for a single point, so no height is shown rather than an invented one.',
      'lolaDem', 'missing') +
    evidenceRow('Ground slope', 'Not in this game',
      'The same LOLA dataset publishes slope maps in degrees. Same reason: available as a bulk ' +
      'download, not as a number this page can honestly quote.',
      'lolaDem', 'missing');

  /* ---- interpretation ---- */
  var rho = mapRho(zone.lat);
  var distanceDeg = Math.round((90 + zone.lat) * 10) / 10;
  if (data.ice && data.ice.status === 'out-of-band') {
    interpreted += evidenceRow('Why there is no ice here',
      distanceDeg + '° from the pole',
      'Every water-ice detection reported so far sits within ' +
      (typeof LUNAR_REGION !== 'undefined' ? LUNAR_REGION.iceLatitudeBandDeg : 20) +
      '° of a pole, and none at all below ' +
      (typeof LUNAR_REGION !== 'undefined' ? LUNAR_REGION.iceNoDetectionBelowDeg : 70) +
      '°. This is a conclusion drawn from those results, not a measurement of this crater.',
      'li2018', 'interpreted');
  } else if (data.ice && data.ice.status === 'detected') {
    interpreted += evidenceRow('What that means for a base',
      'The only proven source on this map',
      'A crater where ice has actually been measured is the one place a real base would plan to ' +
      'mine. In this game it also lowers the number of structures the crew must log to sign off ' +
      'the survey, from ' + surveyTargetText(false) + ' to ' + surveyTargetText(true) + '.',
      'lcross', 'interpreted');
  } else if (data.ice && data.ice.status === 'cluster') {
    interpreted += evidenceRow('What that means for a base',
      'Worth a sample, not a guarantee',
      'Detections cluster near this crater but not inside it. ' +
      (typeof LUNAR_REGION !== 'undefined' ?
        'Only about ' + LUNAR_REGION.coldTrapIceSharePct + '% of cold traps at both poles showed any ice signature at all, ' +
        'so a nearby detection is a reason to look here, not a promise of what you will find.' : ''),
      'li2018', 'interpreted');
  }

  if (typeof LUNAR_REGION !== 'undefined') {
    interpreted += evidenceRow('South polar shadow', 
      LUNAR_REGION.shadowedAreaSouthKm2.toLocaleString() + ' km² in permanent shadow',
      'That is the modelled total for the southern hemisphere, and it is why a crater floor can be ' +
      'cold enough to hold ice while the rim above it is in near-continuous sunlight.',
      'mazarico', 'interpreted');
  }

  function surveyTargetText(iceSite) {
    if (typeof surveyTargetFor !== 'function') { return iceSite ? '3' : '4'; }
    return String(surveyTargetFor(iceSite ? 'cabeus' : 'nobile'));
  }

  var html =
    '<div class="ev-block">' +
      '<h3 class="ev-head">Measured <span class="tag tag-fact">VERIFIED DATA</span></h3>' +
      '<ul class="ev-list">' + verified + '</ul>' +
    '</div>' +
    '<div class="ev-block">' +
      '<h3 class="ev-head">Reasoned from that data <span class="tag ev-tag-interpreted">INTERPRETATION</span></h3>' +
      '<ul class="ev-list">' + interpreted + '</ul>' +
    '</div>' +
    '<div class="ev-block">' +
      '<h3 class="ev-head">Real, but not in this game <span class="tag ev-tag-missing">NOT BUNDLED</span></h3>' +
      '<ul class="ev-list">' + missing + '</ul>' +
      (lola ? '<p class="ev-note">The real elevation and slope data: ' +
              '<a href="' + mapText(lola.url) + '" target="_blank" rel="noopener">' +
              mapText(lola.label) + '</a></p>' : '') +
    '</div>';

  return html;
}

/* ------------------------------------------------------------
   7. LEAVING THE MAP
   ------------------------------------------------------------ */

/* Open the map from the welcome screen. Always starts on the default
   view, so a player who zoomed in to look at Cabeus does not come back
   to a map that is still zoomed and cannot see where they are. */
function openMap() {
  mapState.selected = null;
  mapState.compare = [];
  mapState.maxColat = MAP_ZOOMS[0].colat;
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

  /* With the builder in place, landing here means laying out the base
     first. If the world is missing the builder cannot run, so the
     mission starts straight away, which is what happened before
     Phase 2. */
  if (typeof openBuilder === 'function' && openBuilder()) {
    return true;
  }
  if (typeof startMission === 'function') { startMission(); }
  return true;
}