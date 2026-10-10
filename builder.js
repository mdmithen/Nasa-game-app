/* ============================================================
   PHASE 2 - THE MOON BASE BUILDER
   ------------------------------------------------------------
   Lets the player lay out the base before the mission starts: pick a
   structure from the palette, put it on the surface, move it, or take
   it away again, all against a cargo budget set by the landing site.

   It draws nothing of its own beyond the guides it paints on top of
   the finished scene, and it decides nothing about the mission. The
   result is handed over once, as a layout, by `builderLayout()`.

   Placement rules
     - structures snap to a grid, so nothing ends up half a pixel off
     - nothing may overlap another structure, or sit on a rock
     - a type can only be built as many times as its limit allows
     - every structure costs cargo, and the landing site decides how
       much cargo is delivered, so a hard site is a tight base

   The minimum sensible base needs one of every type. That is enforced
   here purely so the player cannot continue into a mission with a
   structure missing that the mission is going to ask them for.
   ============================================================ */

var BUILDER = {
  /* A 20 pixel grid with a 140 pixel minimum gap. Both are chosen
     against the shipped base, whose structures stand 320 apart: this
     leaves several legal spots in every gap between them, so there is
     somewhere to build. A sprite is 96 wide, so 140 still leaves 44
     clear pixels and two structures can never overlap.

     Rocks deliberately do NOT block a placement. They sit in the gaps
     between the shipped structures, so treating them as obstacles
     would leave almost nowhere to build. Building over one simply
     clears it, which `clearOfStations()` already does. */
  grid: 20,
  minX: 120,         /* leftmost placeable position */
  maxX: 2380,        /* rightmost placeable position */
  minGap: 140,       /* closest two structures may stand together */
  pickWidth: 110     /* how close to a structure counts as grabbing it */
};

var builder = {
  layout: [],        // [{uid, type, x}] as it currently stands
  armed: null,       // type chosen from the palette, waiting to be placed
  moving: null,      // uid being repositioned
  selected: null,    // uid of the structure the player has picked up
  ghostX: null,      // world x under the pointer, snapped
  budget: 150,
  uidCounter: 0,
  open: false
};

/* ------------------------------------------------------------
   1. SMALL HELPERS
   ------------------------------------------------------------ */

function buildClamp(v, low, high) {
  if (v < low) { return low; }
  if (v > high) { return high; }
  return v;
}

function typeOf(id) {
  return (typeof STATION_TYPE_INDEX !== 'undefined') ? STATION_TYPE_INDEX[id] : null;
}

function builderCount(type) {
  var n = 0;
  for (var i = 0; i < builder.layout.length; i++) {
    if (builder.layout[i].type === type) { n++; }
  }
  return n;
}

function builderSpent() {
  var total = 0;
  for (var i = 0; i < builder.layout.length; i++) {
    var t = typeOf(builder.layout[i].type);
    if (t) { total += t.cost; }
  }
  return total;
}

function builderRemaining() {
  return builder.budget - builderSpent();
}

/* Snap a world position onto the build grid and inside the plot. */
function builderSnap(x) {
  var snapped = Math.round(x / BUILDER.grid) * BUILDER.grid;
  return buildClamp(snapped, BUILDER.minX, BUILDER.maxX);
}

/* ------------------------------------------------------------
   2. VALIDATION
   Every refusal carries a reason, because a placement that simply
   refuses with no explanation is the most frustrating thing a builder
   can do.
   ------------------------------------------------------------ */

/* Is there a rock in the way? Reporting it lets the panel warn the
   player that the spot will be cleared, without refusing a build that
   would otherwise be fine. */
function builderRockNear(x) {
  var half = CFG.stationHalfWidth;
  for (var i = 0; i < solids.length; i++) {
    var s = solids[i];
    if (x + half > s.x && x - half < s.x + s.w) { return true; }
  }
  return false;
}

/* `ignoreUid` lets a structure be checked against its own position
   when it is being moved. */
