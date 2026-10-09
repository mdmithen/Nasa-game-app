/* ============================================================
   Junior Astronaut Mission Trainer - game logic
   Plain JavaScript. No libraries. Open index.html and play.
   ============================================================ */

/* ------------------------------------------------------------
   SECTION 1: SETTINGS
   Every number here is a SIMPLE GAME VALUE chosen for teaching.
   They are not real NASA mission numbers.
   ------------------------------------------------------------ */

var MISSION_LENGTH_DAYS = 16;   // every station action costs one day
var MAX_VALUE = 100;            // every bar is scored 0 to 100
var STARTING_CREW = 3;

// How much the base uses every day, before crew-size scaling
var DAILY_OXYGEN_USE = 8;
var DAILY_WATER_USE  = 6;
var DAILY_FOOD_USE   = 5;
var DAILY_POWER_USE  = 14;   // power spent on lights, pumps, heating
var SOLAR_GENERATION = 22;   // power made by the solar panels on a clear day

// Levels below which the crew starts to get hurt
var LOW_OXYGEN_LEVEL = 25;
var LOW_WATER_LEVEL  = 15;
var LOW_FOOD_LEVEL   = 15;

/* ------------------------------------------------------------
   SECTION 2: RESOURCE LABELS
   ------------------------------------------------------------ */

/* `short` is the tiny label used on phone screens where there is
   not enough room for the full word. */
var RESOURCES = {
  oxygen: { name: 'Oxygen',      short: 'O2',   icon: '🫧', fill: 'fill-o2'  },
  water:  { name: 'Water',       short: 'H2O',  icon: '💧', fill: 'fill-water' },
  food:   { name: 'Food',        short: 'FOOD', icon: '🥗', fill: 'fill-food' },
  power:  { name: 'Electricity', short: 'PWR',  icon: '⚡', fill: 'fill-power' },
  health: { name: 'Crew Health', short: 'CREW', icon: '❤️', fill: 'fill-health' }
};

/* ------------------------------------------------------------
   SECTION 3: MISSION OBJECTIVES
   All six must be complete for the mission to be a success.
   ------------------------------------------------------------ */

var OBJECTIVES = [
  { id: 'obj-power',  text: 'Restore full solar power to the base' },
  { id: 'obj-water',  text: 'Restart the water recycling loop' },
  { id: 'obj-food',   text: 'Get the hydroponics bay producing again' },
  { id: 'obj-air',    text: 'Repair the CO2 scrubber' },
  { id: 'obj-storm',  text: 'Ride out the lunar dust storm safely' },
  { id: 'obj-return', text: 'Return the crew safely to Earth' }
];

/* ------------------------------------------------------------
   SECTION 4: THE MISSION EVENTS
   Each event has a story, two or three real choices, and the
   exact effect every choice has on the base.
   ------------------------------------------------------------ */

