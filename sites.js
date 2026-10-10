/* ============================================================
   LANDING SITES
   ------------------------------------------------------------
   The data behind the Moon map. Pure data and helpers only: this
   file touches no DOM and knows nothing about screens, so the map
   and the rules file can both read it safely.

   READ THIS BEFORE CHANGING ANY NUMBER
   ------------------------------------
   Each site carries two different kinds of information and they are
   never mixed together:

     facts[]  - REAL SCIENCE. Published, established statements about
                a real place on the Moon. Safe to state as fact.

     the rest - GAME ESTIMATE. Every percentage, difficulty rating
                and cargo budget below was invented for this game so
                the trade-offs are teachable. None of it is a NASA
                measurement, a mission-planning figure, or a claim
                about what a real base would find.

   `lat` and `lon` are real coordinates and are used to place the
   marker on the map with a polar stereographic projection centred on
   the south pole. `sunlight`, `ice`, `dust`, `heat`, `difficulty`,
   `powerBonus` and `cargo` are all GAME ESTIMATES.

   Latitude is negative (southern hemisphere) and longitude is degrees
   east of the prime meridian.
   ============================================================ */

var ZONES = [
  {
    id: 'cabeus-b',
    name: 'Cabeus B Floor',
    coords: '85.6°S, 50°W',
    lat: -85.6,
    lon: -50,

    /* ---- GAME ESTIMATE ---- */
    difficulty: 5,
    sunlight: 0.02,
    powerBonus: 0.15,
    ice: 1.0,
    dust: 0.25,
    heat: 0.95,
    cargo: 108,

    terrain: 'Flat crater floor, permanently in shadow',
    summary: 'The floor of a permanently shadowed crater. It never sees the Sun, ' +
             'but it is also the single most interesting place on the Moon for ' +
             'water, and a cargo ship can barely get down here.',
    pros: [
      'Best water-ice prospect on the whole Moon',
      'Flat, level ground for a base',
      'Cold enough to keep ice from boiling away'
    ],
    cons: [
      'Almost no sunlight, so solar power barely works',
      'The hardest landing on the Moon',
      'Brutally cold, which costs power to survive'
    ],

    /* ---- REAL SCIENCE ---- */
    facts: [
      'NASA\'s LCROSS mission deliberately crashed into this crater on 9 October 2009, ' +
      'and the debris it threw up contained water. That was the first direct evidence ' +
      'that water ice survives at the lunar south pole.',
      'Because the Moon is tidally locked, the Sun stays close to the horizon all day. ' +
      'Deep inside a crater like this the rim blocks it completely, so the floor stays in ' +
      'permanent shadow.',
      'In permanent shadow the surface can fall below -170 °C, and some measured ' +
      'spots are colder still.'
    ]
  },

  {
    id: 'shackleton',
    name: 'Shackleton Rim',
    coords: '89.9°S, 15°W',
    lat: -89.9,
    lon: -15,

    /* ---- GAME ESTIMATE ---- */
    difficulty: 4,
    sunlight: 0.88,
    powerBonus: 1.25,
    ice: 0.75,
    dust: 0.5,
    heat: 0.7,
    cargo: 115,

    terrain: 'High crater rim, steep inner slope',
    summary: 'The highest-latitude terrain on the Moon. Its slopes catch sunlight ' +
             'almost continuously, which makes it the best place to put solar panels, ' +
             'but the ground is steep and the shadows beside it are absolute.',
    pros: [
      'Nearly continuous sunlight for solar power',
      'Water ice is likely close by, in the shadowed floor',
      'Very high latitude means a long, dark winter'
    ],
    cons: [
      'Steep slopes make landing and building awkward',
      'Half the mission is still spent in darkness',
      'Little room flat enough for a whole base'
    ],

    /* ---- REAL SCIENCE ---- */
    facts: [
      'Shackleton crater is about 21 km across and about 4 km deep. Its rim stands ' +
      'higher than almost anywhere else on the Moon.',
      'Ridge tops and crater rims near the poles can stay lit for more than 85% of the ' +
      'lunar cycle. Scientists call these "peaks of near-continuous light".',
      'At the poles the Sun circles the horizon at a steady height, so a site gets roughly ' +
      'two weeks of sunlight followed by roughly two weeks of darkness, rather than the ' +
      'single long day and night seen lower down.'
    ]
  },

  {
    id: 'tycho',
    name: 'Tycho Crater',
    coords: '43.3°S, 11°W',
    lat: -43.3,
    lon: -11,

    /* ---- GAME ESTIMATE ---- */
    difficulty: 4,
    sunlight: 0.5,
    powerBonus: 1.0,
    ice: 0.15,
    dust: 0.85,
    heat: 0.8,
    cargo: 115,

    terrain: 'Young rugged crater, steep walls and central peak',
    summary: 'A huge, young crater with everything young craters have: rough ground, ' +
             'bright rays of ejecta, and far more dust than anywhere else. It is the ' +
             'most dramatic site and the dustiest.',
    pros: [
      'Huge, easy-to-recognise landmark for navigation',
      'Fresh young terrain is scientifically interesting to explore',
      'A regular day and night cycle of about 29.5 Earth days'
    ],
    cons: [
      'The dustiest site on the map, and dust ruins seals and solar panels',
      'Rough, steep ground all around the rim',
      'No water ice anywhere near the surface here'
    ],

    /* ---- REAL SCIENCE ---- */
    facts: [
      'Tycho is about 85 km wide and about 4 km deep, and it is young - it has far ' +
      'fewer craters inside it than the surface around it.',
      'Sharp lunar dust is jagged, clingy and electrostatically charged. It gets into ' +
      'seals, scratches equipment and is one of the hardest problems for any lunar base.',
      'Low on the Moon\'s rim of the polar regions, the Sun rises and sets each cycle, ' +
      'giving roughly half a cycle of daylight and half of darkness.'
    ]
  },

  {
    id: 'haworth',
    name: 'Haworth Crater',
    coords: '81.6°S, 90°W',
    lat: -81.6,
    lon: -90,

    /* ---- GAME ESTIMATE ---- */
    difficulty: 3,
    sunlight: 0.4,
    powerBonus: 1.05,
    ice: 0.7,
    dust: 0.45,
    heat: 0.75,
    cargo: 128,

    terrain: 'Ejecta blanket with shadowed hollows',
    summary: 'A middle-of-the-road polar site that still has a serious water story. ' +
             'The Sun stays low but gets over the rim for most of the cycle, and the ' +
             'shadowed hollows nearby hold ice.',
    pros: [
      'Water ice has been detected in the shadowed hollows here',
      'Flat ground outside the crater, so there is room to build',
      'A fairer balance of light and dark than the deepest sites'
    ],
    cons: [
      'Low Sun means long, weak power days',
      'Rough ejecta around the rim',
      'Still a long, dark winter'
    ],

    /* ---- REAL SCIENCE ---- */
    facts: [
      'Orbital instruments such as NASA\'s Moon Mineralogy Mapper have detected water ice ' +
      'in permanently shadowed areas at the lunar south pole, in craters including Haworth.',
      'Ice matters because it is the one resource a lunar base could harvest on the Moon ' +
      'itself instead of shipping everything from Earth.',
      'The near-polar Sun stays low in the sky all day, so shadows are long and surface ' +
      'temperatures swing far more than they would at the equator.'
    ]
  },

  {
    id: 'nobile',
    name: 'Nobile Crater',
    coords: '85.2°S, 30°E',
    lat: -85.2,
    lon: 30,

    /* ---- GAME ESTIMATE ---- */
    difficulty: 1,
    sunlight: 0.55,
    powerBonus: 1.1,
    ice: 0.35,
    dust: 0.3,
    heat: 0.6,
    cargo: 150,

    terrain: 'Smooth resurfaced floor, few craters',
    summary: 'The easiest site on the map. The floor here is unusually smooth and ' +
             'un-cratered for such a high latitude, which makes it a safe, practical ' +
             'place to put a first base.',
    pros: [
      'Smooth, level ground, the easiest landing here',
      'Good sunlight for solar power',
      'Not much dust to fill up the filters',
      'Plenty of cargo allowed, so a base can be well equipped'
    ],
    cons: [
      'Less sunlight than a rim site, and no water ice nearby',
      'Nothing unusual to explore, so fewer science bonuses',
      'Still a two-week night every cycle'
    ],

    /* ---- REAL SCIENCE ---- */
    facts: [
      'Nobile is about 50 km across. Parts of its interior are unusually smooth and ' +
      'carry far fewer craters than the surrounding surface.',
      'That kind of unexpectedly young terrain is called "resurfaced", and it is ' +
      'something the Apollo astronauts were specifically asked to photograph and sample.',
      'Smooth, even ground is exactly what a landing site needs, which is why real ' +
      'mission planners look for it.'
    ]
  },

  {
    id: 'sylvester',
    name: 'Sylvester N',
    coords: '81.7°S, 55°E',
    lat: -81.7,
    lon: 55,

    /* ---- GAME ESTIMATE ---- */
    difficulty: 2,
    sunlight: 0.62,
    powerBonus: 1.15,
    ice: 0.5,
    dust: 0.55,
    heat: 0.65,
    cargo: 128,

    terrain: 'Broad flat crater floor with small hills',
    summary: 'A wide, open polar crater floor. More room than anywhere else on the map, ' +
             'with decent sunlight and ice within reach, so it is a fair middle choice ' +
             'rather than a clear win.',
    pros: [
      'A lot of flat ground to build on',
      'Decent sunlight compared with the other polar sites',
      'Reasonable water-ice prospect'
    ],
    cons: [
      'Nothing here is outstandingly good at anything',
      'The surface is littered with small hills and boulders',
      'Moderate dust and a long dark winter'
    ],

    /* ---- REAL SCIENCE ---- */
    facts: [
      'Sylvester N is one of the larger craters in the lunar south polar region.',
      'At high southern latitude the low Sun means surface temperatures swing violently ' +
      'between day and night, which is a real engineering problem for any base.',
      'Several south polar craters of this size are known to contain permanently shadowed ' +
      'areas where ice has been detected.'
    ]
  }
];