function builderCheck(type, x, ignoreUid) {
  var info = typeOf(type);
  if (!info) { return { ok: false, reason: 'Unknown structure' }; }

  var count = builderCount(type);
  var ignoringSelf = false;
  for (var c = 0; c < builder.layout.length; c++) {
    if (builder.layout[c].uid === ignoreUid && builder.layout[c].type === type) { ignoringSelf = true; }
  }
  if (ignoringSelf) { count--; }

  if (count >= info.limit) {
    return { ok: false, reason: 'Only ' + info.limit + ' ' + info.name + ' allowed in one base' };
  }

  var other = builderSpent();
  /* moving a structure changes nothing about what it cost, so the
     cost is only added when this would be a new one */
  var wouldBe = ignoreUid ? other : other + info.cost;
  if (wouldBe > builder.budget) {
    return { ok: false, reason: 'Not enough cargo. This costs ' + info.cost + ' and you have ' +
                                (builder.budget - other) + ' left' };
  }

  if (x < BUILDER.minX || x > BUILDER.maxX) {
    return { ok: false, reason: 'Too close to the edge of the landing area' };
  }

  for (var i = 0; i < builder.layout.length; i++) {
    var item = builder.layout[i];
    if (item.uid === ignoreUid) { continue; }
    if (Math.abs(item.x - x) < BUILDER.minGap) {
      var near = typeOf(item.type);
      return { ok: false, reason: 'Too close to the ' + (near ? near.name.toLowerCase() : 'structure') +
                                  '. Keep ' + BUILDER.minGap + 'px apart' };
    }
  }

  return { ok: true, reason: '', clearsRock: builderRockNear(x) };
}

/* ------------------------------------------------------------
   3. PLACING, MOVING AND REMOVING
   ------------------------------------------------------------ */

function builderArm(type) {
  if (!typeOf(type)) { return; }
  builder.armed = (builder.armed === type) ? null : type;
  builder.selected = null;
  builderRender();
}

function builderNextUid() {
  builder.uidCounter = builder.uidCounter + 1;
  return 'built-' + builder.uidCounter;
}

function builderPlace(type, x) {
  var snapped = builderSnap(x);
  var check = builderCheck(type, snapped, null);
  if (!check.ok) { return check; }

  var item = { uid: builderNextUid(), type: type, x: snapped };
  builder.layout.push(item);

  /* a second of the same thing is usually wanted straight away, so
     stay armed, but never over the limit */
  var info = typeOf(type);
  if (builderCount(type) >= info.limit) { builder.armed = null; }

  builderApply();
  return { ok: true, reason: '' };
}

function builderSelect(uid) {
  builder.selected = (builder.selected === uid) ? null : uid;
  builder.armed = null;
  builderRender();
}

function builderMove(uid, x) {
  for (var i = 0; i < builder.layout.length; i++) {
    if (builder.layout[i].uid !== uid) { continue; }
    var snapped = builderSnap(x);
    var check = builderCheck(builder.layout[i].type, snapped, uid);
    if (!check.ok) { return check; }
    builder.layout[i].x = snapped;
    builderApply();
    return { ok: true, reason: '' };
  }
  return { ok: false, reason: 'That structure is no longer there' };
}

function builderRemove(uid) {
  for (var i = 0; i < builder.layout.length; i++) {
    if (builder.layout[i].uid === uid) {
      builder.layout.splice(i, 1);
      builder.selected = null;
      builderApply();
      return true;
    }
  }
  return false;
}

function builderCancel() {
  if (builder.armed) { builder.armed = null; builderRender(); return; }
  if (builder.selected) { builder.selected = null; builderRender(); return; }
}

/* The structure nearest a world position, if it is close enough. */
function builderStructureAt(x) {
  var best = null;
  var bestDist = BUILDER.pickWidth * BUILDER.pickWidth;
  for (var i = 0; i < builder.layout.length; i++) {
    var dx = builder.layout[i].x - x;
    var dist = dx * dx;
    if (dist <= bestDist) { bestDist = dist; best = builder.layout[i]; }
  }
  return best;
}

/* First legal spot for a type, scanning left to right. This is what
   the keyboard route uses, and it doubles as the auto-place button. */
function builderFirstFreeSpot(type) {
  for (var x = BUILDER.minX; x <= BUILDER.maxX; x += BUILDER.grid) {
    if (builderCheck(type, x, null).ok) { return x; }
  }
  return null;
}

/* Push the layout onto the surface and redraw everything. */
function builderApply() {
  if (window.world && typeof world.applyLayout === 'function') {
    world.applyLayout(builder.layout);
  }
  builderRender();
}

/* ------------------------------------------------------------
   4. READINESS
   A mission is going to be asked to use each of these, so a base that
   is missing one of them cannot be launched.
   ------------------------------------------------------------ */

function builderMissing() {
  var missing = [];
  for (var i = 0; i < STATION_TYPES.length; i++) {
    var t = STATION_TYPES[i];
    if (builderCount(t.id) === 0) { missing.push(t); }
  }
  return missing;
}