var EVENTS = {

  /* ---- DAY 2 : OBJECTIVE 1 ---- */
  solar: {
    kind: 'Equipment Failure',
    title: 'A Solar Panel Is Damaged',
    story: 'A micrometeorite struck Array B during the night. One panel is cracked and tilted, so it is producing much less electricity. The crew asks what you want to do.',
    options: [
      {
        label: 'Send two crew outside to re-align the panel',
        hint: 'Hard work, and the crew pays for it in stamina.',
        deltas: [
          { key: 'power',  amount: 18, note: 'Panel realigned, more output' },
          { key: 'health', amount: -7, note: 'Crew strain from a surface EVA' }
        ],
        mods: { solarFactor: 1 },
        completes: 'obj-power',
        tone: 'good',
        heading: 'Panel Realigned',
        story: 'The crew realigned Array B during the next sunlight. Output jumped back to full, but the astronauts came back tired and cold.',
        lesson: 'Fixing the real cause solves the problem for good, but the repair itself costs something.'
      },
      {
        label: 'Leave it. Save the electricity for the batteries',
        hint: 'Avoids a risky EVA, but the damage keeps costing you.',
        deltas: [
          { key: 'power', amount: 10, note: 'Charge the batteries now' }
        ],
        mods: { solarFactor: 0.4 },
        completes: 'obj-power',
        tone: 'bad',
        heading: 'Delay Accepted',
        story: 'The batteries absorbed the shortfall and the crew stayed safe inside. But the cracked panel still only produces about 40% of its normal power, and it will stay that way until somebody repairs it.',
        lesson: 'Postponing a repair does not remove the problem. It keeps draining your resources every single day.'
      },
      {
        label: 'Shut down the grow lights and pumps to save power',
        hint: 'Saves electricity, but food and water systems suffer.',
        deltas: [
          { key: 'power', amount: 14, note: 'Power saved' },
          { key: 'water', amount: -14, note: 'Water pumps switched off' },
          { key: 'food',  amount: -10, note: 'Grow lights switched off' }
        ],
        tone: 'warn',
        heading: 'Power Shedding',
        story: 'The base is inside its power budget, but the hydroponics pumps are off and half the food crop is wilting. You saved electricity today and paid for it in water and food.',
        lesson: 'Conservation can save one resource while quietly damaging another. Always ask what a system depends on.'
      }
    ]
  },

  /* ---- DAY 3 : optional ---- */
  supply: {
    kind: 'Logistics',
    title: 'A Supply Ship Is Delayed',
    story: 'The unmanned freight lander that was due today is running late. It is carrying the spare parts and the food resupply. You must decide how to handle the gap.',
    options: [
      {
        label: 'Open the reserve ration locker',
        hint: 'Uses stored food now, no long-term cost.',
        deltas: [
          { key: 'food',   amount: 16, note: 'Reserve rations opened' },
          { key: 'health', amount: -3, note: 'Rations are less varied' }
        ],
        tone: 'warn',
        heading: 'Rations Opened',
        story: 'The crew ate from the emergency locker. Nobody enjoyed it, but nobody went hungry either.',
        lesson: 'Small short-term costs are often better than a large problem later.'
      },
      {
        label: 'Cut water use to make the rations last',
        hint: 'Protects food, but dehydration hurts the crew.',
        deltas: [
          { key: 'food',   amount: 4, note: 'Small food saving' },
          { key: 'water',  amount: -12, note: 'Water rationing' },
          { key: 'health', amount: -6, note: 'Crew dehydrated' }
        ],
        tone: 'bad',
        heading: 'Rationing Water',
        story: 'The crew managed on less water, but headaches and dizziness have already started. Dehydration makes people slow and mistake-prone.',
        lesson: 'Water and health are linked. Saving water by ignoring the crew costs you more than it saves.'
      },
      {
        label: 'Do nothing. Wait for the ship.',
        hint: 'Costs a day of food, but wastes nothing else.',
        deltas: [
          { key: 'food', amount: -12, note: 'Waited for the shipment' }
        ],
        tone: 'warn',
        heading: 'Waiting Game',
        story: 'Nothing arrived, so the crew went without the extra rations. When the ship lands tomorrow it will deliver a bigger resupply.',
        lesson: 'Sometimes doing nothing is a legitimate choice. Understand the real cost before you pick it.'
      }
    ]
  },

  /* ---- DAY 4 : OBJECTIVE 2 ---- */
  water: {
    kind: 'Resource Crisis',
    title: 'The Water Supply Is Running Low',
    story: 'The recycler filter has clogged with fine lunar dust. Water is now dropping almost twice as fast as normal. Without a fix the crew will run dry in a few days.',
    options: [
      {
        label: 'Repair the recycler filter right now',
        hint: 'Costs power today, restores clean water forever.',
        deltas: [
          { key: 'water', amount: 22, note: 'Recycler back online' },
          { key: 'power', amount: -10, note: 'Repair used power' }
        ],
        mods: { waterRecovery: 12 },
        completes: 'obj-water',
        tone: 'good',
        heading: 'Recycling Restored',
        story: 'The crew replaced the filter and the loop is working again. From now on the base cleans and reuses water every day instead of losing it.',
        lesson: 'Water recycling is the difference between a base that can survive and one that cannot.'
      },
      {
        label: 'Use the emergency water tanks',
        hint: 'Big water gain right now, but the loop stays broken.',
        deltas: [
          { key: 'water',  amount: 26, note: 'Emergency tanks opened' },
          { key: 'food',   amount: -8, note: 'Less water for the crops' },
          { key: 'health', amount: -5, note: 'Stress of running on reserve' }
        ],
        tone: 'warn',
        heading: 'Drinking From Reserve',
        story: 'The emergency tanks topped everyone up. The recycler is still broken, so tomorrow will be exactly as bad as today.',
        lesson: 'Reserve supplies buy you time. They do not replace a repair.'
      },
      {
        label: 'Send the rover to dig the ice deposit',
        hint: 'The most water possible, but the rover uses a lot of power.',
        deltas: [
          { key: 'water', amount: 34, note: 'Ice collected by the rover' },
          { key: 'power', amount: -26, note: 'Rover drilling used power' }
        ],
        completes: 'obj-water',
        tone: 'warn',
        heading: 'Ice Harvest',
        story: 'The rover reached the shadowed crater and returned with a load of ice. It is a lot of water, but it drained the batteries badly.',
        lesson: 'Lunar ice is a real resource. In this game it works, but it is expensive in electricity.'
      }
    ]
  },

  /* ---- DAY 5 : optional ---- */
  comms: {
    kind: 'Communication',
    title: 'Radio Blackout',
    story: 'A solar particle event has flooded the antenna with noise. Earth cannot hear the base for about a day. Control has stopped sending the daily status requests.',
    options: [
      {
        label: 'Run a full systems check without ground support',
        hint: 'Uses power, but finds small problems early.',
        deltas: [
          { key: 'power', amount: -9, note: 'Diagnostic systems ran' },
          { key: 'health', amount: 5, note: 'Maintenance caught a small fault' }
        ],
        tone: 'good',
        heading: 'Caught a Small Fault',
        story: 'Without ground support the crew ran every system themselves and found a slow air leak in a storage loop. It was fixed before it became a real leak.',
        lesson: 'When you lose outside help, you learn to trust your own instruments.'
      },
      {
        label: 'Write an emergency message and send it anyway',
        hint: 'Costs power, but Earth may warn you about something.',
        deltas: [
          { key: 'power', amount: -5, note: 'Radio transmission' },
          { key: 'health', amount: 2, note: 'Crew unstressed by contact' }
        ],
        tone: 'warn',
        heading: 'Message Sent',
        story: 'The transmission mostly disappeared into the static, but part of it got through. Control sent back a short list of solar storm warnings.',
        lesson: 'A damaged link can still pass useful information. Cost is not always waste.'
      },
      {
        label: 'Ignore it and take the free rest day',
        hint: 'Saves resources, but hides real problems.',
        deltas: [
          { key: 'food',   amount: -4, note: 'Lighter day' },
          { key: 'health', amount: 3, note: 'Crew rested' }
        ],
        tone: 'warn',
        heading: 'Quiet Day',
        story: 'The crew used the day to sleep and clean. It was good for morale, but nobody checked the systems as carefully as they should have.',
        lesson: 'Rest matters, but a lost day of maintenance is a risk you accept on purpose.'
      }
    ]
  },

  /* ---- DAY 6 : OBJECTIVE 3 ---- */
  food: {
    kind: 'Production Failure',
    title: 'The Hydroponics Bay Has Failed',
    story: 'One grow light array burned out. The lettuce crop is fine, but nothing new will grow without light, so the food supply will start falling every day.',
    options: [
      {
        label: 'Fit a replacement grow light',
        hint: 'Uses power and food today, brings production back.',
        deltas: [
          { key: 'food',   amount: 15, note: 'Stored harvest brought in' },
          { key: 'power',  amount: -12, note: 'New grow light draws power' }
        ],
        mods: { foodProduction: 5 },
        completes: 'obj-food',
        tone: 'good',
        heading: 'Hydroponics Back Online',
        story: 'The replacement array is lit. The crop is growing again and the base now produces a small surplus of food every day.',
        lesson: 'Repairing production is better than eating your way through the stores.'
      },
      {
        label: 'Switch to pre-packaged meals only',
        hint: 'Big food gain today, but you still eat more every day.',
        deltas: [
          { key: 'food', amount: 30, note: 'Meal packs brought out' }
        ],
        mods: { extraFoodUse: 2 },
        tone: 'warn',
        heading: 'Meal Packs Only',
        story: 'Everyone ate well today. But with no fresh crops the crew needs two extra units of food every day, and the stores will empty much faster.',
        lesson: 'Eating from stores is not the same as producing food. One is spending, the other is earning.'
      },
      {
        label: 'Cut the remaining grow lights to save power',
        hint: 'Saves power today and kills the whole crop.',
        deltas: [
          { key: 'power', amount: 14, note: 'Power saved' },
          { key: 'food',  amount: -14, note: 'Remaining crop destroyed' },
          { key: 'health', amount: -4, note: 'Poor diet' }
        ],
        tone: 'bad',
        heading: 'Crop Destroyed',
        story: 'The electricity was saved and the lights are off. The living crop died within hours. There is no fresh food growing on Base Selene anymore.',
        lesson: 'One system depends on another. Cutting power to save it can destroy the thing you were trying to protect.'
      }
    ]
  },

  /* ---- DAY 7 : optional ---- */
  meteor: {
    kind: 'Emergency',
    title: 'A Small Airlock Leak',
    story: 'A grain of meteorite hit the outer airlock seal. The leak is slow, but the hatch cannot be used while it is unsealed. The crew is safe inside the main habitat.',
    options: [
      {
        label: 'Seal the airlock and repair it from inside',
        hint: 'Costs power and time, keeps everyone safe.',
        deltas: [
          { key: 'power',  amount: -8, note: 'Patch and pressurise' },
          { key: 'health', amount: -3, note: 'Cramped repair work' }
        ],
        tone: 'good',
        heading: 'Airlock Sealed',
        story: 'The crew patched the seal from the inside and topped the lock back up with air. The airlock is usable again and nobody had to go outside.',
        lesson: 'Fixing a leak before it grows is much cheaper than emergency repairs later.'
      },
      {
        label: 'Vent the whole airlock and start over',
        hint: 'Expensive, but guaranteed clean.',
        deltas: [
          { key: 'power',  amount: -16, note: 'Full repressurisation' },
          { key: 'oxygen', amount: -9,  note: 'Air lost from the lock' }
        ],
        tone: 'warn',
        heading: 'Full Restart',
        story: 'The lock was emptied completely and rebuilt from scratch. It worked, but it burned through stored air and electricity.',
        lesson: 'The thorough fix is not always the efficient fix. Know which one you need.'
      },
      {
        label: 'Use a patch kit on the outside hatch',
        hint: 'Cheapest, but it may not hold.',
        deltas: [
          { key: 'power', amount: -2, note: 'Almost no power used' },
          { key: 'oxygen', amount: -14, note: 'Slow leak continues' }
        ],
        tone: 'bad',
        heading: 'Temporary Patch',
        story: 'The outside patch took ten minutes and saved almost no power. The seal still weeps slowly and will need a real repair.',
        lesson: 'Cheap and fast often means temporary. Ask yourself: is this actually fixed?'
      }
    ]
  },

  /* ---- DAY 8 : OBJECTIVE 4 ---- */
  air: {
    kind: 'Life Support',
    title: 'The CO2 Scrubber Has Stopped',
    story: 'The carbon dioxide scrubber cartridge is exhausted. Carbon dioxide is building up in the cabin, and the crew are already complaining about headaches.',
    options: [
      {
        label: 'Replace the scrubber cartridge',
        hint: 'Costs power now, restores air quality for good.',
        deltas: [
          { key: 'oxygen', amount: 18, note: 'Cabin air cleaned' },
          { key: 'power',  amount: -10, note: 'Replacement used power' },
          { key: 'health', amount: 5, note: 'Headaches gone' }
        ],
        mods: { oxygenProduction: 5 },
        completes: 'obj-air',
        tone: 'good',
        heading: 'Scrubber Rebuilt',
        story: 'The fresh cartridge is in and the cabin readings are back to normal. The base is now removing carbon dioxide faster than the crew makes it.',
        lesson: 'Life support failures get worse every hour. Fix them early.'
      },
      {
        label: 'Use the emergency scrubber canisters',
        hint: 'Buys a short-term fix, but the problem returns.',
        deltas: [
          { key: 'oxygen', amount: 24, note: 'Canisters cleared the air' },
          { key: 'power',  amount: -18, note: 'Canisters use power' },
          { key: 'health', amount: -4, note: 'Rough night for the crew' }
        ],
        tone: 'warn',
        heading: 'Canisters Used',
        story: 'The canisters pulled the carbon dioxide down and the crew slept. They will run out, and the real scrubber is still broken.',
        lesson: 'Emergency supplies treat the symptom. They are not a repair.'
      },
      {
        label: 'Tell the crew to rest and breathe slowly',
        hint: 'Free, but it barely helps and everyone gets worse.',
        deltas: [
          { key: 'oxygen', amount: 6, note: 'Slightly cleaner air' },
          { key: 'food',   amount: -7, note: 'Crew ate less' },
          { key: 'health', amount: -10, note: 'CO2 poisoning symptoms' }
        ],
        tone: 'bad',
        heading: 'Waiting Made It Worse',
        story: 'Rationing activity barely slowed the build-up of carbon dioxide. Two crew members were too unwell to work by the end of the day.',
        lesson: 'When a life support number is drifting the wrong way, waiting is not neutral. It is a decision to lose more.'
      }
    ]
  },

  /* ---- DAY 9 : optional ---- */
  fatigue: {
    kind: 'Crew',
    title: 'Everyone Is Exhausted',
    story: 'The crew has been running on short sleep since the repairs began. Two of them made mistakes with the checklist yesterday. A short-term decision is needed.',
    options: [
      {
        label: 'Give everyone a proper rest day',
        hint: 'Uses food, but the crew works better afterwards.',
        deltas: [
          { key: 'food',   amount: -8, note: 'Extra meals for the day' },
          { key: 'health', amount: 12, note: 'Crew well rested' }
        ],
        tone: 'good',
        heading: 'Crew Rested',
        story: 'Nobody worked today. By evening everyone was moving properly again and the error rate dropped.',
        lesson: 'Rest is a resource too. Spending it is an investment, not a loss.'
      },
      {
        label: 'Give strong coffee and push through',
        hint: 'Free today, but the crew pays for it at night.',
        deltas: [
          { key: 'health', amount: -9, note: 'Exhaustion caught up' }
        ],
        tone: 'bad',
        heading: 'Ran on Nerves',
        story: 'It worked for six hours. Then the crew made two genuine mistakes and had to redo a whole job.',
        lesson: 'Borrowing energy from tomorrow usually costs more than it saves today.'
      },
      {
        label: 'Shorten the night shift and rotate the work',
        hint: 'Balanced, but nobody gets a full recovery.',
        deltas: [
          { key: 'food',   amount: -4, note: 'Slightly less food' },
          { key: 'health', amount: 5, note: 'Some rest for everyone' }
        ],
        tone: 'warn',
        heading: 'Rotated Shifts',
        story: 'Nobody got a full night of sleep, but nobody worked fourteen hours either. It was a fair middle ground.',
        lesson: 'There is usually a middle option between doing nothing and doing everything.'
      }
    ]
  },

  /* ---- DAY 10 : OBJECTIVE 5 ---- */
  storm: {
    kind: 'Severe Weather',
    title: 'A Dust Storm Is Hitting the Base',
    story: 'Charged lunar dust is blowing across the site. The solar panels are being buried and the sky has gone dark. Visibility outside is under ten metres. The storm should last a few days.',
    options: [
      {
        label: 'Seal the habitat, run on batteries, wait it out',
        hint: 'Costs power, but the storm passes and everyone is safe.',
        deltas: [
          { key: 'power',  amount: -18, note: 'Running on batteries' },
          { key: 'health', amount: -4, note: 'Days spent indoors' }
        ],
        mods: { solarFactorUntilDay: 13, stormSolarFactor: 0.2 },
        completes: 'obj-storm',
        tone: 'good',
        heading: 'Rode Out the Storm',
        story: 'The hatch stayed shut and the base ran on stored electricity. It was tense and expensive, but the dust blew over and the crew came through healthy.',
        lesson: 'Some problems you survive rather than solve. Knowing which is which is the real skill.'
      },
      {
        label: 'Send the crew out to clear the panels',
        hint: 'Keeps power flowing, but near-zero visibility is dangerous.',
        deltas: [
          { key: 'power',  amount: 12, note: 'Panels kept clear' },
          { key: 'health', amount: -15, note: 'Near-blind EVA, injury risk' }
        ],
        completes: 'obj-storm',
        tone: 'warn',
        heading: 'Worked in the Dark',
        story: 'The crew cleared the panels and power kept flowing. One astronaut came back with a bruised leg from a boulder nobody could see.',
        lesson: 'Doing the dangerous job saves resources and spends the one thing you cannot replace: health.'
      },
      {
        label: 'Ignore the storm and keep the normal schedule',
        hint: 'Saves nothing and costs a great deal.',
        deltas: [
          { key: 'power',  amount: -30, note: 'Panels buried, power collapse' },
          { key: 'food',   amount: -9, note: 'Systems failed' },
          { key: 'health', amount: -10, note: 'Hatch seals leaked dust' }
        ],
        mods: { solarFactorUntilDay: 14, stormSolarFactor: 0.15 },
        tone: 'bad',
        heading: 'Caught in the Open',
        story: 'Dust got past the seals and the base went into the dark. Nothing worked properly for three days.',
        lesson: 'Doing nothing in a crisis is not neutral. The problem still happens, and you just do not get to choose how bad it gets.'
      }
    ]
  },

  /* ---- DAY 11 : optional (the unexpected maintenance task) ---- */
  rover: {
    kind: 'Maintenance',
    title: 'The Rover Needs Work',
    story: 'The rover is making a grinding noise and one wheel is losing grip. It is your only way to move heavy equipment, and it is due for scheduled maintenance anyway.',
    options: [
      {
        label: 'Do the full scheduled service now',
        hint: 'Costs power and water, but the rover is reliable afterwards.',
        deltas: [
          { key: 'power', amount: -12, note: 'Workshop power' },
          { key: 'water', amount: -7, note: 'Cleaning and coolant' }
        ],
        tone: 'good',
        heading: 'Rover Serviced',
        story: 'The wheel was realigned, the gearbox was cleaned and the rover passed its check. It is the most reliable machine on the base.',
        lesson: 'Planned maintenance is cheaper than emergency maintenance, always.'
      },
      {
        label: 'Just patch the wheel and keep working',
        hint: 'Fast and cheap, but the problem is likely to return.',
        deltas: [
          { key: 'power', amount: -4, note: 'Quick patch' },
          { key: 'water', amount: 0,  note: 'No cleaning needed' }
        ],
        tone: 'warn',
        heading: 'Quick Fix',
        story: 'The wheel was straightened and the rover drove again within the hour. It will probably need real work before departure.',
        lesson: 'A patch restores movement, not reliability.'
      },
      {
        label: 'Leave it parked until after the mission',
        hint: 'Saves everything now, and loses the rover when you need it.',
        deltas: [
          { key: 'food', amount: -6, note: 'Supplies carried by hand' }
        ],
        tone: 'bad',
        heading: 'Rover Grounded',
        story: 'Nothing was spent on the rover. Carrying supplies by hand used up extra food and tired everyone out.',
        lesson: 'Deferring maintenance still has a price. It just arrives later.'
      }
    ]
  },

  /* ---- DAY 12 : OBJECTIVE 6 (final) ---- */
  depart: {
    kind: 'Mission Day',
    title: 'Departure Day',
    story: 'The ascent stage is fuelled and the crew is ready. One last decision: how do you want to end the mission?',
    options: [
      {
        label: 'Launch now, with the crew rested and the base stable',
        hint: 'Safest ending. Returns everyone home in good condition.',
        deltas: [
          { key: 'power',  amount: -10, note: 'Launch systems' },
          { key: 'health', amount: 4, note: 'Relief after 12 days' }
        ],
        completes: 'obj-return',
        tone: 'good',
        heading: 'Crew Home Safe',
        story: 'The ascent stage lifted off with all three astronauts aboard and in good health. Every mission objective was met.',
        lesson: 'Knowing when to leave is a real skill in mission planning.'
      },
      {
        label: 'Stay one more day to finish outstanding repairs',
        hint: 'Might improve the base, but spends another day of supplies.',
        deltas: [
          { key: 'power',  amount: 12, note: 'Repairs completed' },
          { key: 'food',   amount: -10, note: 'Extra day of food' },
          { key: 'water',  amount: -8, note: 'Extra day of water' },
          { key: 'oxygen', amount: -9, note: 'Extra day of oxygen' },
          { key: 'health', amount: -6, note: 'Extra fatigue' }
        ],
        completes: 'obj-return',
        tone: 'warn',
        heading: 'One More Day',
        story: 'The crew stayed and finished the repairs, then launched. The base was in better shape but the crew had less in the tank.',
        lesson: 'Finishing the job is not always better than going home safe. Know your margin.'
      }
    ]
  }
};