/* ------------------------------------------------------------
   LOOKUPS AND DEFAULTS
   ------------------------------------------------------------ */

/* id -> zone, so a saved id can be resolved without walking the list. */
var ZONE_INDEX = {};
for (var zi = 0; zi < ZONES.length; zi++) {
  ZONE_INDEX[ZONES[zi].id] = ZONES[zi];
}

function zoneById(id) {
  return (id && ZONE_INDEX[id]) ? ZONE_INDEX[id] : null;
}

/* What a mission with no landing site chosen should use. Every
   multiplier here is neutral (1 or 0), so an unchosen site changes
   nothing about how the game plays. */
var NEUTRAL_ZONE_MODS = {
  sunlight: 1,
  powerBonus: 1,
  ice: 0,
  dust: 0.5,
  heat: 0.5,
  cargo: 150
};

function zoneModsFor(zone) {
  if (!zone) {
    return {
      sunlight: NEUTRAL_ZONE_MODS.sunlight,
      powerBonus: NEUTRAL_ZONE_MODS.powerBonus,
      ice: NEUTRAL_ZONE_MODS.ice,
      dust: NEUTRAL_ZONE_MODS.dust,
      heat: NEUTRAL_ZONE_MODS.heat,
      cargo: NEUTRAL_ZONE_MODS.cargo
    };
  }
  return {
    sunlight: zone.sunlight,
    powerBonus: zone.powerBonus,
    ice: zone.ice,
    dust: zone.dust,
    heat: zone.heat,
    cargo: zone.cargo
  };
}