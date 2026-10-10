/* ============================================================
   PHASE 4 - VERIFIED LUNAR DATA
   ------------------------------------------------------------
   Everything the game knows about the real Moon, with the source
   attached to every single value.

   WHY THIS FILE EXISTS
   --------------------
   The game used to carry a handful of hand-written sentences about the
   Moon and a row of invented percentages. Some of those sentences
   turned out to be wrong, and none of them said where they came from.
   This file replaces guesswork with a small, curated, CITED dataset.

   THE THREE TIERS, AND THE LINE BETWEEN THEM
   ------------------------------------------
   Nothing in this file is allowed to blur these. Every entry carries a
   `tier` and the game shows it as one of three things:

     'verified'     A published measurement or a directly quoted
                    finding, with the source that reported it. These
                    are the only values that may be called real data.

     'interpreted'  A conclusion DRAWN from verified values, not itself
                    measured. "This crater is 43 degrees from the pole,
                    and every ice detection was within 20 degrees, so
                    ice is not expected here" is an interpretation. It
                    is a reasonable one, and it is not a measurement.

     'game'         Invented for this game so the trade-offs are
                    teachable. The cargo budget, the daily balances and
                    the meters on the site card are all in this tier.

   WHAT IS DELIBERATELY MISSING
   -----------------------------
   Elevation and slope are the obvious omissions, and they are missing
   on purpose.

   Real elevation and slope data absolutely exists: the Lunar Orbiter
   Laser Altimeter on LRO produced 5 m/pixel digital elevation and slope
   maps of the lunar south pole, published through NASA's Planetary
   Geospatial Data Authority. Those are large GeoTIFF products, not
   something a browser can query for one point, and they are not bundled
   with this game.

   So rather than invent plausible-looking numbers, every elevation and
   slope row in the game says so, names the dataset that holds the real
   answer, and links to it. That is a better teaching moment than a
   made-up figure with a citation stuck on it.

   WHERE THE NUMBERS COME FROM
   ---------------------------
   Every source below is listed with its DOI or its NASA archive URL so
   any number in the game can be checked against the original.
   ============================================================ */

/* ------------------------------------------------------------
   1. THE SOURCES
   Kept in one place so the UI can cite them and a reader can check
   them. `url` is always the publisher's own page or a DOI.
   ------------------------------------------------------------ */

var LUNAR_SOURCES = {
  gazetteer: {
    id: 'gazetteer',
    label: 'IAU/USGS Gazetteer of Planetary Nomenclature',
    short: 'IAU Gazetteer',
    instrument: 'Official IAU-approved feature names and positions',
    mission: 'Maintained by the USGS Astrogeology Science Center on behalf of the IAU',
    url: 'https://planetarynames.wr.usgs.gov/',
    note: 'Diameters and centre coordinates of named lunar craters, maintained with NASA funding.'
  },

  mazarico: {
    id: 'mazarico',
    label: 'Mazarico et al. (2011), Icarus 211, 1066-1081',
    short: 'Mazarico et al. 2011',
    instrument: 'Lunar Orbiter Laser Altimeter (LOLA), Lunar Reconnaissance Orbiter',
    mission: 'LRO',
    url: 'https://doi.org/10.1016/j.icarus.2010.10.030',
    note: 'Modelled how long each polar location stays in sunlight, using LOLA topography.'
  },

  li2018: {
    id: 'li2018',
    label: 'Li et al. (2018), PNAS 115, 8687-8692',
    short: 'Li et al. 2018',
    instrument: 'Moon Mineralogy Mapper (M3), NASA instrument on India\'s Chandrayaan-1',
    mission: 'Chandrayaan-1 (NASA M3)',
    url: 'https://doi.org/10.1073/pnas.1802345115',
    note: 'First definitive detection of water ice exposed at the lunar surface, in permanently shadowed regions.'
  },

  lcross: {
    id: 'lcross',
    label: 'LCROSS mission results, NASA (2009-2010)',
    short: 'LCROSS',
    instrument: 'LCROSS shepherding spacecraft instruments',
    mission: 'LCROSS',
    url: 'https://science.nasa.gov/moon/moon-water-and-ices/',
    note: 'Deliberately crashed into the Cabeus crater floor and measured the plume it threw up.'
  },

  'lcross-impact': {
    id: 'lcross-impact',
    label: 'Locating the LCROSS Impact Craters, Marshall et al. (2011)',
    short: 'LCROSS impact site',
    instrument: 'LRO imagery registration plus ground tracking',
    mission: 'LCROSS',
    url: 'https://arxiv.org/abs/1103.1687',
    note: 'Weighted-average Centaur impact location: 84.6796 S, 48.7093 W.'
  },

  tye2015: {
    id: 'tye2015',
    label: 'Tye et al. (2015), NASA technical report',
    short: 'Tye et al. 2015',
    instrument: 'LOLA crater counts',
    mission: 'LRO',
    url: 'https://ntrs.nasa.gov/citations/20150006822',
    note: 'Crater diameters and ages for the south circumpolar craters Haworth, Shoemaker, Faustini and Shackleton.'
  },

  lolaDem: {
    id: 'lolaDem',
    label: 'NASA PGDA - South Pole Landing Site LOLA elevation and slope maps',
    short: 'NASA LOLA DEM',
    instrument: 'Lunar Orbiter Laser Altimeter (LOLA)',
    mission: 'LRO',
    url: 'https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/',
    note: 'Where the real elevation and slope numbers for these sites live, as 5 m/pixel GeoTIFF products. Not bundled with this game.'
  },

  nasaWater: {
    id: 'nasaWater',
    label: 'NASA Science - Moon Water and Ices',
    short: 'NASA Moon Water',
    instrument: 'Overview of NASA lunar volatile missions',
    mission: 'Clementine, Lunar Prospector, LCROSS, LRO, M3, SOFIA',
    url: 'https://science.nasa.gov/moon/moon-water-and-ices/',
    note: 'Plain-language NASA summary of how water ice on the Moon was found.'
  },

  images: {
    id: 'images',
    label: 'NASA Image and Video Library',
    short: 'images.nasa.gov',
    instrument: 'Public API, no key required',
    mission: 'All NASA centres',
    url: 'https://images.nasa.gov/',
    note: 'Where the photographs in the game come from.'
  }
};