/* Which event happens on which day. Day 1 has no event. */
var SCHEDULE = {
  2: 'solar',
  3: 'supply',
  4: 'water',
  5: 'comms',
  6: 'food',
  7: 'meteor',
  8: 'air',
  9: 'fatigue',
  10: 'storm',
  11: 'rover',
  12: 'depart'
};

/* ------------------------------------------------------------
   4b. WHERE EACH EVENT HAPPENS IN THE 2D WORLD
   The scenario for a day is not shown as a popup. It waits at its
   station with a glowing marker until the astronaut walks over
   and presses E. This table says which station hosts which event.
   ------------------------------------------------------------ */

var EVENT_STATION = {
  solar: 'solar',
  water: 'water',
  food: 'food',
  air: 'oxygen',
  storm: 'solar',
  depart: 'console',
  supply: 'depot',
  comms: 'console',
  meteor: 'habitat',
  fatigue: 'habitat',
  rover: 'depot'
};

/* What a plain "service" visit does at each station.
   It can be done once per station per mission, so it cannot be
   farmed for free resources. */
var STATION_SERVICE = {
  habitat: {
    label: 'Rest the crew and run a medical check',
    deltas: [{ key: 'health', amount: 16, note: 'Crew rested' }]
  },
  oxygen: {
    label: 'Purge and rebalance the oxygen loop',
    deltas: [{ key: 'oxygen', amount: 14, note: 'Loop balanced' }],
    mods: { oxygenProduction: 5 }
  },
  water: {
    label: 'Backflush the water recycler',
    deltas: [{ key: 'water', amount: 16, note: 'Backflush done' }],
    mods: { waterRecovery: 12 }
  },
  food: {
    label: 'Replant the nursery trays',
    deltas: [{ key: 'food', amount: 14, note: 'New seedlings' }],
    mods: { foodProduction: 5 }
  },
  solar: {
    label: 'Re-align the solar panel array',
    deltas: [{ key: 'power', amount: 18, note: 'Array realigned' }],
    mods: { solarFactor: 1 }
  },
  depot: {
    label: 'Open a supply crate',
    deltas: [
      { key: 'food', amount: 12, note: 'Ration crate' },
      { key: 'water', amount: 10, note: 'Water canister' }
    ]
  },
  console: {
    label: 'Nothing to service here, but you can read the board',
    deltas: []
  }
};