function builderReady() {
  return builderMissing().length === 0 && builderRemaining() >= 0;
}

/* The layout handed to the mission. A copy, so nothing downstream can
   change the base while it is being played. */
function builderLayout() {
  var out = [];
  for (var i = 0; i < builder.layout.length; i++) {
    out.push({
      uid: builder.layout[i].uid,
      type: builder.layout[i].type,
      x: builder.layout[i].x
    });
  }
  return out;
}

/* ------------------------------------------------------------
   5. THE PANEL
   ------------------------------------------------------------ */

function builderRender() {
  var palette = document.getElementById('build-palette');
  var summary = document.getElementById('build-summary');
  var cargo = document.getElementById('build-cargo');
  var actions = document.getElementById('build-actions');
  if (!palette) { return; }

  /* ---- palette ---- */
  var html = '';
  for (var i = 0; i < STATION_TYPES.length; i++) {
    var t = STATION_TYPES[i];
    var have = builderCount(t.id);
    var overLimit = have >= t.limit;
    var tooDear = builderRemaining() < t.cost;
    var cls = 'build-item' + (builder.armed === t.id ? ' is-armed' : '');
    if (overLimit || tooDear) { cls += ' is-blocked'; }

    html +=
      '<button class="' + cls + '" type="button" data-type="' + t.id + '"' +
        (overLimit ? ' disabled' : '') + '>' +
        '<span class="build-item-icon" aria-hidden="true">' + spriteThumbHtml(t) + '</span>' +
        '<span class="build-item-text">' +
          '<span class="build-item-name">' + t.name + '</span>' +
          '<span class="build-item-role">' + t.role + '</span>' +
        '</span>' +
        '<span class="build-item-meta">' +
          '<span class="build-item-cost">' + t.cost + '</span>' +
          '<span class="build-item-have">' + have + ' / ' + t.limit + '</span>' +
        '</span>' +
      '</button>';
  }
  palette.innerHTML = html;
  builderPaintThumbs();

  var items = palette.querySelectorAll('.build-item');
  for (var b = 0; b < items.length; b++) {
    (function (node) {
      node.addEventListener('click', function () { builderArm(node.getAttribute('data-type')); });
    })(items[b]);
  }

  /* ---- cargo ---- */
  if (cargo) {
    var spent = builderSpent();
    var left = builderRemaining();
    var pct = builder.budget > 0 ? Math.round((spent / builder.budget) * 100) : 0;
    var cls = 'build-cargo-bar-fill';
    if (left < 0) { cls += ' is-over'; }
    else if (left < builder.budget * 0.15) { cls += ' is-low'; }

    cargo.innerHTML =
      '<div class="build-cargo-head">' +
        '<span>Supplies delivered</span>' +
        '<strong>' + builder.budget + '</strong>' +
      '</div>' +
      '<div class="build-cargo-bar"><div class="' + cls + '" style="width:' +
        buildClamp(pct, 0, 100) + '%"></div></div>' +
      '<p class="build-cargo-note">' +
        '<strong>' + spent + '</strong> spent &middot; <strong>' +
        (left < 0 ? '-' + (-left) : left) + '</strong> left' +
      '</p>';
  }

  /* ---- summary ---- */
  if (summary) {
    if (builder.layout.length === 0) {
      summary.innerHTML = '<p class="build-summary-empty">Nothing built yet. Choose a structure below.</p>';
    } else {
      var rows = '';
      for (var s = 0; s < builder.layout.length; s++) {
        var item = builder.layout[s];
        var info = typeOf(item.type);
        if (!info) { continue; }
        var isSel = builder.selected === item.uid;
        rows +=
          '<li class="build-row' + (isSel ? ' is-selected' : '') +
            '" data-uid="' + item.uid + '">' +
            '<span class="build-row-name">' + info.name + '</span>' +
            '<span class="build-row-x">at ' + Math.round(item.x) + '</span>' +
          '</li>';
      }
      summary.innerHTML = '<h3 class="build-summary-head">Base layout (' +
        builder.layout.length + ' structures)</h3><ul class="build-rows">' + rows + '</ul>';

      var rowNodes = summary.querySelectorAll('.build-row');
      for (var r = 0; r < rowNodes.length; r++) {
        (function (node) {
          node.addEventListener('click', function () { builderSelect(node.getAttribute('data-uid')); });
        })(rowNodes[r]);
      }
    }
  }

  /* ---- what is armed / selected, and the controls ---- */
  if (actions) {
    var note = '';
    var canGo = builderReady();

    if (builder.selected) {
      var sel = null;
      for (var f = 0; f < builder.layout.length; f++) {
        if (builder.layout[f].uid === builder.selected) { sel = builder.layout[f]; }
      }
      var selType = sel ? typeOf(sel.type) : null;
      note = selType
        ? 'Moving the ' + selType.name.toLowerCase() + '. Click a new spot. Dragging is not needed.'
        : '';
    } else if (builder.armed) {
      var armedType = typeOf(builder.armed);
      note = armedType
        ? 'Click the ground to put down the ' + armedType.name.toLowerCase() + '. Press Esc to stop.'
        : '';
    } else {
      note = 'Pick a structure, then click where it should go.';
    }

    var missing = builderMissing();
    var blocked = '';
    if (missing.length > 0) {
      var names = [];
      for (var m = 0; m < missing.length; m++) { names.push(missing[m].name); }
      blocked = '<p class="build-blocked"><strong>Still needed:</strong> ' +
                names.join(', ') + '</p>';
    } else if (builderRemaining() < 0) {
      blocked = '<p class="build-blocked"><strong>Over budget by ' +
                (-builderRemaining()) + '.</strong> Remove a structure to continue.</p>';
    }

    var moveBtn = builder.selected
      ? '<button class="btn btn-ghost btn-small" type="button" id="btn-build-move">Move</button>' +
        '<button class="btn btn-ghost btn-small" type="button" id="btn-build-remove">Remove (+' +
          (selType ? selType.cost : 0) + ')</button>'
      : '';

    var autoBtn = builder.armed
      ? '<button class="btn btn-ghost btn-small" type="button" id="btn-build-auto">Place in first free spot</button>'
      : '';

    actions.innerHTML =
      '<p class="build-hint">' + note + '</p>' +
      blocked +
      '<div class="build-buttons">' +
        autoBtn + moveBtn +
        '<button class="btn btn-primary btn-small" type="button" id="btn-build-launch"' +
          (canGo ? '' : ' disabled') + '>Continue to Mission</button>' +
      '</div>';

    var auto = document.getElementById('btn-build-auto');
    if (auto) {
      auto.addEventListener('click', function () {
        var spot = builderFirstFreeSpot(builder.armed);
        if (spot === null) { return; }
        builderPlace(builder.armed, spot);
      });
    }

    var move = document.getElementById('btn-build-move');
    if (move) {
      move.addEventListener('click', function () {
        /* arm the selected structure so the next ground click moves it */
        for (var g = 0; g < builder.layout.length; g++) {
          if (builder.layout[g].uid === builder.selected) {
            builder.armed = null;
            builder.moving = builder.layout[g].uid;
            builderRender();
          }
        }
      });
    }

    var remove = document.getElementById('btn-build-remove');
    if (remove) {
      remove.addEventListener('click', function () { builderRemove(builder.selected); });
    }

    var launch = document.getElementById('btn-build-launch');
    if (launch) {
      launch.addEventListener('click', builderLaunch);
    }
  }
}