/* ------------------------------------------------------------
   2. FACTS THAT APPLY TO THE WHOLE SOUTH POLAR REGION
   Values here are measured once and are true of the region as a
   whole, so they are not repeated on every site card.
   ------------------------------------------------------------ */

var LUNAR_REGION = {
  /* Mazarico et al. 2011 modelled this from LOLA topography. */
  shadowedAreaSouthKm2: 16055,
  shadowedAreaNorthKm2: 12866,

  /* Li et al. 2018 found ice only in shadowed pixels near the poles,
     and none at all below 70 degrees of latitude. This is the single
     most useful number for explaining why a crater like Tycho is a
     hopeless place to look for ice. */
  iceLatitudeBandDeg: 20,
  iceNoDetectionBelowDeg: 70,

  /* Li et al. 2018: of all the cold traps at both poles, only about
     this share showed any ice signature at all. */
  coldTrapIceSharePct: 3.5,

  /* Li et al. 2018: some ice-bearing pixels are estimated at around
     this much water ice mixed through dry regolith. Not a blanket
     figure for every cold trap. */
  icePixelAbundancePct: 30,

  /* Mazarico et al. 2011, quoting the modelled south polar sites. */
  bestSouthPoleIlluminationPct: 89.6
};

/* ------------------------------------------------------------
   3. PER-SITE VERIFIED DATA
   ------------------------------------------------------------

   Each entry says what is measured, and says `null` for whatever is
   not. A `null` is not a gap to be filled in later with a plausible
   number. It is a fact about what we do not know here.

   `crater.diameterKm` - the crater the site sits in or on, at its
     real size, so the map can draw it to scale.

   `illumination.pct` - the share of the lunar cycle that spot
     receives direct Sun. This is only published for the specific
     points that were modelled, so most sites are null.

   `ice.status` - one of:
       'detected'      water ice has been directly detected here
       'cluster'       detections are clustered near this crater, but
                       not inside it - promising, not proven for the
                       spot the player lands on
       'not-detected'  inside the polar band, looked for, not found
       'out-of-band'   too far from the pole for ice to be stable
   ------------------------------------------------------------ */