/* Plain English status shown when you visit a station. */
var STATION_STATUS = {
  habitat: function () {
    return 'Crew health is ' + Math.round(game.health) + ' out of 100. ' +
           crewAlive() + ' of ' + STARTING_CREW + ' astronauts are fit for duty.';
  },
  oxygen: function () {
    return 'Oxygen store is ' + Math.round(game.oxygen) + ' out of 100. ' +
           'Breathing oxygen in use: ' + Math.round(DAILY_OXYGEN_USE) + ' per day.';
  },
  water: function () {
    return 'Water supply is ' + Math.round(game.water) + ' out of 100. ' +
           (game.mods.waterRecovery > 0
             ? 'The recycling loop is running and returning ' + game.mods.waterRecovery + ' a day.'
             : 'The recycling loop is NOT running, so every drop used is lost.');
  },
  food: function () {
    return 'Food supply is ' + Math.round(game.food) + ' out of 100. ' +
           (game.mods.foodProduction > 0
             ? 'Hydroponics are producing ' + game.mods.foodProduction + ' a day.'
             : 'Hydroponics are not producing, so the stores only shrink.');
  },
  solar: function () {
    var pct = Math.round(game.mods.solarFactor * 100);
    return 'Electricity is ' + Math.round(game.power) + ' out of 100. ' +
           'The array is running at ' + pct + '% of normal output.';
  },
  depot: function () {
    return 'Spare parts and rations for the whole crew. A good place to resupply.';
  },
  console: function () {
    return objectivesDone() + ' of ' + OBJECTIVES.length +
           ' objectives are complete on mission day ' + game.day + '.';
  }
};

/* ------------------------------------------------------------
   SECTION 5: GAME STATE
   One object holds everything that can change during a mission.
   ------------------------------------------------------------ */

var game = null;

function createNewGame() {
  return {
    day: 1,
    oxygen: 100,
    water: 100,
    food: 100,
    power: 100,
    health: 100,
    score: 0,
    completed: {},        // objective id -> true
    goodChoices: 0,
    badChoices: 0,
    finished: false,
    success: false,
    failReason: '',
    decisionLocked: false,
    advancing: false,
    stationEvent: null,        // station id hosting today's scenario
    stationEventKey: null,     // which scenario that is
    stationOpen: false,        // is a station panel on screen?
    serviced: {},              // station id -> true once serviced
    pickupsCollected: 0,
    mods: {
      solarFactor: 1,             // permanent solar output multiplier
      solarFactorUntilDay: 0,     // storm ends on this day
      stormSolarFactor: 1,
      waterRecovery: 0,           // clean water gained per day
      oxygenProduction: 0,        // oxygen gained per day
      foodProduction: 0,          // food gained per day
      extraFoodUse: 0             // extra food eaten per day
    },
    dayLog: []             // what changed today, for the report panel
  };
}

/* ------------------------------------------------------------
   SECTION 6: SMALL HELPERS
   ------------------------------------------------------------ */