/* A tiny canvas per palette entry, showing the same sprite the base
   will be built from. The markup goes in with the panel and is painted
   afterwards, because a canvas cannot be drawn into before it is in
   the document. */
function spriteThumbHtml(type) {
  return '<canvas class="build-thumb" width="44" height="44" ' +
         'data-sprite="' + type.sprite + '" data-letter="' +
         type.name.charAt(0) + '"></canvas>';
}

/* Paint every thumbnail the palette just created. Falls back to a
   lettered tile if the sprite sheet is still loading or missing. */
function builderPaintThumbs() {
  var thumbs = document.querySelectorAll('.build-thumb');
  for (var i = 0; i < thumbs.length; i++) {
    var c = thumbs[i];
    var ctx = c.getContext ? c.getContext('2d') : null;
    if (!ctx) { continue; }

    var name = c.getAttribute('data-sprite');
    var frame = (typeof SPRITE_MAP !== 'undefined') ? SPRITE_MAP[name] : null;

    if (spritesReady && sheetImage && frame) {
      ctx.drawImage(sheetImage, frame.x, frame.y, frame.w, frame.h, 2, 2, 40, 40);
    } else {
      ctx.fillStyle = '#9fb0d4';
      ctx.font = 'bold 20px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(c.getAttribute('data-letter'), 22, 30);
    }
  }
}

/* ------------------------------------------------------------
   6. THE GUIDES DRAWN OVER THE SCENE
   Called by world.js every frame while the builder is open.
   ------------------------------------------------------------ */

