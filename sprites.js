/* ============================================================
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
   CELL is 96 pixels.
   ============================================================ */

var SPRITE_CELL = 96;
var SPRITE_COLS = 8;
var SPRITE_SHEET_W = 768;
var SPRITE_SHEET_H = 384;

var SPRITE_MAP = {
  "idle_0": { x: 0, y: 0, w: 96, h: 96 },
  "idle_1": { x: 96, y: 0, w: 96, h: 96 },
  "idle_2": { x: 192, y: 0, w: 96, h: 96 },
  "idle_3": { x: 288, y: 0, w: 96, h: 96 },
  "jump_fall": { x: 480, y: 96, w: 96, h: 96 },
  "jump_rise": { x: 384, y: 96, w: 96, h: 96 },
  "land_0": { x: 576, y: 96, w: 96, h: 96 },
  "land_1": { x: 672, y: 96, w: 96, h: 96 },
  "station_console": { x: 384, y: 288, w: 96, h: 96 },
  "station_depot": { x: 480, y: 288, w: 96, h: 96 },
  "station_food": { x: 96, y: 288, w: 96, h: 96 },
  "station_habitat": { x: 576, y: 192, w: 96, h: 96 },
  "station_oxygen": { x: 672, y: 192, w: 96, h: 96 },
  "station_solar_bad": { x: 288, y: 288, w: 96, h: 96 },
  "station_solar_ok": { x: 192, y: 288, w: 96, h: 96 },
  "station_water": { x: 0, y: 288, w: 96, h: 96 },
  "walk_0": { x: 384, y: 0, w: 96, h: 96 },
  "walk_1": { x: 480, y: 0, w: 96, h: 96 },
  "walk_2": { x: 576, y: 0, w: 96, h: 96 },
  "walk_3": { x: 672, y: 0, w: 96, h: 96 },
  "walk_4": { x: 0, y: 96, w: 96, h: 96 },
  "walk_5": { x: 96, y: 96, w: 96, h: 96 },
  "walk_6": { x: 192, y: 96, w: 96, h: 96 },
  "walk_7": { x: 288, y: 96, w: 96, h: 96 },
  "wave_0": { x: 384, y: 192, w: 96, h: 96 },
  "wave_1": { x: 480, y: 192, w: 96, h: 96 },
  "work_0": { x: 0, y: 192, w: 96, h: 96 },
  "work_1": { x: 96, y: 192, w: 96, h: 96 },
  "work_2": { x: 192, y: 192, w: 96, h: 96 },
  "work_3": { x: 288, y: 192, w: 96, h: 96 }
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