function clamp(value, low, high) {
  if (value < low) { return low; }
  if (value > high) { return high; }
  return value;
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function crewAlive() {
  if (game.health >= 70) { return 3; }
  if (game.health >= 40) { return 2; }
  if (game.health > 0)   { return 1; }
  return 0;
}

/* Add an amount to one resource, keep it inside 0-100, and
   write down the real change so the player can see it. */
function applyDelta(key, amount, note) {
  var before = game[key];
  var after = clamp(before + amount, 0, MAX_VALUE);
  game[key] = round1(after);
  game.dayLog.push({
    key: key,
    amount: round1(game[key] - before),
    note: note
  });
}

function applyDeltas(list) {
  for (var i = 0; i < list.length; i++) {
    var d = list[i];
    applyDelta(d.key, d.amount, d.note);
  }
}

function applyMods(mods) {
  if (!mods) { return; }
  for (var key in mods) {
    if (Object.prototype.hasOwnProperty.call(mods, key)) {
      game.mods[key] = mods[key];
    }
  }
}

function objectivesDone() {
  var count = 0;
  for (var i = 0; i < OBJECTIVES.length; i++) {
    if (game.completed[OBJECTIVES[i].id]) { count++; }
  }
  return count;
}

/* ------------------------------------------------------------
   SECTION 7: FINDING PAGE ELEMENTS
   ------------------------------------------------------------ */

function el(id) {
  return document.getElementById(id);
}

/* ------------------------------------------------------------
   SECTION 8: MOVING BETWEEN SCREENS
   ------------------------------------------------------------ */

function showScreen(name) {
  var screens = ['welcome', 'howto', 'learn', 'game', 'result'];
  for (var i = 0; i < screens.length; i++) {
    el('screen-' + screens[i]).hidden = (screens[i] !== name);
  }
  window.scrollTo(0, 0);
}

/* ------------------------------------------------------------
   SECTION 9: RENDERING THE RESOURCE CARDS
   ------------------------------------------------------------ */

var lastRendered = null;

function renderResources() {
  var grid = el('resource-grid');
  var keys = ['oxygen', 'water', 'food', 'power', 'health'];

  var html = '';
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var info = RESOURCES[key];
    var value = game[key];
    var percent = clamp(Math.round((value / MAX_VALUE) * 100), 0, 100);

    var state = '';
    if (key === 'health') {
      if (value <= 20) { state = ' crit'; }
      else if (value <= 45) { state = ' low'; }
    } else if (percent <= 15) { state = ' crit'; }
    else if (percent <= 30) { state = ' low'; }

    var change = '';
    if (lastRendered) {
      var diff = round1(game[key] - lastRendered[key]);
      if (diff > 0)      { change = '<div class="res-delta up">▲ +' + diff + '</div>'; }
      else if (diff < 0) { change = '<div class="res-delta down">▼ ' + diff + '</div>'; }
      else               { change = '<div class="res-delta">no change</div>'; }
    } else {
      change = '<div class="res-delta">starting value</div>';
    }

    html +=
      '<div class="res-card' + state + '">' +
        '<div class="res-top">' +
          '<span class="res-icon" aria-hidden="true">' + info.icon + '</span>' +
          '<span class="res-name">' + info.name + '</span>' +
          '<span class="res-short">' + info.short + '</span>' +
          '<span class="res-number">' + Math.round(value) + '</span>' +
        '</div>' +
        '<div class="res-track">' +
          '<div class="res-fill ' + info.fill + '" style="width:' + percent + '%"></div>' +
        '</div>' +
        change +
      '</div>';
  }

  grid.innerHTML = html;
}

function rememberValues() {
  lastRendered = {
    oxygen: game.oxygen,
    water: game.water,
    food: game.food,
    power: game.power,
    health: game.health
  };
}

/* ------------------------------------------------------------
   SECTION 10: RENDERING MISSION PROGRESS
   ------------------------------------------------------------ */

function renderMission() {
  var done = objectivesDone();
  var total = OBJECTIVES.length;
  var percent = Math.round((done / total) * 100);

  el('progress-text').textContent = done + ' of ' + total + ' objectives complete';
  el('progress-percent').textContent = percent + '%';
  el('progress-fill').style.width = percent + '%';

  var nextObjective = null;
  for (var i = 0; i < OBJECTIVES.length; i++) {
    if (!game.completed[OBJECTIVES[i].id]) { nextObjective = OBJECTIVES[i]; break; }
  }
  el('current-objective').textContent = nextObjective
    ? nextObjective.text
    : 'All objectives complete. Bring the crew home.';

  var listHtml = '';
  for (var j = 0; j < OBJECTIVES.length; j++) {
    var obj = OBJECTIVES[j];
    var isDone = !!game.completed[obj.id];
    var isNext = nextObjective && obj.id === nextObjective.id;
    var cls = isDone ? 'done' : (isNext ? 'next' : '');
    var icon = isDone ? '✔' : (isNext ? '▶' : '○');
    listHtml +=
      '<li class="' + cls + '">' +
        '<span class="obj-icon" aria-hidden="true">' + icon + '</span>' +
        '<span>' + obj.text + '</span>' +
      '</li>';
  }
  el('objective-list').innerHTML = listHtml;
}

function renderTopbar() {
  el('stat-day').textContent = game.day;
  el('stat-max-days').textContent = MISSION_LENGTH_DAYS;
  el('stat-crew').textContent = crewAlive();

  var pill = el('status-pill');
  var alive = crewAlive();
  var lowest = Math.min(game.oxygen, game.water, game.food, game.power);

  if (game.power <= 0) {
    pill.textContent = 'Power Emergency';
    pill.className = 'topbar-tag status-danger';
  } else if (game.health <= 35 || lowest <= 15) {
    pill.textContent = 'Crew At Risk';
    pill.className = 'topbar-tag status-warning';
  } else if (lowest <= 30) {
    pill.textContent = 'Supplies Low';
    pill.className = 'topbar-tag status-warning';
  } else {
    pill.textContent = 'Mission In Progress';
    pill.className = 'topbar-tag status-good';
  }
}

function renderAll() {
  renderResources();
  renderMission();
  renderTopbar();
}

/* ------------------------------------------------------------
   SECTION 11: THE DAILY CYCLE
   This is the heart of the game. Every day the base consumes
   resources, and low resources hurt the crew.
   ------------------------------------------------------------ */

function runDayCycle() {
  game.dayLog = [];

  var alive = crewAlive();
  var crewFactor = alive / STARTING_CREW;

  // Solar panels
  var solar = SOLAR_GENERATION * game.mods.solarFactor;
  if (game.day < game.mods.solarFactorUntilDay) {
    solar = solar * game.mods.stormSolarFactor;
  }

  // Power in, power out
  applyDelta('power', solar - DAILY_POWER_USE, 'Solar +' + solar + ' / systems -' + DAILY_POWER_USE);

  // Oxygen, water, food
  applyDelta('oxygen', game.mods.oxygenProduction - DAILY_OXYGEN_USE * crewFactor, 'Crew breathing');
  applyDelta('water',  game.mods.waterRecovery - DAILY_WATER_USE * crewFactor, 'Drinking, washing, crops');
  applyDelta('food',   game.mods.foodProduction - (DAILY_FOOD_USE + game.mods.extraFoodUse) * crewFactor, 'Crew eating');

  // Health penalties when something runs low
  if (game.oxygen < LOW_OXYGEN_LEVEL) {
    applyDelta('health', -10, 'Oxygen too low');
  }
  if (game.water < LOW_WATER_LEVEL) {
    applyDelta('health', -8, 'Water too low');
  }
  if (game.food < LOW_FOOD_LEVEL) {
    applyDelta('health', -6, 'Not enough food');
  }
  if (game.power <= 0) {
    applyDelta('health', -12, 'Life support on emergency reserve');
  }
  if (game.health < 35) {
    applyDelta('health', -4, 'Exhaustion');
  }
}

function checkFailure() {
  if (game.health <= 0) {
    endMission(false, 'Crew health reached zero. The astronauts could not be saved.');
  } else if (game.oxygen <= 0) {
    endMission(false, 'Oxygen ran out. There was no air left to breathe.');
  } else if (game.water <= 0) {
    endMission(false, 'Water ran out. The base could not support the crew.');
  } else if (game.food <= 0) {
    endMission(false, 'Food ran out. There was nothing left to eat.');
  } else {
    return false;
  }
  return true;
}

/* ------------------------------------------------------------
   SECTION 12: SHOWING THE EVENT PANEL
   ------------------------------------------------------------ */

function showQuietDay() {
  el('event-kind').textContent = 'Day ' + game.day + ' Report';
  el('event-title').textContent = 'A Quiet Day on the Moon';
  el('event-story').innerHTML =
    'No alarms today. The base ran on its normal schedule: the crew ate, slept, checked the ' +
    'systems and worked outside for a few hours. The bars on the left show what that cost you.';
  el('event-options').innerHTML = '';

  showResult({
    tone: 'neutral',
    heading: 'Daily Use',
    story: 'Nothing broke, so nothing was gained. Every quiet day still costs oxygen, water, food and power.',
    entries: game.dayLog,
    lesson: 'A day with no event still costs you supplies. Watch the bars, not just the story.'
  });

  el('btn-next-day').hidden = false;
  el('btn-next-day').textContent = 'Continue to Next Day';
  el('event-hint').hidden = true;
}