function drawBuildOverlay(ctx, camX) {
  ctx.save();

  /* a faint tick on the ground at every grid position, so it is
     obvious the base snaps to a grid */
  ctx.strokeStyle = 'rgba(120,150,200,0.16)';
  ctx.lineWidth = 1;
  for (var x = BUILDER.minX; x <= BUILDER.maxX; x += BUILDER.grid * 4) {
    var sx = x - camX;
    if (sx < 0 || sx > world.viewW) { continue; }
    ctx.beginPath();
    ctx.moveTo(sx, CFG.groundY - 10);
    ctx.lineTo(sx, CFG.groundY + 6);
    ctx.stroke();
  }

  /* the structure the player has picked up */
  if (builder.selected) {
    for (var i = 0; i < builder.layout.length; i++) {
      if (builder.layout[i].uid !== builder.selected) { continue; }
      var sel = builder.layout[i];
      var info = typeOf(sel.type);
      drawBuildOutline(ctx, sel.x - camX, info ? info.sprite : null, '#4fd1e0', true);
    }
  }

  /* the ghost being positioned */
  if (builder.ghostX !== null) {
    var moving = builder.moving || null;
    var ghostType = moving
      ? (function () { for (var m = 0; m < builder.layout.length; m++) {
                         if (builder.layout[m].uid === moving) { return builder.layout[m].type; } }
                       return null; })()
      : builder.armed;

    if (ghostType) {
      var snapped = builderSnap(builder.ghostX);
      var gtype = typeOf(ghostType);
      var verdict = builderCheck(ghostType, snapped, moving);
      drawBuildOutline(ctx, snapped - camX, gtype ? gtype.sprite : null,
                       verdict.ok ? '#4ade80' : '#fb7185', false);

      /* the reason a spot is refused, written on the ground */
      if (!verdict.ok) {
        ctx.font = 'bold 12px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        var text = verdict.reason;
        var tw = ctx.measureText(text).width + 16;
        ctx.fillStyle = 'rgba(60,10,20,0.92)';
        ctx.beginPath();
        ctx.roundRect(snapped - camX - tw / 2, CFG.groundY - 128, tw, 22, 7);
        ctx.fill();
        ctx.fillStyle = '#ffc4c4';
        ctx.fillText(text, snapped - camX, CFG.groundY - 113);
      }
    }
  }

  ctx.restore();
}

/* A footprint outline plus, when possible, the real sprite at 40%
   opacity so it reads as the thing that is about to be placed. */
function drawBuildOutline(ctx, x, spriteName, colour, solid) {
  var half = CFG.stationHalfWidth;
  var top = CFG.groundY - 86;

  ctx.save();

  if (!solid && spriteName && spritesReady && SPRITE_MAP[spriteName]) {
    ctx.globalAlpha = 0.45;
    drawSprite(ctx, spriteName, x - 48, top, 96, 96);
    ctx.globalAlpha = 1;
  }

  ctx.strokeStyle = colour;
  ctx.lineWidth = solid ? 3 : 2;
  ctx.setLineDash(solid ? [] : [6, 4]);
  ctx.beginPath();
  ctx.roundRect(x - half, top, half * 2, 86, 8);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.restore();
}

/* ------------------------------------------------------------
   7. OPENING AND CLOSING
   ------------------------------------------------------------ */

/* Start from the shipped base so the player edits rather than rebuilds
   from nothing. */
function builderSeed() {
  if (typeof DEFAULT_LAYOUT === 'undefined') { return; }
  builder.layout = [];
  builder.uidCounter = 0;
  for (var i = 0; i < DEFAULT_LAYOUT.length; i++) {
    builder.layout.push({ uid: builderNextUid(), type: DEFAULT_LAYOUT[i].type, x: DEFAULT_LAYOUT[i].x });
  }
}