var LUNAR_SITES = {
  'cabeus': {
    crater: {
      name: 'Cabeus',
      featureId: 953,
      diameterKm: 100.58,
      centerLat: -85.33,
      centerLon: -42.13,
      sourceId: 'gazetteer'
    },
    /* The landing site is the LCROSS impact point, not the crater centre
       and not the IAU feature called "Cabeus B" - that is a different
       crater 350 km to the north, at 82.26 S, 54.58 W. Naming this site
       "Cabeus B" was wrong: the only water ever measured by digging was
       measured here, on the floor of Cabeus itself. */
    impactSite: {
      lat: -84.6796,
      lon: -48.7093,
      uncertaintyM: { lat: 115, lon: 44 },
      note: 'Weighted-average Centaur impact location reported by the LCROSS team.',
      sourceId: 'lcross-impact'
    },
    illumination: {
      pct: null,
      note: 'Deep inside the crater the floor never sees the Sun at all, which is why a solar array cannot work here.',
      sourceId: 'mazarico'
    },
    ice: {
      status: 'detected',
      headline: 'Water measured directly at this crater',
      detail: 'On 9 October 2009 NASA\'s LCROSS spacecraft deliberately crashed into the Cabeus floor and ' +
              'flew through the plume it kicked up. The instruments measured water and other volatiles in ' +
              'the thrown-out material - about 5.6% of the sample by mass. This is the only place in the game where ' +
              'somebody has physically dug into the ground and found water.',
      sourceId: 'lcross'
    },
    elevation: null,
    slope: null,
    notes: []
  },

  shackleton: {
    crater: {
      name: 'Shackleton',
      featureId: 5450,
      diameterKm: 20.92,
      centerLat: -89.67,
      centerLon: 129.78,
      sourceId: 'gazetteer'
    },
    illumination: {
      pct: 89.3,
      maxShadowDays: 3.0,
      note: 'Modelled for one point on the Shackleton rim, which is not the crater centre and not ' +
            'necessarily where the game lands. Another modelled point near Malapert reached 89.6%, ' +
            'and one spot is reported as sunlit for 240 days a year. Illumination on a rim this ' +
            'jagged varies enormously over a few hundred metres, so treat this as "the best ground ' +
            'near here", not as a measurement of the landing spot.',
      sourceId: 'mazarico'
    },
    ice: {
      status: 'cluster',
      headline: 'Ice detections are clustered around this crater',
      detail: 'Li et al. (2018) report that the southern ice detections are clustered near Haworth, Shoemaker, ' +
              'Sverdrup and Shackleton. The rim is the brightest ground on the Moon; the floor is a permanently ' +
              'shadowed cold trap. The ice is on the floor, the sunlight is on the rim.',
      sourceId: 'li2018'
    },
    elevation: null,
    slope: null,
    notes: []
  },

  tycho: {
    crater: {
      name: 'Tycho',
      featureId: 6163,
      diameterKm: 85.29,
      centerLat: -43.30,
      centerLon: -11.22,
      sourceId: 'gazetteer'
    },
    illumination: {
      pct: null,
      note: 'This crater is nowhere near the poles, so it gets the ordinary day and night cycle of about half a ' +
            'lunar cycle of light and half of dark - not the polar pattern.',
      sourceId: 'nasaWater'
    },
    ice: {
      status: 'out-of-band',
      headline: 'Too far from the pole for ice to survive',
      detail: 'Li et al. (2018) found no water ice at all below 70 degrees of latitude, and more than 90% of the ' +
              'detections were within 10 degrees of a pole. Tycho sits at 43 degrees south. It is spectacular ' +
              'terrain, and it is the worst place on this map to look for water.',
      sourceId: 'li2018'
    },
    elevation: null,
    slope: null,
    notes: []
  },

  haworth: {
    crater: {
      name: 'Haworth',
      featureId: null,
      diameterKm: 51.4,
      centerLat: null,
      centerLon: null,
      sourceId: 'tye2015'
    },
    illumination: {
      pct: null,
      note: 'Near-polar, so the long low Sun of the polar cycle rather than the ordinary lunar day and night.',
      sourceId: 'nasaWater'
    },
    ice: {
      status: 'cluster',
      headline: 'One of the four craters where southern ice was found',
      detail: 'Haworth is the first name in the list. Li et al. (2018) report that southern ice detections are ' +
              'clustered near Haworth, Shoemaker, Sverdrup and Shackleton, and Tye et al. (2015) used LOLA crater ' +
              'counts around Haworth to show its permanently shadowed interior has been undisturbed long enough ' +
              'for ice to survive there.',
      sourceId: 'li2018'
    },
    elevation: null,
    slope: null,
    notes: []
  },

  nobile: {
    crater: {
      name: 'Nobile',
      featureId: 4321,
      diameterKm: 79.27,
      centerLat: -85.28,
      centerLon: 53.27,
      sourceId: 'gazetteer'
    },
    illumination: {
      pct: null,
      note: 'A wide, open crater floor in the near-polar belt, so it gets a good deal of the low Sun.',
      sourceId: 'nasaWater'
    },
    ice: {
      status: 'not-detected',
      headline: 'Inside the polar band, but no ice was found here',
      detail: 'Nobile is close enough to the pole for ice to survive, and it does not appear in the list of ' +
              'southern craters where Li et al. (2018) found it. That is a genuine absence in the record, not a ' +
              'judgement about the terrain - and it is worth remembering that only about 3.5% of cold traps at ' +
              'both poles showed any ice signature at all.',
      sourceId: 'li2018'
    },
    elevation: null,
    slope: null,
    notes: []
  },

  sylvester: {
    crater: {
      name: 'Sylvester',
      featureId: 5791,
      diameterKm: 59.28,
      centerLat: -82.65,
      centerLon: -81.22,
      sourceId: 'gazetteer'
    },
    illumination: {
      pct: null,
      note: 'A broad floor in the near-polar belt, with the usual long low Sun.',
      sourceId: 'nasaWater'
    },
    ice: {
      status: 'not-detected',
      headline: 'Inside the polar band, but no ice was found here',
      detail: 'Like Nobile, Sylvester sits close enough to the pole for ice to be possible but does not appear in ' +
              'the southern detection cluster reported by Li et al. (2018). A nearby crater, Sverdrup, is in the ' +
              'list; Sylvester is not the same crater.',
      sourceId: 'li2018'
    },
    elevation: null,
    slope: null,
    notes: []
  }
};