function showEvent(key) {
  var event = EVENTS[key];
  game.decisionLocked = false;

  el('event-kind').textContent = event.kind;
  el('event-title').textContent = event.title;
  el('event-story').textContent = event.story;
  el('event-result').hidden = true;
  el('btn-next-day').hidden = true;
  el('event-hint').textContent = 'Choose an option. Every option changes your resources.';
  el('event-hint').hidden = false;

  var html = '';
  for (var i = 0; i < event.options.length; i++) {
    var option = event.options[i];
    html +=
      '<button class="btn-option" type="button" data-option="' + i + '">' +
        '<span class="opt-label">' + (i + 1) + '. ' + option.label + '</span>' +
        '<span class="opt-hint">' + option.hint + '</span>' +
      '</button>';
  }
  el('event-options').innerHTML = html;

  var buttons = el('event-options').querySelectorAll('.btn-option');
  for (var b = 0; b < buttons.length; b++) {
    buttons[b].addEventListener('click', chooseOption);
  }

  el('event-options').querySelector('.btn-option').focus();
}

function chooseOption(event) {
  // Guard 1: only one choice per day, even if someone clicks twice.
  if (game.decisionLocked) { return; }
  var button = event.currentTarget;
  var index = Number(button.getAttribute('data-option'));

  var eventKey = currentEventKey();
  if (!eventKey) { return; }
  var option = EVENTS[eventKey].options[index];
  if (!option) { return; }

  // Lock the decision immediately, then disable every option button.
  game.decisionLocked = true;
  var buttons = el('event-options').querySelectorAll('.btn-option');
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].disabled = true;
  }

  applyDeltas(option.deltas);
  applyMods(option.mods);

  if (option.completes) {
    game.completed[option.completes] = true;
  }

  if (option.tone === 'good') { game.goodChoices++; }
  if (option.tone === 'bad')  { game.badChoices++; }

  rememberValues();
  renderAll();

  // Combine the daily use and the choice so the player sees everything.
  var entries = game.dayLog.slice();
  showResult({
    tone: option.tone,
    heading: option.heading,
    story: option.story,
    entries: entries,
    lesson: option.lesson
  });

  el('btn-next-day').hidden = false;
  el('btn-next-day').textContent = 'Finish and End Day';
  el('event-hint').hidden = true;

  // Finishing the last objective ends the mission immediately, even on day 12.
  checkWin();
  if (!game.finished) { el('btn-next-day').focus(); }
}

/* All objectives done means the mission is a success. */
function checkWin() {
  if (objectivesDone() === OBJECTIVES.length) {
    endMission(true, 'Every mission objective was completed.');
    return true;
  }
  return false;
}

function currentEventKey() {
  return SCHEDULE[game.day] || null;
}

function showResult(config) {
  var box = el('event-result');
  box.hidden = false;
  box.className = 'event-result' + (config.tone === 'neutral' ? '' : ' ' + config.tone);

  el('result-heading').textContent = config.heading;
  el('result-story').textContent = config.story;
  el('result-lesson').textContent = 'Why: ' + config.lesson;

  var html = '';
  for (var i = 0; i < config.entries.length; i++) {
    var entry = config.entries[i];
    var info = RESOURCES[entry.key];
    var amount = entry.amount;
    var cls = amount > 0 ? 'd-good' : (amount < 0 ? 'd-bad' : 'd-neutral');
    var shown = amount === 0 ? 'no change' : (amount > 0 ? '+' + amount : '' + amount);

    html +=
      '<li><span>' + info.icon + ' ' + info.name + ' <span style="opacity:.7">(' + entry.note + ')</span></span>' +
      '<span class="' + cls + '">' + shown + '</span></li>';
  }
  el('result-deltas').innerHTML = html;
}

/* ------------------------------------------------------------
   SECTION 13: STARTING AND ADVANCING DAYS
   ------------------------------------------------------------ */

function startMission() {
  game = createNewGame();
  lastRendered = null;
  closeStationPanel();
  if (window.world && typeof world.reset === 'function') { world.reset(); }
  showScreen('game');
  beginDay();
  loadNasaData();
}

function beginDay() {
  // Time is up. This is checked before anything is consumed, so the
  // last day of the mission is the final day and not one extra.
  if (game.day > MISSION_LENGTH_DAYS) {
    endMission(false, 'Mission time ran out before every objective was completed.');
    return;
  }

  rememberValues();
  runDayCycle();
  renderAll();

  // A vital resource may have hit zero during the daily cycle.
  if (checkFailure()) { return; }

  /* New day, new chance to decide. Without this the decision lock
     from yesterday would block today's scenario. */
  game.decisionLocked = false;
  game.stationOpen = false;

  /* ------------------------------------------------------------
     NEW IN THE 2D GAME
     A scenario is no longer pushed onto the screen. Instead it is
     attached to its station, with a glowing marker, and the
     player has to physically walk over and press E to deal with it.
     ------------------------------------------------------------ */
  var eventKey = currentEventKey();
  game.stationEventKey = eventKey || null;
  game.stationEvent = eventKey ? (EVENT_STATION[eventKey] || null) : null;

  if (window.world && typeof world.setStationEvent === 'function') {
    world.setStationEvent(game.stationEvent);
    return;                       /* nothing to show yet, the player must walk */
  }

  /* Fallback: if world.js is missing, behave like the old button game. */
  if (eventKey) { showEvent(eventKey); } else { showQuietDay(); }
}

function goToNextDay() {
  // Guard 2: stop a fast double-click from skipping a day.
  if (game.advancing || game.finished) { return; }
  game.advancing = true;
  el('btn-next-day').disabled = true;
  closeStationPanel();

  setTimeout(function () {
    el('btn-next-day').disabled = false;
    game.advancing = false;

    game.day = game.day + 1;
    beginDay();
    checkFailure();
  }, 280);
}

/* ------------------------------------------------------------
   19. THE 2D WORLD BRIDGE
   These functions are called by world.js. They are the only place
   where the 2D scene is allowed to affect the mission.
   ------------------------------------------------------------ */

/* The astronaut pressed E next to a station. */
function openStation(stationId) {
  if (game.finished || game.stationOpen || game.advancing) { return; }

  /* If today's scenario is hosted here, run the normal decision flow. */
  if (game.stationEvent === stationId && game.stationEventKey && !game.decisionLocked) {
    showEvent(game.stationEventKey);
    openStationPanel();
    return;
  }

  showStationPanel(stationId);
}

function showStationPanel(stationId) {
  var station = null;
  if (window.STATIONS) {
    for (var i = 0; i < STATIONS.length; i++) {
      if (STATIONS[i].id === stationId) { station = STATIONS[i]; break; }
    }
  }
  if (!station) { return; }

  game.stationOpen = true;

  el('event-kind').textContent = 'System Check';
  el('event-title').textContent = station.name;
  el('event-story').textContent = station.blurb;
  el('event-options').innerHTML = '';
  el('event-result').hidden = true;
  el('btn-next-day').hidden = true;

  var statusText = STATION_STATUS[stationId] ? STATION_STATUS[stationId]() : '';
  var already = !!game.serviced[stationId];
  var service = STATION_SERVICE[stationId];

  var html = '';
  html += '<div class="station-readout">' + statusText + '</div>';

  if (service && !already && service.deltas.length > 0) {
    html += '<button class="btn-option" type="button" id="btn-service">' +
            '<span class="opt-label">' + service.label + '</span>' +
            '<span class="opt-hint">Costs one mission day. Can only be done once here.</span>' +
            '</button>';
  } else if (service && already) {
    html += '<div class="station-done">This station has already been serviced on this mission.</div>';
  }

  html += '<button class="btn btn-ghost btn-block" type="button" id="btn-leave-station">' +
          'Leave (costs one day)</button>';

  el('event-options').innerHTML = html;

  var serviceBtn = el('btn-service');
  if (serviceBtn) { serviceBtn.addEventListener('click', function () { doService(stationId); }); }
  el('btn-leave-station').addEventListener('click', function () {
    game.dayLog.push({ key: 'day', amount: 0, note: 'Moved on without a task' });
    el('btn-next-day').hidden = false;
    el('btn-next-day').disabled = false;
    el('event-options').innerHTML = '';
  });

  if (window.world && world.playWork) { world.playWork(24); }
  openStationPanel();
}