function openBuilder() {
  /* The structure catalogue lives in world.js. If that file is not
     there the base cannot be built, so the caller falls back to
     starting the mission directly, exactly as it did before Phase 2. */
  if (typeof STATION_TYPES === 'undefined') { return false; }
  if (!window.world || typeof world.applyLayout !== 'function') { return false; }

  var zone = (typeof selectedZone === 'function') ? selectedZone() : null;
  var mods = (typeof zoneModsFor === 'function') ? zoneModsFor(zone) : null;
  builder.budget = mods ? mods.cargo : 150;

  /* Start from the shipped base the first time, so the player is
     editing rather than rebuilding from nothing. Coming back later,
     including from the map to change site, keeps whatever they built:
     throwing it away would be punishing, and the cargo bar already
     shows whether the new site's budget still covers it. */
  if (builder.layout.length === 0) { builderSeed(); }
  builder.zoneId = zone ? zone.id : null;

  builder.armed = null;
  builder.selected = null;
  builder.moving = null;
  builder.ghostX = null;
  builder.open = true;

  var section = document.getElementById('screen-game');
  var bar = document.getElementById('build-bar');
  if (section) { section.classList.add('is-building'); }
  if (bar) { bar.hidden = false; }

  if (window.world && typeof world.setMode === 'function') { world.setMode('build'); }
  showScreen('game');
  builderApply();
  world.reset();
  closeStationPanel();
  builderRender();
}

function closeBuilder() {
  if (!builderReady()) { return false; }

  builder.open = false;
  builder.armed = null;
  builder.selected = null;
  builder.moving = null;
  builder.ghostX = null;

  var section = document.getElementById('screen-game');
  var bar = document.getElementById('build-bar');
  if (section) { section.classList.remove('is-building'); }
  if (bar) { bar.hidden = true; }

  if (window.world && typeof world.setMode === 'function') { world.setMode('play'); }
  return true;
}

/* Hand the finished base over and start playing it. This is the only
   place the builder reaches into the mission. */
function builderLaunch() {
  if (!builderReady()) { return false; }
  if (!closeBuilder()) { return false; }
  if (typeof startMission === 'function') { startMission(); }
  return true;
}

/* Back out to the landing map without launching. The layout is kept,
   so choosing a different site comes back to the base already built
   and the cargo bar shows whether the new budget still covers it. */
function builderBackToMap() {
  closeBuilder();
  if (typeof openMap === 'function') { openMap(); }
}

/* ------------------------------------------------------------
   8. POINTER AND KEYBOARD
   ------------------------------------------------------------ */

/* Turn a screen position into a world position on the surface. */
function builderWorldXFromClient(clientX, canvas) {
  var rect = canvas.getBoundingClientRect();
  return clientX - rect.left + camera.x;
}

function setupBuilderInput() {
  var canvas = document.getElementById('game-canvas');
  if (!canvas) { return; }

  function ghostAt(event) {
    var clientX = (event.changedTouches && event.changedTouches.length)
      ? event.changedTouches[0].clientX : event.clientX;
    builder.ghostX = builderWorldXFromClient(clientX, canvas);
  }

  canvas.addEventListener('mousemove', function (e) {
    if (!builder.open) { return; }
    ghostAt(e);
  });

  canvas.addEventListener('touchmove', function (e) {
    if (!builder.open) { return; }
    ghostAt(e);
  }, { passive: true });

  function act(e) {
    if (!builder.open) { return; }
    var clientX = (e.changedTouches && e.changedTouches.length)
      ? e.changedTouches[0].clientX : e.clientX;
    var wx = builderWorldXFromClient(clientX, canvas);
    builder.ghostX = wx;

    /* moving something that is already on the surface comes first */
    if (builder.moving) {
      builderMove(builder.moving, wx);
      builder.moving = null;
      return;
    }

    var hit = builderStructureAt(wx);
    if (hit) { builderSelect(hit.uid); return; }

    if (builder.armed) { builderPlace(builder.armed, wx); }
  }

  canvas.addEventListener('click', act);
  canvas.addEventListener('touchend', function (e) { e.preventDefault(); act(e); },
                          { passive: false });

  /* right click cancels, rather than opening the browser menu */
  canvas.addEventListener('contextmenu', function (e) {
    if (!builder.open) { return; }
    e.preventDefault();
    builder.moving = null;
    builderCancel();
  });

  document.addEventListener('keydown', function (e) {
    if (!builder.open) { return; }

    if (e.code === 'Escape') {
      builder.moving = null;
      builderCancel();
      return;
    }

    /* typing in a field must not trigger the builder shortcuts */
    var tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') { return; }

    if (e.key === 'x' || e.key === 'X' || e.code === 'Delete' || e.code === 'Backspace') {
      if (builder.selected) {
        e.preventDefault();
        builderRemove(builder.selected);
      }
      return;
    }

    /* Enter confirms the mission, but only when the base is ready */
    if (e.code === 'Enter' && !(e.target && e.target.closest && e.target.closest('.build-bar'))) {
      if (builderReady()) {
        e.preventDefault();
        builderLaunch();
      }
    }
  });
}