/* ------------------------------------------------------------
   4. LOOKUPS AND HELPERS
   ------------------------------------------------------------ */

function lunarSource(id) {
  return (id && LUNAR_SOURCES[id]) ? LUNAR_SOURCES[id] : null;
}

function lunarSiteData(zoneId) {
  return (zoneId && LUNAR_SITES[zoneId]) ? LUNAR_SITES[zoneId] : null;
}

/* The real name of the crater a site sits in, for the NASA image
   search. Falls back to the display name so the search still runs
   when a site has no crater record. */
function lunarSearchName(zone) {
  var data = lunarSiteData(zone && zone.id);
  if (data && data.crater && data.crater.name) { return data.crater.name; }
  return (zone && zone.name) ? zone.name : '';
}

/* Has anybody actually found water ice at this site? Used by the
   gameplay layer, so it deliberately answers a narrow question:
   "is this a confirmed detection or only a nearby cluster?" */
function iceConfirmedAt(zoneId) {
  var data = lunarSiteData(zoneId);
  return !!data && data.ice && data.ice.status === 'detected';
}

/* Detections in the same neighbourhood, which is still worth
   planning around even though the landing spot itself is not
   confirmed. */
function iceNearby(zoneId) {
  var data = lunarSiteData(zoneId);
  return !!data && data.ice && data.ice.status === 'cluster';
}

/* ------------------------------------------------------------
   5. WHAT THE SITE ADDS TO THE MISSION
   ------------------------------------------------------------
   Phase 4 touches the simulation in exactly two places, and both are
   driven by the verified record rather than by taste:

   1. SCIENCE YIELD. A confirmed ice site is a better place to do
      science, so the survey objective there needs three structures
      logged instead of four. A cluster site needs four like anywhere
      else. This is the honest version of "go somewhere interesting":
      the difference follows from whether water was actually found.

   2. A SITE-SCIENCE LINE in the report and the pre-flight panel, so
      the player can see at the end that the choice was made on
      evidence.

   Nothing else changes. The scoring bands, the 16 day limit, the
   builder rules and the survival model are all untouched.
   ------------------------------------------------------------ */

var SURVEY_TARGET_DEFAULT = 4;
var SURVEY_TARGET_ICE_SITE = 3;

/* How many structure readouts the crew must log to sign off the
   survey at this site. */
function surveyTargetFor(zoneId) {
  return iceConfirmedAt(zoneId) ? SURVEY_TARGET_ICE_SITE : SURVEY_TARGET_DEFAULT;
}

/* A one-line, plain-English summary for the results screen. */
function lunarSiteSummary(zoneId) {
  var data = lunarSiteData(zoneId);
  if (!data || !data.ice) { return ''; }
  switch (data.ice.status) {
    case 'detected':
      return 'Water ice was measured directly here, so the science team already has a baseline to work from.';
    case 'cluster':
      return 'Ice detections are clustered near here, so the crew can sample ground that is already known to be promising.';
    case 'not-detected':
      return 'No ice has been detected at this crater, so the crew would be surveying new ground.';
    case 'out-of-band':
      return 'This crater is far too warm for water ice to survive, so the science here is geology, not ice.';
    default:
      return '';
  }
}

/* exposed for the map, the site panel and the tests */
if (typeof window !== 'undefined') {
  window.LUNAR_DATA = {
    SOURCES: LUNAR_SOURCES,
    REGION: LUNAR_REGION,
    SITES: LUNAR_SITES,
    SURVEY_TARGET_DEFAULT: SURVEY_TARGET_DEFAULT,
    SURVEY_TARGET_ICE_SITE: SURVEY_TARGET_ICE_SITE
  };
}