/* Actually perform the station service action. */
function doService(stationId) {
  if (game.finished || game.serviced[stationId]) { return; }

  var service = STATION_SERVICE[stationId];
  if (!service) { return; }

  game.serviced[stationId] = true;
  applyDeltas(service.deltas);
  applyMods(service.mods);

  rememberValues();
  renderAll();

  showResult({
    tone: 'good',
    heading: stationId.charAt(0).toUpperCase() + stationId.slice(1) + ' Serviced',
    story: 'The maintenance is finished. This station is back in good order for the rest of the mission.',
    entries: game.dayLog,
    lesson: 'Looking after a system once is cheaper than running it broken for many days.'
  });

  el('event-options').innerHTML = '';
  el('btn-next-day').hidden = false;
  el('btn-next-day').disabled = false;

  if (window.world) {
    world.bump(3);
    world.playWork(46);
  }
}

/* Floating canisters the astronaut touched in the world. */
function collectPickup() {
  if (game.finished) { return; }

  /* Top up whichever vital resource is currently the weakest. */
  var weakest = 'oxygen';
  if (game.water < game[weakest]) { weakest = 'water'; }
  if (game.food < game[weakest]) { weakest = 'food'; }

  game.pickupsCollected = game.pickupsCollected + 1;
  applyDelta(weakest, 6, 'Supply canister collected');
  rememberValues();
  renderAll();
}

/* Show and hide the station overlay. */
function openStationPanel() {
  game.stationOpen = true;
  var panel = el('station-panel');
  if (panel) { panel.hidden = false; }
}

function closeStationPanel() {
  game.stationOpen = false;
  var panel = el('station-panel');
  if (panel) { panel.hidden = true; }
}

/* Pause / resume overlay. */
function setPausedUI(paused) {
  var overlay = el('pause-overlay');
  if (overlay) { overlay.hidden = !paused; }
  var btn = el('btn-pause');
  if (btn) { btn.textContent = paused ? 'Resume' : 'Pause'; }
}

/* ------------------------------------------------------------
   SECTION 14: SCORING
   ------------------------------------------------------------ */

function calculateScore() {
  var objectivePoints = objectivesDone() * 5;                 // up to 30

  var alive = crewAlive();
  var survivalPoints = 0;
  if (alive === 3) { survivalPoints = 25; }
  else if (alive === 2) { survivalPoints = 17; }
  else if (alive === 1) { survivalPoints = 8; }

  var healthPoints = Math.round((game.health / MAX_VALUE) * 15);   // up to 15

  var resourceAverage = (game.oxygen + game.water + game.food + game.power) / 4;
  var resourcePoints = Math.round((resourceAverage / MAX_VALUE) * 20);  // up to 20

  var lowest = Math.min(game.oxygen, game.water, game.food, game.power);
  var efficiencyPoints = 0;
  if (lowest <= 0)       { efficiencyPoints = -10; }
  else if (lowest <= 15) { efficiencyPoints = 5; }
  else if (lowest <= 30) { efficiencyPoints = 8; }
  else                   { efficiencyPoints = 10; }

  var total = objectivePoints + survivalPoints + healthPoints + resourcePoints + efficiencyPoints;
  total = clamp(total, 0, 100);

  if (!game.success) {
    total = Math.round(total * 0.6);
  }
  return clamp(total, 0, 100);
}

function endMission(success, reason) {
  if (game.finished) { return; }

  game.finished = true;
  game.success = success;
  game.failReason = reason;
  game.score = calculateScore();
  game.stationOpen = false;
  game.stationEvent = null;

  var panel = el('station-panel');
  if (panel) { panel.hidden = true; }

  var pauseOverlay = el('pause-overlay');
  if (pauseOverlay) { pauseOverlay.hidden = true; }
  if (window.world) { world.paused = true; }

  // Stop the player from clicking anything else.
  var buttons = el('event-options').querySelectorAll('.btn-option');
  for (var i = 0; i < buttons.length; i++) { buttons[i].disabled = true; }
  el('btn-next-day').hidden = true;

  showResults();
}

/* ------------------------------------------------------------
   SECTION 15: THE RESULTS SCREEN
   ------------------------------------------------------------ */

function showResults() {
  showScreen('result');

  var alive = crewAlive();

  el('result-eyebrow').textContent = game.success ? 'Mission Complete' : 'Mission Failed';
  el('result-title').textContent = game.success ? 'Mission Success' : 'Mission Failure';
  el('result-subtitle').textContent = game.success
    ? 'Every objective was met and the crew came home.'
    : game.failReason;

  el('score-number').textContent = game.score;
  var degrees = Math.round((game.score / 100) * 360);
  el('score-ring').style.background =
    'conic-gradient(#4fd1e0 0deg, #2b9fb0 ' + degrees + 'deg, rgba(255,255,255,.08) ' + degrees + 'deg)';

  el('r-survival').textContent = alive === 0
    ? 'Crew lost'
    : alive + ' of ' + STARTING_CREW + ' alive';
  el('r-days').textContent = Math.min(game.day, MISSION_LENGTH_DAYS) + ' of ' + MISSION_LENGTH_DAYS;
  el('r-objectives').textContent = objectivesDone() + ' of ' + OBJECTIVES.length;
  el('r-decisions').textContent = game.goodChoices + ' good / ' + game.badChoices + ' poor';

  var resHtml = '';
  var keys = ['oxygen', 'water', 'food', 'power', 'health'];
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var info = RESOURCES[key];
    var percent = clamp(Math.round((game[key] / MAX_VALUE) * 100), 0, 100);
    resHtml +=
      '<div class="res-summary">' +
        '<span class="rs-name">' + info.icon + ' ' + info.name + '</span>' +
        '<div class="rs-value">' + Math.round(game[key]) + '</div>' +
        '<div class="rs-track"><div class="rs-fill ' + info.fill + '" style="width:' + percent + '%"></div></div>' +
      '</div>';
  }
  el('result-resources').innerHTML = resHtml;

  var objHtml = '';
  for (var j = 0; j < OBJECTIVES.length; j++) {
    var obj = OBJECTIVES[j];
    var done = !!game.completed[obj.id];
    objHtml +=
      '<li class="' + (done ? 'done' : '') + '">' +
        '<span class="obj-icon" aria-hidden="true">' + (done ? '✔' : '✘') + '</span>' +
        '<span>' + obj.text + '</span>' +
      '</li>';
  }
  el('result-objectives').innerHTML = objHtml;

  el('result-report').textContent = buildReport();

  var tips = [];
  if (game.success) {
    tips.push('You finished every objective. Try finishing faster, on day 9 or 10, for a bigger score.');
  } else {
    tips.push('Focus on the first resource that drops below 30. Fixing one bar early is cheaper than fixing three bars late.');
  }
  if (game.badChoices > 0) {
    tips.push('You made ' + game.badChoices + ' choice(s) that cost more than they gave. Re-read the hint under each option before picking.');
  }
  // A storm only counts as damage while it is still blowing.
  var stormStillRaging = game.day < game.mods.solarFactorUntilDay;
  if (game.mods.solarFactor < 1 || stormStillRaging) {
    tips.push('Solar output was still below full when the mission ended. Power problems spread, so treat panel faults as a top priority.');
  }
  if (game.mods.waterRecovery === 0) {
    tips.push('The water recycling loop was never repaired. Fixing the loop is cheaper than opening emergency tanks every day.');
  }
  if (game.mods.foodProduction === 0) {
    tips.push('Food production was never restored. Once production is running, the food bar stops falling.');
  }
  if (game.mods.oxygenProduction === 0) {
    tips.push('The CO2 scrubber was not repaired. Oxygen keeps draining until life support is fixed.');
  }
  if (game.mods.extraFoodUse > 0) {
    tips.push('Switching to meal packs raised food use permanently. Fixing production instead is cheaper over 12 days.');
  }
  if (crewAlive() < STARTING_CREW) {
    tips.push('You lost crew members. Health drops fastest when oxygen is low, so watch that bar above all others.');
  }
  if (tips.length === 0) {
    tips.push('Excellent flying. Nothing to fix, so try a faster mission next time.');
  }
  el('result-tips').innerHTML = '';
  for (var t = 0; t < tips.length; t++) {
    var li = document.createElement('li');
    li.textContent = tips[t];
    el('result-tips').appendChild(li);
  }
}

