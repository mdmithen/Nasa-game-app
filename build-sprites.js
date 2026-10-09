/* Runs tools/make-sprites.html in headless Chrome and saves
   the generated sprite sheet to assets/sprites.png
   plus the frame map to sprites.js.
   Development tool - not part of the game itself. */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT = 'D:/code/junior-astronaut-mission-trainer';
const OUT = 'C:/Users/MDSADM~1/AppData/Local/Temp/opencode/shots';
const PORT = 9355;
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox',
    '--no-first-run', '--hide-scrollbars', '--force-color-profile=srgb',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + OUT + '/sprite-profile',
    'about:blank'], { stdio: 'ignore' });

  let targets = null;
  for (let i = 0; i < 40; i++) {
    try {
      targets = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
      if (targets.some(t => t.type === 'page')) break;
    } catch (e) {}
    await sleep(250);
  }

  const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; });

  let id = 0; const pending = new Map(); const errors = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
    } else if (m.method === 'Runtime.exceptionThrown') {
      errors.push(m.params.exceptionDetails.text);
    }
  };
  const send = (method, params) => new Promise((resolve, reject) => {
    const n = ++id; pending.set(n, { resolve, reject });
    ws.send(JSON.stringify({ id: n, method, params: params || {} }));
  });
  const evaluate = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception ? r.exceptionDetails.exception.description : 'eval failed');
    return r.result.value;
  };

  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: 'file:///' + ROOT + '/tools/make-sprites.html' });
  await sleep(2000);

  const built = await evaluate('JSON.stringify(window.buildSheet())');
  const sheet = JSON.parse(built);

  console.log('frames : ' + sheet.count);
  console.log('sheet  : ' + sheet.width + 'x' + sheet.height + '  cell ' + sheet.cell);
  console.log('names  : ' + Object.keys(sheet.map).join(', '));

  if (errors.length) { console.log('PAGE ERRORS: ' + errors.join(' | ')); }

  /* --- save the PNG --- */
  fs.mkdirSync(ROOT + '/assets', { recursive: true });
  const base64 = sheet.dataUrl.split(',')[1];
  const pngPath = ROOT + '/assets/sprites.png';
  fs.writeFileSync(pngPath, Buffer.from(base64, 'base64'));
  console.log('wrote ' + pngPath + ' (' + Math.round(fs.statSync(pngPath).size / 1024) + ' KB)');

  /* --- save the frame map as sprites.js --- */
  const entries = Object.keys(sheet.map).sort().map(k => {
    const f = sheet.map[k];
    return "  " + JSON.stringify(k) + ": { x: " + f.x + ", y: " + f.y + ', w: ' + f.w + ', h: ' + f.h + ' }';
  });

  const js =
`/* ============================================================
   SPRITE FRAME MAP  -  GENERATED FILE, DO NOT EDIT BY HAND
   ------------------------------------------------------------
   This file is written automatically by:
       tools/make-sprites.html   (draws the artwork)
       build-sprites.js          (saves the PNG + this map)

   To change a sprite:
     1. edit the drawing code in tools/make-sprites.html
     2. run:  node build-sprites.js
   That regenerates assets/sprites.png and this file together,
   so the numbers can never drift apart.

   Each frame is a CELL x CELL square cut out of sprites.png.
   CELL is ${sheet.cell} pixels.
   ============================================================ */

var SPRITE_CELL = ${sheet.cell};
var SPRITE_COLS = ${sheet.cols};
var SPRITE_SHEET_W = ${sheet.width};
var SPRITE_SHEET_H = ${sheet.height};

var SPRITE_MAP = {
${entries.join(',\n')}
};

/* Frames that make up each animation, in order. */
var SPRITE_ANIM = {
  idle:  ['idle_0', 'idle_1', 'idle_2', 'idle_3'],
  walk:  ['walk_0', 'walk_1', 'walk_2', 'walk_3', 'walk_4', 'walk_5', 'walk_6', 'walk_7'],
  work:  ['work_0', 'work_1', 'work_2', 'work_3'],
  wave:  ['wave_0', 'wave_1']
};

/* Single frames used by name. */
var SPRITE_SINGLE = {
  jumpRise: 'jump_rise',
  jumpFall: 'jump_fall',
  land:     'land_0',
  habitat:  'station_habitat',
  oxygen:   'station_oxygen',
  water:    'station_water',
  food:     'station_food',
  solarOk:  'station_solar_ok',
  solarBad: 'station_solar_bad',
  console:  'station_console',
  depot:    'station_depot'
};
`;

  fs.writeFileSync(ROOT + '/sprites.js', js, 'utf8');
  console.log('wrote ' + ROOT + '/sprites.js (' + Object.keys(sheet.map).length + ' frames)');

  ws.close(); chrome.kill();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.log('ERR ' + e.message); process.exit(1); });