function buildReport() {
  var alive = crewAlive();
  var done = objectivesDone();
  var parts = [];

  if (game.success) {
    parts.push('Mission success. You completed all ' + OBJECTIVES.length +
      ' objectives in ' + Math.min(game.day, MISSION_LENGTH_DAYS) + ' days.');
  } else {
    parts.push('Mission failed. ' + game.failReason + ' You completed ' + done + ' of ' +
      OBJECTIVES.length + ' objectives.');
  }

  if (alive === STARTING_CREW) {
    parts.push('All three astronauts returned in good condition.');
  } else if (alive === 0) {
    parts.push('The crew did not survive. Health fell to zero.');
  } else {
    parts.push('Only ' + alive + ' of ' + STARTING_CREW +
      ' astronauts survived. Health fell into a danger band.');
  }

  parts.push('You made ' + game.goodChoices + ' strong decision(s) and ' +
    game.badChoices + ' harmful one(s).');

  var lowestKey = 'oxygen';
  var lowestValue = game.oxygen;
  var keys = ['oxygen', 'water', 'food', 'power'];
  for (var i = 0; i < keys.length; i++) {
    if (game[keys[i]] < lowestValue) { lowestValue = game[keys[i]]; lowestKey = keys[i]; }
  }
  parts.push('Your tightest resource at the end was ' +
    RESOURCES[lowestKey].name.toLowerCase() + ' at ' + Math.round(lowestValue) + '.');

  return parts.join(' ');
}

/* ------------------------------------------------------------
   SECTION 16: LIVE NASA OPEN DATA PANEL
   ------------------------------------------------------------
   Source: NASA Image and Video Library API
   https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf
   This API is public, needs no key, and sends CORS headers so a
   browser can read it directly. If it fails or you are offline,
   the panel explains that and the game carries on.
   ------------------------------------------------------------ */

var NASA_API = 'https://images-api.nasa.gov/search';
var NASA_QUERIES = ['lunar surface', 'spacesuit extravehicular', 'plant growth'];
var nasaLoaded = false;

function loadNasaData() {
  // Only ask NASA once per page visit, not once per restart.
  if (nasaLoaded) { return; }
  nasaLoaded = true;

  var statusBox = el('nasa-status');
  var listBox = el('nasa-list');

  statusBox.className = 'nasa-status';
  statusBox.textContent = 'Loading NASA Open Data...';
  listBox.innerHTML = '';

  if (typeof fetch !== 'function') {
    statusBox.className = 'nasa-status error';
    statusBox.textContent = 'This browser cannot load live NASA data. The game works normally without it.';
    return;
  }

  NASA_QUERIES.forEach(function (query) {
    var url = NASA_API + '?q=' + encodeURIComponent(query) + '&media_type=image&page_size=1';

    fetch(url)
      .then(function (response) {
        if (!response.ok) { throw new Error('HTTP ' + response.status); }
        return response.json();
      })
      .then(function (data) {
        addNasaItem(data, query);
      })
      .catch(function () {
        addNasaErrorItem(query);
      });
  });
}

function addNasaItem(data, query) {
  var items = data.collection && data.collection.items;
  if (!items || items.length === 0 || !items[0].data || !items[0].data[0]) {
    updateNasaStatus();
    return;
  }

  var record = items[0].data[0];
  var thumb = items[0].links && items[0].links[0] ? items[0].links[0].href : '';
  var details = 'https://images.nasa.gov/details/' + encodeURIComponent(record.nasa_id);

  var li = document.createElement('li');
  li.innerHTML =
    '<span class="n-title">' + cleanText(record.title) + '</span>' +
    '<span class="n-note">NASA ID ' + cleanText(record.nasa_id) +
      ' &middot; ' + cleanText(record.center) +
      ' &middot; ' + formatDate(record.date_created) + '</span>' +
    (thumb ? '<img class="n-thumb" src="' + cleanText(thumb) + '" alt="" loading="lazy">' : '') +
    '<a class="n-link" href="' + details + '" target="_blank" rel="noopener">View on images.nasa.gov</a>' +
    '<span class="n-note" style="margin-top:6px">Search term: "' + cleanText(query) + '"</span>';

  el('nasa-list').appendChild(li);
  updateNasaStatus();
}

function addNasaErrorItem(query) {
  var li = document.createElement('li');
  li.innerHTML =
    '<span class="n-title">Could not load "' + cleanText(query) + '"</span>' +
    '<span class="n-note">No internet connection, or the NASA service is unavailable. The mission does not depend on this.</span>';
  el('nasa-list').appendChild(li);
  updateNasaStatus();
}

var nasaDone = 0;

function updateNasaStatus() {
  nasaDone = nasaDone + 1;
  if (nasaDone >= NASA_QUERIES.length) {
    el('nasa-status').textContent =
      'Live results from the NASA Image and Video Library (images-api.nasa.gov). No API key required.';
  }
}

function cleanText(text) {
  if (!text) { return 'Unknown'; }
  return String(text).replace(/[<>]/g, '');
}

function formatDate(iso) {
  if (!iso) { return 'date unknown'; }
  var day = String(iso).split('T')[0];       // drop the time part
  var parts = day.split('-');
  if (parts.length < 3) { return day; }
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var month = months[Number(parts[1]) - 1] || parts[1];
  return parts[0] + ' ' + month + ' ' + parts[2];
}

/* ------------------------------------------------------------
   SECTION 17: BUTTONS AND KEYBOARD
   ------------------------------------------------------------ */

function goBackToWelcome() {
  showScreen('welcome');
}

function wireUp() {
  el('btn-start').addEventListener('click', startMission);

  el('btn-howto').addEventListener('click', function () { showScreen('howto'); });
  el('btn-learn').addEventListener('click', function () { showScreen('learn'); });
  el('btn-learn-again').addEventListener('click', function () { showScreen('learn'); });
  el('btn-home').addEventListener('click', goBackToWelcome);

  var goStart = document.querySelectorAll('.js-go-start');
  for (var i = 0; i < goStart.length; i++) {
    goStart[i].addEventListener('click', startMission);
  }
  var goWelcome = document.querySelectorAll('.js-go-welcome');
  for (var w = 0; w < goWelcome.length; w++) {
    goWelcome[w].addEventListener('click', goBackToWelcome);
  }

  el('btn-next-day').addEventListener('click', goToNextDay);
  el('btn-restart').addEventListener('click', startMission);

  /* The mission card starts folded down to just the progress bar and the
     current task. This button opens the full objective list when the
     player wants it, and folds it away again so the Moon Base stays
     clear. */
  var toggleObjectives = el('btn-toggle-objectives');
  if (toggleObjectives) {
    toggleObjectives.addEventListener('click', function () {
      var card = toggleObjectives.closest('.hud-card');
      if (!card) { return; }
      var folded = card.classList.toggle('is-collapsed');
      toggleObjectives.setAttribute('aria-expanded', folded ? 'false' : 'true');
      toggleObjectives.textContent = folded ? 'Objectives' : 'Hide list';
    });
  }
  el('btn-pause').addEventListener('click', function () {
    if (typeof togglePause === 'function') { togglePause(); }
  });
  el('btn-restart-quick').addEventListener('click', function () {
    if (window.confirm('Restart the mission? All progress will be lost.')) {
      startMission();
    }
  });

  // Keyboard support: press 1, 2 or 3 to pick an option.
  document.addEventListener('keydown', function (e) {
    if (el('screen-game').hidden) { return; }
    if (e.key !== '1' && e.key !== '2' && e.key !== '3') { return; }

    var buttons = el('event-options').querySelectorAll('.btn-option');
    var index = Number(e.key) - 1;
    if (buttons[index] && !buttons[index].disabled) {
      e.preventDefault();
      buttons[index].click();
    }
  });
}

/* ------------------------------------------------------------
   SECTION 18: START THE GAME WHEN THE PAGE LOADS
   ------------------------------------------------------------ */

game = createNewGame();
wireUp();
showScreen('welcome');
