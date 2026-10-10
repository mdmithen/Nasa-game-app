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
   All of them must be complete for the mission to be a success.

   The first six are the original repair-and-survive list. The last
   two were added in Phase 3 and are the science tasks: they are not
   decided by picking an option in a panel, they are earned by walking
   the base and looking at it.

   Scoring still totals 100. See calculateScore.

   PHASE 5 SPLITS THEM
   -------------------
   Every objective now says whether it is PRIMARY or OPTIONAL.

     primary    the mission. All of them must be done to fly home,
                and `obj-return` is the launch itself.
     optional   things that make a mission better without being
                required. Missing one costs points in the objective
                band, but it does not stop the crew coming home.

   Phase 5 adds four more optional objectives, defined in
   challenges.js because they depend on the challenges, the base and
   the landing site. `allObjectives()` is the single list every screen
   and the scorer read, so nothing can drift out of step.
   ------------------------------------------------------------ */

var OBJECTIVES = [
  { id: 'obj-power',   text: 'Restore full solar power to the base', primary: true },
  { id: 'obj-water',   text: 'Restart the water recycling loop', primary: true },
  { id: 'obj-food',    text: 'Get the hydroponics bay producing again', primary: true },
  { id: 'obj-air',     text: 'Repair the CO2 scrubber', primary: true },
  { id: 'obj-storm',   text: 'Ride out the lunar dust storm safely', primary: true },
  { id: 'obj-explore', text: 'Collect 6 supply canisters from across the surface', primary: false,
    progress: function () { return game.explored; }, target: 6 },
  { id: 'obj-survey',  text: 'Inspect 4 different structures and log them at the console', primary: false,
    progress: function () { return Object.keys(game.surveyed || {}).length; },
    /* The survey target depends on the site: a crater where ice was
       actually measured is a better place to do science, so fewer
       readouts are needed there. See surveyTargetFor(). */
    target: function () {
      return (typeof missionSurveyTarget === 'function') ? missionSurveyTarget() : 4;
    } },
  { id: 'obj-return',  text: 'Return the crew safely to Earth', primary: true }
];

/* The primary and optional objective lists, read from one place. */
function allObjectives() {
  var out = [];
  var i;
  for (i = 0; i < OBJECTIVES.length; i++) { out.push(OBJECTIVES[i]); }
  if (typeof PHASE5_OBJECTIVES !== 'undefined') {
    for (i = 0; i < PHASE5_OBJECTIVES.length; i++) { out.push(PHASE5_OBJECTIVES[i]); }
  }
  return out;
}

function isPrimary(obj) { return obj.primary === true; }

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
  },

  /* ============================================================
     PHASE 3: EMERGENENCY EVENTS
     These are not on the schedule. They only happen when a system has
     actually worn past the point of no return, which is what the
     maintenance model in mission.js is for. A base kept in good order
     by a supply depot and a few service visits never sees one of these.

     Every one of them offers the same three shapes of answer, because
     the choice is always the same: fix the cause, buy time, or cut
     something else to pay for it.
     ============================================================ */

  'fail-solar': {
    kind: 'Life Support Emergency',
    title: 'The Solar Array Has Failed',
    story: 'Dust has been grinding into the panel edges for days and the array has dropped below the level the base needs. ' +
           'The batteries are carrying the whole base on their own, and they will not do it for long. Something has to change today.',
    options: [
      {
        label: 'Strip, clean and re-align the whole array',
        hint: 'Costs a day of power and water, but the array comes back.',
        deltas: [
          { key: 'power', amount: -9, note: 'Array stripped and cleaned' },
          { key: 'water', amount: -5, note: 'Cleaning solvent' }
        ],
        mods: { solarFactor: 1 },
        restores: 'solar',
        completes: 'obj-power',
        tone: 'good',
        heading: 'Array Back at Full Output',
        story: 'The crew worked along the panels with brushes and solvent and cleared dust that had been building for weeks. Output came straight back up.',
        lesson: 'Preventive cleaning is cheap. Replacing a collapsed array is not.'
      },
      {
        label: 'Run the base on batteries and save the panels',
        hint: 'No repair today. The batteries will not last the mission.',
        deltas: [
          { key: 'power', amount: 6, note: 'Panels switched off, batteries eased' }
        ],
        restores: 'solar',
        tone: 'warn',
        heading: 'Running on Stored Power',
        story: 'The panels were left alone and the base ran off the batteries. The array was cleaned in the end, but for a while the crew were living on what they had already made.',
        lesson: 'Postponing maintenance does not remove the cost, it just moves the bill to a worse time.'
      },
      {
        label: 'Shut down everything non-essential to protect the air',
        hint: 'Saves power, but the crew lose heat and the crops suffer.',
        deltas: [
          { key: 'power', amount: 4, note: 'Non-essential systems off' },
          { key: 'health', amount: -5, note: 'Crew working in a cold base' },
          { key: 'food', amount: -8, note: 'Grow lights cut back' }
        ],
        tone: 'bad',
        heading: 'Rationing Power',
        story: 'The base went cold to keep the air scrubbers running. The crew worked in shift bags and the crop got less light than it needed.',
        lesson: 'Power problems spread sideways. Anything you switch off to save power is usually something else that needed it.'
      }
    ]
  },

  'fail-oxygen': {
    kind: 'Life Support Emergency',
    title: 'The Oxygen Scrubber Has Stopped',
    story: 'The scrubber cartridge is spent and the replacement never made it into the base. Carbon dioxide is climbing in the cabin and the crew have headaches. ' +
           'Without this running, the oxygen store only falls from here.',
    options: [
      {
        label: 'Rebuild the scrubber from the spare cartridges',
        hint: 'Costs power today. The cabin is breathable again.',
        deltas: [
          { key: 'power', amount: -12, note: 'Scrubber rebuilt' },
          { key: 'oxygen', amount: 10, note: 'Cabin air cleaned' }
        ],
        mods: { oxygenProduction: 5 },
        restores: 'oxygen',
        completes: 'obj-air',
        tone: 'good',
        heading: 'Scrubber Running',
        story: 'The crew stacked every spare cartridge they had and built a new scrubber. The cabin readings came down within the hour.',
        lesson: 'Air is the one system you never get to decide about later.'
      },
      {
        label: 'Vent some of the cabin air and top it up',
        hint: 'Quick, and it costs stored oxygen.',
        deltas: [
          { key: 'oxygen', amount: 18, note: 'Cabin partly vented' },
          { key: 'health', amount: -6, note: 'Crew headaches' }
        ],
        restores: 'oxygen',
        tone: 'warn',
        heading: 'Vented and Recharged',
        story: 'The cabin was partly vented and refilled from the tanks. Everyone felt better by the evening, and the scrubber is running again, but it took stored air to do it.',
        lesson: 'Emergency supplies buy you today. They do not buy you the rest of the mission.'
      },
      {
        label: 'Put the crew to bed with masks on overnight',
        hint: 'Costs nothing in stores, and costs a great deal in health.',
        deltas: [
          { key: 'oxygen', amount: 4, note: 'Masks used' },
          { key: 'health', amount: -13, note: 'Headaches and poor sleep' }
        ],
        tone: 'bad',
        heading: 'Masks All Night',
        story: 'The crew slept in masks and came through the night. Nobody worked well the next day and the scrubber still needs a real repair.',
        lesson: 'You can run a crew on very little, but they pay for every hour of it afterwards.'
      }
    ]
  },

  'fail-water': {
    kind: 'Resource Emergency',
    title: 'The Water Recycler Has Broken Down',
    story: 'The filter finally gave up and the loop is down. Water is now leaving the store twice as fast as before, because nothing is coming back. ' +
           'There are canisters on the ground, and there is ice under the shadowed crater nearby.',
    options: [
      {
        label: 'Strip and rebuild the recycler filter',
        hint: 'Uses power and water, and the loop runs again.',
        deltas: [
          { key: 'power', amount: -8, note: 'Filter rebuilt' },
          { key: 'water', amount: 8, note: 'Loop back online' }
        ],
        mods: { waterRecovery: 12 },
        restores: 'water',
        completes: 'obj-water',
        tone: 'good',
        heading: 'Recycling Restored',
        story: 'The crew stripped the filter, cleared it and put it back. From today the base cleans and reuses water instead of losing every drop.',
        lesson: 'A working recycler is the difference between a base that can last and one that cannot.'
      },
      {
        label: 'Send the rover out for ice',
        hint: 'The most water possible, at the price of the batteries.',
        deltas: [
          { key: 'water', amount: 30, note: 'Ice collected by the rover' },
          { key: 'power', amount: -24, note: 'Rover drilling used power' }
        ],
        restores: 'water',
        completes: 'obj-water',
        tone: 'warn',
        heading: 'Ice Harvest',
        story: 'The rover reached the shadowed crater and came back loaded. It is a lot of water, and it cost a lot of electricity to get.',
        lesson: 'Real lunar ice is a genuine resource. In this game it works, but it is bought with power.'
      },
      {
        label: 'Cut the crops and drink what is in store',
        hint: 'Keeps the crew alive, and ends food production for good.',
        deltas: [
          { key: 'water', amount: 16, note: 'Emergency water drawn' },
          { key: 'food', amount: -14, note: 'Crops switched off' }
        ],
        tone: 'bad',
        heading: 'Crops Switched Off',
        story: 'The hydroponics bay was drained and the water went to the crew. Nobody went thirsty, and there is no fresh food growing on Base Selene now.',
        lesson: 'Every base has a chain. Cut the wrong link and you damage something you cannot repair.'
      }
    ]
  },

  'fail-food': {
    kind: 'Resource Emergency',
    title: 'Hydroponics Has Failed',
    story: 'The grow lights and pumps have worn out together, and the trays are dying. The stores are still there, but nothing is coming. ' +
           'Everything the crew eat from today on was sent from Earth.',
    options: [
      {
        label: 'Rebuild the grow lights and replant',
        hint: 'Uses power today. Production comes back.',
        deltas: [
          { key: 'power', amount: -11, note: 'Grow lights rebuilt' },
          { key: 'food', amount: 8, note: 'New seedlings in' }
        ],
        mods: { foodProduction: 5 },
        restores: 'food',
        completes: 'obj-food',
        tone: 'good',
        heading: 'Hydroponics Back Online',
        story: 'The lights and pumps were rebuilt and fresh seedlings went into the trays. The crew will be eating from the base again in a few days.',
        lesson: 'Producing food is worth far more over a mission than eating well for one day.'
      },
      {
        label: 'Live off the stores and the supply depot',
        hint: 'Feeds the crew well today, and nothing at all tomorrow.',
        deltas: [
          { key: 'food', amount: 22, note: 'Depot crates opened' }
        ],
        restores: 'food',
        tone: 'warn',
        heading: 'Eating the Stores',
        story: 'The crew ate well from the depot. It was a good day for morale and it moved the food bar, but the shelves are a little emptier now.',
        lesson: 'Spending a store is not the same as making food. One is running down, the other is running.'
      },
      {
        label: 'Halve every crew ration instead',
        hint: 'Keeps the stores alive longer. The crew will feel it.',
        deltas: [
          { key: 'food', amount: -6, note: 'Rations halved' },
          { key: 'health', amount: -7, note: 'Everyone eating less' }
        ],
        mods: { extraFoodUse: 0 },
        tone: 'bad',
        heading: 'Rations Halved',
        story: 'Every meal was smaller from today on. The stores will last, and the crew are tired, irritable and slower than they were.',
        lesson: 'A crew on short rations makes worse decisions. That is a cost the bars do not show.'
      }
    ]
  },

  'fail-habitat': {
    kind: 'Crew Emergency',
    title: 'The Habitat Pressure Is Dropping',
    story: 'A seal on the habitat has worn through and the cabin is losing air very slowly. The crew are safe, but they are sleeping in shift bags and nobody is getting proper rest. ' +
           'A crew that does not sleep does not work.',
    options: [
      {
        label: 'Patch the seal and re-pressurise the habitat',
        hint: 'Costs power and water, and the crew get their beds back.',
        deltas: [
          { key: 'power', amount: -7, note: 'Patch and pressurise' },
          { key: 'water', amount: -4, note: 'Water used in the repair' },
          { key: 'health', amount: 6, note: 'Crew back in the habitat' }
        ],
        restores: 'habitat',
        tone: 'good',
        heading: 'Habitat Sealed',
        story: 'The seal was replaced and the cabin topped back up. The crew slept in real beds for the first time in days and woke up moving properly again.',
        lesson: 'Rest is not a luxury on a long mission. It is what keeps people able to work.'
      },
      {
        label: 'Seal the damaged section off and sleep in the rest',
        hint: 'Cheap and quick, but the crew are cramped.',
        deltas: [
          { key: 'power', amount: -3, note: 'Section sealed off' },
          { key: 'health', amount: 1, note: 'Some rest achieved' }
        ],
        restores: 'habitat',
        tone: 'warn',
        heading: 'One Section Closed',
        story: 'The crew sealed the damaged section and fitted the bunks closer together. It is not comfortable, but it is pressurised and it is a bed.',
        lesson: 'A partial fix buys you time. Know that you took it.'
      },
      {
        label: 'Keep working outside and repair it at the end',
        hint: 'Costs nothing today. Everyone loses sleep in the meantime.',
        deltas: [
          { key: 'health', amount: -10, note: 'No proper rest for the crew' },
          { key: 'food', amount: -4, note: 'Crews too tired to eat well' }
        ],
        tone: 'bad',
        heading: 'Working Through It',
        story: 'The habitat stayed unsealed and the crew kept their shift-bag routine. It saved supplies and cost the crew a great deal of health.',
        lesson: 'Deferring maintenance still has a price. It just arrives later, and it is usually paid in people.'
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
   and presses E. This table says which KIND of structure hosts
   which event, so a base with two depots flags both of them.
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
  rover: 'depot',

  /* Phase 3 emergencies are hosted by whatever actually broke. */
  'fail-solar': 'solar',
  'fail-oxygen': 'oxygen',
  'fail-water': 'water',
  'fail-food': 'food',
  'fail-habitat': 'habitat'
};

/* What a plain "service" visit does at each kind of structure.
   It can be done once per kind per mission, so it cannot be farmed
   for free resources.

   These keys are structure TYPES, not the id of one placed
   structure, so a base holding two depots still services the depot
   type only once. */
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
  },
  pad: {
    label: 'Clear dust off the pad and check the beacons',
    deltas: [
      { key: 'power', amount: 8, note: 'Pad beacons and floodlights working' }
    ]
  }
};

/* How many of a structure type this base actually has, for the
   readouts below. */
function builtCount(type) {
  if (!game || !game.layout) { return 0; }
  var n = 0;
  for (var i = 0; i < game.layout.length; i++) {
    if (game.layout[i].type === type) { n++; }
  }
  return n;
}

/* A short note about how many of this structure the base holds, and
   how many it is allowed. Only types that can be repeated are worth
   saying, so a single habitat stays quiet. */
function placedNote(station) {
  var type = (typeof STATION_TYPE_INDEX !== 'undefined')
    ? STATION_TYPE_INDEX[station.type] : null;
  if (!type || type.limit <= 1) { return ''; }
  return ' This base has ' + builtCount(station.type) +
         ' of these, out of the ' + type.limit + ' a base may hold.';
}

/* Plain English status shown when you visit a structure. Phase 3 added
   the condition of the machine behind the readout, because a system
   that is worn down produces less whether or not the player knows. */
function conditionNote(system) {
  if (typeof conditionOf !== 'function') { return ''; }
  var pct = Math.round(conditionOf(system));
  if (systemFailed(system)) {
    return ' Condition is ' + pct + '% - FAILED, running at about ' +
           Math.round(outputFactor(system) * 100) + '%.';
  }
  if (pct < 100) {
    return ' Condition is ' + pct + '%, so it is delivering about ' +
           Math.round(outputFactor(system) * 100) + '% of normal.';
  }
  return ' Condition is 100%.';
}

var STATION_STATUS = {
  habitat: function (station) {
    return 'Crew health is ' + Math.round(game.health) + ' out of 100. ' +
           crewAlive() + ' of ' + STARTING_CREW + ' astronauts are fit for duty.' +
           conditionNote('habitat') + placedNote(station);
  },
  oxygen: function (station) {
    return 'Oxygen store is ' + Math.round(game.oxygen) + ' out of 100. ' +
           'Breathing oxygen in use: ' + Math.round(DAILY_OXYGEN_USE) + ' per day.' +
           conditionNote('oxygen') + placedNote(station);
  },
  water: function (station) {
    return 'Water supply is ' + Math.round(game.water) + ' out of 100. ' +
           (game.mods.waterRecovery > 0
              ? 'The recycling loop is running and returning ' + game.mods.waterRecovery + ' a day.'
              : 'The recycling loop is NOT running, so every drop used is lost.') +
           conditionNote('water') + placedNote(station);
  },
  food: function (station) {
    return 'Food supply is ' + Math.round(game.food) + ' out of 100. ' +
           (game.mods.foodProduction > 0
              ? 'Hydroponics are producing ' + game.mods.foodProduction + ' a day.'
              : 'Hydroponics are not producing, so the stores only shrink.') +
           conditionNote('food') + placedNote(station);
  },
  solar: function (station) {
    var pct = Math.round(game.mods.solarFactor * 100);
    return 'Electricity is ' + Math.round(game.power) + ' out of 100. ' +
           'The array is running at ' + pct + '% of normal output.' +
           conditionNote('solar') + placedNote(station);
  },
  depot: function (station) {
    return 'Spare parts and rations for the whole crew. ' +
           builtCount('depot') + ' depot(s) means equipment wears down ' +
           maintenanceNote() + '. A good place to resupply.' +
           placedNote(station);
  },
  console: function (station) {
    return objectivesDone() + ' of ' + OBJECTIVES.length +
           ' objectives are complete on mission day ' + game.day + '. ' +
           'Canisters logged: ' + game.explored + ' of ' +
           (typeof EXPLORE_TARGET === 'number' ? EXPLORE_TARGET : 6) + '. ' +
           'Structures surveyed: ' + Object.keys(game.surveyed || {}).length + ' of ' +
           (typeof missionSurveyTarget === 'function' ? missionSurveyTarget() : 4) + '.' +
           placedNote(station);
  },
  pad: function (station) {
    return 'The lander touches down here and the rover parks beside it. ' +
           'Electricity is ' + Math.round(game.power) + ' out of 100.' +
           placedNote(station);
  }
};

/* A short, plain statement of what the depots are doing for the rest
   of the base. Shown at the depot so the player can connect the
   building they placed to the wear they are seeing. */
function maintenanceNote() {
  if (typeof baseCapabilities === 'function') {
    var caps = baseCapabilities();
    return caps.depots > 1 ? 'more slowly' : 'a little more slowly';
  }
  return 'a little more slowly';
}

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
    layout: null,         // the base: [{uid, type, x}]. set by applyBase()
    zoneId: null,         // which landing site was chosen, if any
    stationEvent: null,        // station type hosting today's scenario
    stationEventKey: null,     // which scenario that is
    activeEventKey: null,      // today's scenario, fixed once the day starts
    pendingEmergency: null,    // a system that failed, awaiting its scenario
    stationOpen: false,        // is a station panel on screen?
    serviced: {},              // station type -> true once serviced
    pickupsCollected: 0,
    /* Phase 5: challenges, achievements and one-time awards. Created by
       challenges.js and merged in below, so restarting a mission gets a
       clean sheet every single time. */
    challenges: {}, awarded: {}, unlocked: {},
    repairsMade: 0, emergenciesHandled: 0, challengesFailed: 0, lowestSeen: {},
    /* Phase 3: maintenance condition per system, science progress, and
       the dust storm count. Created by mission.js, which is a separate
       file because this one was already long enough. */
    maint: {}, faults: {}, explored: 0, surveyed: {}, lastBalance: null, storms: 0,
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

/* A number written with an explicit + or -, for the daily balance on
   the results screen where the sign is the whole point. */
function signed1(value) {
  var rounded = round1(value);
  return (rounded > 0 ? '+' : '') + rounded;
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

/* The objectives that are on the table for THIS mission.

   An optional objective is only listed when the base and the site can
   actually support it, so the player is never shown a task they
   cannot do - "bring an ice sample back" is not offered at a crater
   where no ice has ever been found. */
function availableObjectives() {
  var all = allObjectives();
  var out = [];
  for (var i = 0; i < all.length; i++) {
    var obj = all[i];
    if (typeof obj.available === 'function') {
      var ok = false;
      try { ok = obj.available() === true; } catch (e) { ok = false; }
      if (!ok) { continue; }
    }
    out.push(obj);
  }
  return out;
}

/* The number an objective is counting towards. Usually a constant,
   but the survey target depends on the landing site, so `target` may
   be a function. */
function objectiveTarget(obj) {
  if (typeof obj.target === 'function') {
    var n = 1;
    try { n = obj.target(); } catch (e) { n = 1; }
    return (typeof n === 'number' && isFinite(n) && n > 0) ? n : 1;
  }
  return (typeof obj.target === 'number' && obj.target > 0) ? obj.target : 1;
}

/* How far along an objective is, as a whole number. Objectives with no
   progress function are simply 0 or 1. */
function objectiveProgress(obj) {
  var target = objectiveTarget(obj);
  if (game.completed[obj.id]) { return target; }
  if (typeof obj.progress !== 'function') { return 0; }
  var n = 0;
  try { n = obj.progress(); } catch (e) { n = 0; }
  if (typeof n !== 'number' || !isFinite(n) || n < 0) { n = 0; }
  return Math.min(Math.round(n), target);
}

/* Called once a day. Marks every available objective whose condition
   now holds. completeObjective() is idempotent, so an objective can
   only ever be counted and paid once, however often this runs. */
function refreshObjectives() {
  var list = availableObjectives();
  for (var i = 0; i < list.length; i++) {
    var obj = list[i];
    if (game.completed[obj.id]) { continue; }
    if (typeof obj.progress === 'function' && objectiveProgress(obj) >= objectiveTarget(obj)) {
      completeObjective(obj.id);
    }
  }
}

function objectivesDone() {
  var count = 0;
  var list = availableObjectives();
  for (var i = 0; i < list.length; i++) {
    if (game.completed[list[i].id]) { count++; }
  }
  return count;
}

function objectivesTotal() { return availableObjectives().length; }

function primaryObjectivesDone() {
  var count = 0;
  var list = availableObjectives();
  for (var i = 0; i < list.length; i++) {
    if (isPrimary(list[i]) && game.completed[list[i].id]) { count++; }
  }
  return count;
}

function primaryObjectivesTotal() {
  var count = 0;
  var list = availableObjectives();
  for (var i = 0; i < list.length; i++) {
    if (isPrimary(list[i])) { count++; }
  }
  return count;
}

function optionalObjectivesDone() {
  var count = 0;
  var list = availableObjectives();
  for (var i = 0; i < list.length; i++) {
    if (!isPrimary(list[i]) && game.completed[list[i].id]) { count++; }
  }
  return count;
}

function optionalObjectivesTotal() {
  var count = 0;
  var list = availableObjectives();
  for (var i = 0; i < list.length; i++) {
    if (!isPrimary(list[i])) { count++; }
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

/* Every screen in index.html is a <section class="screen" id="screen-NAME">.
   Reading them from the page instead of keeping a list here means a new
   screen can never be added and then silently never appear, which is
   what a hard-coded list used to risk. fx.js wraps this function and
   still works, because it looks screens up the same way. */
function showScreen(name) {
  var screens = document.querySelectorAll('.screen');
  for (var i = 0; i < screens.length; i++) {
    screens[i].hidden = (screens[i].id !== 'screen-' + name);
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
  var total = objectivesTotal();
  var percent = (total > 0) ? Math.round((done / total) * 100) : 0;

  var pDone = primaryObjectivesDone();
  var pTotal = primaryObjectivesTotal();

  el('progress-text').textContent = done + ' of ' + total + ' objectives complete' +
    '  ·  primary ' + pDone + '/' + pTotal;
  el('progress-percent').textContent = percent + '%';
  el('progress-fill').style.width = percent + '%';

  var list = availableObjectives();

  /* The next thing to do is always a primary objective if one is
     left: the optional ones are a bonus, not the job. */
  var nextObjective = null;
  for (var i = 0; i < list.length; i++) {
    if (!game.completed[list[i].id]) {
      if (isPrimary(list[i])) { nextObjective = list[i]; break; }
      if (!nextObjective) { nextObjective = list[i]; }
    }
  }

  el('current-objective').textContent = nextObjective
    ? nextObjective.text
    : 'All objectives complete. Bring the crew home.';

  var listHtml = '';
  for (var j = 0; j < list.length; j++) {
    var obj = list[j];
    var isDone = !!game.completed[obj.id];
    var isNext = nextObjective && obj.id === nextObjective.id;
    var cls = isDone ? 'done' : (isNext ? 'next' : '');
    var icon = isDone ? '✔' : (isNext ? '▶' : '○');

    /* Progress, where the objective has any. */
    var progressText = '';
    if (!isDone) {
      var now = objectiveProgress(obj);
      var goal = objectiveTarget(obj);
      if (now > 0) { progressText = ' <span class="obj-progress">' + now + '/' + goal + '</span>'; }
    }

    listHtml +=
      '<li class="' + cls + (isPrimary(obj) ? ' is-primary' : ' is-optional') + '">' +
        '<span class="obj-icon" aria-hidden="true">' + icon + '</span>' +
        '<span>' + obj.text + progressText + '</span>' +
        '<span class="obj-kind">' + (isPrimary(obj) ? 'required' : 'optional') + '</span>' +
      '</li>';
  }
  el('objective-list').innerHTML = listHtml;
}

/* ------------------------------------------------------------
   10b. THE CHALLENGE PANEL
   Phase 5. Small, quiet, and only on screen when something actually
   needs doing - a game HUD that is permanently shouting is a HUD
   nobody reads.
   ------------------------------------------------------------ */

function renderChallenges() {
  var box = el('challenge-panel');
  if (!box) { return; }

  var open = [];
  if (game && !game.finished) {
    for (var i = 0; i < CHALLENGES.length; i++) {
      var def = CHALLENGES[i];
      var state = game.challenges[def.id];
      if (state && state.status === 'active') { open.push({ def: def, state: state }); }
    }
  }

  if (open.length === 0) { box.innerHTML = ''; box.hidden = true; return; }

  var html = '';
  for (var c = 0; c < open.length; c++) {
    var d = open[c].def;
    var s = open[c].state;
    var urgent = false;
    if (!d.continuous && s.deadlineDay !== null && s.deadlineDay !== undefined) {
      urgent = (s.deadlineDay - game.day) <= 1;
    }

    html +=
      '<div class="hud-challenge' + (urgent ? ' is-urgent' : '') + '">' +
        '<span class="hc-icon" aria-hidden="true">' + d.icon + '</span>' +
        '<span class="hc-body">' +
          '<span class="hc-title">' + d.title + '</span>' +
          '<span class="hc-where">Go to the ' +
            (typeof STATION_TYPE_INDEX !== 'undefined' && STATION_TYPE_INDEX[d.host]
              ? STATION_TYPE_INDEX[d.host].name.toLowerCase() : d.host) +
          ' &middot; ' + challengeDeadlineText(d, s) + '</span>' +
        '</span>' +
      '</div>';
  }
  box.innerHTML = html;
  box.hidden = false;
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
  if (typeof renderChallenges === 'function') { renderChallenges(); }
}

/* ------------------------------------------------------------
   SECTION 11: THE DAILY CYCLE
   This is the heart of the game. Every day the base consumes
   resources, and low resources hurt the crew.

   Phase 3: the numbers are no longer fixed constants. They come from
   what the player actually built and from the site they landed at,
   worked out in mission.js. The shape of the calculation is unchanged
   - generation minus consumption, then the low-supply health
   penalties - but the values moving through it now depend on the
   base, which is the whole point of the builder.
   ------------------------------------------------------------ */

function runDayCycle() {
  game.dayLog = [];

  var alive = crewAlive();
  var crewFactor = alive / STARTING_CREW;

  /* ---- dust storms ----
     A storm begins before the day's production is worked out, so the
     crew feels it on the day it arrives rather than the day after. */
  if (typeof isDustStormDay === 'function' && isDustStormDay(game.day) &&
      game.day >= game.mods.solarFactorUntilDay) {
    var storm = applyDustStorm();
    game.dayLog.push({
      key: 'day',
      amount: 0,
      note: 'Dust storm: solar output cut to ' +
            Math.round(storm.severity * 100) + '% for ' + storm.length + ' days'
    });
  }

  /* ---- the day's balance ---- */
  var plan;
  if (typeof projectedDailyDeltas === 'function' &&
      typeof baseCapabilities === 'function' &&
      typeof siteFactors === 'function') {
    plan = projectedDailyDeltas(baseCapabilities(), siteFactors());
  } else {
    /* Fallback: the fixed numbers Phase 3 replaced, kept so this file
       still plays correctly if mission.js is ever missing. */
    var oldSolar = SOLAR_GENERATION * game.mods.solarFactor;
    if (game.day < game.mods.solarFactorUntilDay) {
      oldSolar = oldSolar * game.mods.stormSolarFactor;
    }
    plan = {
      power: oldSolar - DAILY_POWER_USE,
      oxygen: game.mods.oxygenProduction - DAILY_OXYGEN_USE * crewFactor,
      water: game.mods.waterRecovery - DAILY_WATER_USE * crewFactor,
      food: game.mods.foodProduction - (DAILY_FOOD_USE + game.mods.extraFoodUse) * crewFactor,
      health: 0
    };
  }

  game.lastBalance = plan;

  applyDelta('power',
    plan.power,
    'Solar +' + round1(plan.solarGenerated !== undefined ? plan.solarGenerated : 0) +
    ' / systems -' + round1(plan.powerUsed !== undefined ? plan.powerUsed : DAILY_POWER_USE) +
    (plan.heating ? ' (incl. ' + round1(plan.heating) + ' heating)' : ''));

  applyDelta('oxygen', plan.oxygen,
    game.mods.oxygenProduction > 0
      ? 'Crew breathing, scrubber running'
      : 'Crew breathing, no scrubber running');

  applyDelta('water', plan.water,
    (game.mods.waterRecovery > 0 || builtCount('water') > 0)
      ? 'Drinking, washing, crops - recycler running'
      : 'Drinking, washing, crops - recycler NOT running');

  applyDelta('food', plan.food,
    (game.mods.foodProduction > 0 || builtCount('food') > 0)
      ? 'Crew eating - hydroponics producing'
      : 'Crew eating - hydroponics not producing');

  if (plan.health !== 0) {
    applyDelta('health', plan.health, builtCount('habitat') > 0
      ? 'Crew rested in the habitat'
      : 'No pressurized habitat: the crew slept in shift bags');
  }

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

  /* ---- equipment maintenance, Phase 3 ----
     Wear happens after the day's output, so servicing a structure
     today helps tomorrow rather than today. */
  if (typeof wearDownDay === 'function') {
    var faults = wearDownDay();
    for (var f = 0; f < faults.length; f++) { game.dayLog.push(faults[f]); }

    /* A failed life-support system is the emergency the crew has to
       act on. It is reported as it happens rather than discovered
       later, because a silent failure is not a fair one. */
    if (game.faults && game.faults.oxygen) {
      applyDelta('health', -5, 'The oxygen scrubber has failed');
    }
    if (game.faults && game.faults.water) {
      applyDelta('health', -3, 'The water recycler has failed');
    }
  }

  if (typeof sanitizeMission === 'function') { sanitizeMission(); }
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

  /* Phase 3: an option can put the broken machine back to new. This is
     what the maintenance model is for - the emergency is not a one-off
     penalty, it is a system you have to actually repair. */
  if (option.restores && typeof serviceSystem === 'function') {
    if (serviceSystem(option.restores)) {
      game.dayLog.push({
        key: 'day',
        amount: 0,
        note: (FAULT_NAMES[option.restores] || 'The system') + ' back to full condition'
      });
    }
  }

  if (option.completes) {
    completeObjective(option.completes);
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

/* Every PRIMARY objective done means the mission is a success.

   Optional objectives are not required. Missing one costs points in
   the objective band; it does not stop the crew coming home. That is
   the whole point of splitting them.

   The 16 day limit is a hard rule: a mission that has run past it is
   a failure no matter how many objectives it met, so this refuses to
   declare a victory the moment game.day is past MISSION_LENGTH_DAYS.
   sanitizeMission() enforces the same rule a second time, in case
   anything else ever calls endMission(true). */
function checkWin() {
  if (game.day > MISSION_LENGTH_DAYS) {
    endMission(false, 'Mission time ran out before every objective was completed.');
    return true;
  }
  if (primaryObjectivesDone() === primaryObjectivesTotal() && primaryObjectivesTotal() > 0) {
    endMission(true, 'Every primary objective was completed.');
    return true;
  }
  return false;
}

/* Which scenario the player is looking at right now.

   Once a day has been resolved the answer is fixed and cached, because
   chooseOption() asks again and must get the same answer it did when
   the panel was drawn. */
function currentEventKey() {
  if (game.activeEventKey) { return game.activeEventKey; }

  var scheduled = SCHEDULE[game.day] || null;

  /* Departure is the one thing the crew can still be working towards
     late. If a PRIMARY objective is still outstanding when the
     scheduled launch day arrives, the launch slips rather than ending
     the mission with the mission's own requirements unfinished - right
     up to the last day, which is what makes the limit bite. Optional
     objectives do not hold the launch up. */
  if (scheduled === 'depart') {
    if (game.day > MISSION_LENGTH_DAYS) { return null; }
    if (primaryObjectivesDone() + 1 < primaryObjectivesTotal()) { return null; }
    return 'depart';
  }
  if (!scheduled && game.day >= 12 && game.day <= MISSION_LENGTH_DAYS &&
      !game.completed['obj-return']) {
    return 'depart';
  }

  /* A scheduled event needs the structure that hosts it. A base with no
     depot cannot receive the resupply run, so that day is simply a
     quiet one rather than a broken game. */
  if (scheduled && typeof EVENT_STATION === 'object') {
    var host = EVENT_STATION[scheduled];
    if (host && builtCount(host) === 0) { return null; }
  }

  return scheduled;
}

/* Resolve the day's scenario once, at the start of the day.

   A system that failed during the wear-down takes priority over
   everything on the schedule. A failed life-support system is not
   something the crew can walk past to deal with the resupply run
   instead, so it moves to the front of the day and pushes whatever was
   scheduled to tomorrow. */
function resolveEventKey() {
  if (game.pendingEmergency) {
    var emergency = 'fail-' + game.pendingEmergency;
    if (EVENTS[emergency]) {
      game.pendingEmergency = null;
      game.activeEventKey = emergency;
      return emergency;
    }
    game.pendingEmergency = null;
  }

  game.activeEventKey = currentEventKey();
  return game.activeEventKey;
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
    /* The day log also carries non-resource notes, such as walking
       away from a station without a task. Those have no bar to show,
       so they are left out of the list rather than crashing it. */
    if (!info) { continue; }
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

/* The starting base. It lives in world.js, which loads after this file,
   so it is read through this guard. beginDay() already falls back to a
   plain button game when world.js is missing, and that fallback must
   keep working, so nothing here may assume the file is there. */
function defaultLayout() {
  return (typeof DEFAULT_LAYOUT !== 'undefined') ? DEFAULT_LAYOUT : [];
}

/* The base and the landing site the next mission will be played on.
   Phases 2 and 3 fill in the layout and the site modifiers. Until
   then the base is the starting base and, if no site was chosen on
   the map, the modifiers are all neutral so nothing changes. */
function currentPlan() {
  var zone = (typeof selectedZone === 'function') ? selectedZone() : null;
  var built = (typeof builderLayout === 'function') ? builderLayout() : null;

  return {
    zoneId: zone ? zone.id : null,
    zoneMods: (typeof zoneModsFor === 'function') ? zoneModsFor(zone) : null,
    layout: (built && built.length) ? built : defaultLayout()
  };
}

/* Copy a planned base into the running game and put it on the surface.
   This is the only place the plan is read: once the mission has
   started, `game.layout` is the base and nothing looks back at the
   plan, so the simulation can never be changed halfway through by
   something upstream. */
function applyBase(plan) {
  var wanted = (plan && plan.layout && plan.layout.length) ? plan.layout : defaultLayout();

  game.layout = [];
  for (var i = 0; i < wanted.length; i++) {
    game.layout.push({ uid: wanted[i].uid, type: wanted[i].type, x: wanted[i].x });
  }

  game.zoneId = (plan && plan.zoneId) ? plan.zoneId : null;

  if (window.world && typeof world.applyLayout === 'function') {
    world.applyLayout(game.layout);
  }
}

function startMission() {
  game = createNewGame();
  if (typeof missionNewState === 'function') { applyMissionState(missionNewState()); }
  /* Phase 5: every challenge, badge and one-time award is cleared
     here, which is what makes Restart Mission a genuine reset rather
     than a second mission wearing the first one's state. */
  if (typeof challengeNewState === 'function') { applyChallengeState(challengeNewState()); }
  lastRendered = null;
  closeStationPanel();

  /* A running mission and the builder are different modes, and several
     things read `builder.open` to decide which one they are looking at:
     conditionOf() reports brand new equipment while it is open, and
     countOfType() reads the builder's base rather than the mission's.
     Leaving the builder open across a mission start would therefore
     make the whole base look new and the whole layout look like the
     one being edited. Close it here, so there is exactly one way in. */
  if (typeof closeBuilder === 'function' && typeof builder !== 'undefined' && builder && builder.open) {
    builder.open = false;
    var gameSection = el('screen-game');
    if (gameSection) { gameSection.classList.remove('is-building'); }
    var buildBar = el('build-bar');
    if (buildBar) { buildBar.hidden = true; }
    if (window.world && typeof world.setMode === 'function') { world.setMode('play'); }
  }

  applyBase(currentPlan());
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
  game.activeEventKey = null;

  /* ------------------------------------------------------------
     PHASE 5: challenges, objectives and achievements.

     This runs after the resource cycle and after any failure check,
     so a challenge is judged against today's real numbers, and a
     challenge can never rescue a base that already failed today.

     Order matters:
       updateChallenges()   starts what should start, expires what
                            has run out of time
       refreshObjectives()  marks any objective whose condition now
                            holds - idempotent, so it can never pay
                            twice
       updateAchievements() unlocks badges - also idempotent, and it
                            adds no points
     ------------------------------------------------------------ */
  if (typeof updateChallenges === 'function') { updateChallenges(); }
  if (typeof refreshObjectives === 'function') { refreshObjectives(); }
  if (typeof updateAchievements === 'function') { updateAchievements(); }

  /* ------------------------------------------------------------
     NEW IN THE 2D GAME
     A scenario is no longer pushed onto the screen. Instead it is
     attached to its station, with a glowing marker, and the
     player has to physically walk over and press E to deal with it.
     ------------------------------------------------------------ */
  var eventKey = resolveEventKey();
  game.stationEventKey = eventKey || null;
  game.stationEvent = eventKey ? (EVENT_STATION[eventKey] || null) : null;

  /* A structure with an open challenge on it gets a marker too, even
     when no scripted scenario is scheduled for today. Walking to it
     is how the player answers the challenge. */
  var host = typeof activeChallengeHost === 'function' ? activeChallengeHost() : null;
  if (host && !game.stationEvent) {
    game.stationEvent = host;
  }

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

/* The astronaut pressed E next to a structure. `stationId` is the id
   of that one placed structure, which is unique even when a base
   holds two structures of the same kind. */
function openStation(stationId) {
  if (game.finished || game.stationOpen || game.advancing) { return; }

  var station = findPlacedStation(stationId);
  if (!station) { return; }

  /* If today's scenario is hosted by this KIND of structure, run the
     normal decision flow. */
  if (game.stationEvent === station.type && game.stationEventKey && !game.decisionLocked) {
    showEvent(game.stationEventKey);
    openStationPanel();
    return;
  }

  showStationPanel(station);
}

/* Find one placed structure by its unique id. */
function findPlacedStation(stationId) {
  if (typeof STATIONS === 'undefined') { return null; }
  for (var i = 0; i < STATIONS.length; i++) {
    if (STATIONS[i].id === stationId) { return STATIONS[i]; }
  }
  return null;
}

function showStationPanel(station) {
  if (!station) { return; }
  var type = station.type;

  game.stationOpen = true;

  el('event-kind').textContent = 'System Check';
  el('event-title').textContent = station.name;
  el('event-story').textContent = station.blurb;
  el('event-options').innerHTML = '';
  el('event-result').hidden = true;
  el('btn-next-day').hidden = true;

  var statusText = STATION_STATUS[type] ? STATION_STATUS[type](station) : '';
  var already = !!game.serviced[type];
  var service = STATION_SERVICE[type];

  /* Phase 3: reading a structure's readout is a survey, and surveying
     enough of them completes the science objective. Four different
     kinds, so walking the length of the base once is enough. */
  if (typeof noteSurvey === 'function') { noteSurvey(type); }

  var html = '';
  html += '<div class="station-readout">' + statusText + '</div>';

  /* ---- Phase 5: an open challenge, answered here ----
     The challenge lives at the structure that is broken, so this is
     where it is answered. It sits above the ordinary service action
     because it is more urgent. */
  if (typeof challengesAtHost === 'function') {
    var open = challengesAtHost(type);
    for (var c = 0; c < open.length; c++) {
      html += challengePanelHtml(open[c]);
    }
  }

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

  bindChallengeOptions();

  var serviceBtn = el('btn-service');
  if (serviceBtn) { serviceBtn.addEventListener('click', function () { doService(type); }); }
  el('btn-leave-station').addEventListener('click', function () {
    game.dayLog.push({ key: 'day', amount: 0, note: 'Moved on without a task' });
    el('btn-next-day').hidden = false;
    el('btn-next-day').disabled = false;
    el('event-options').innerHTML = '';
  });

  if (window.world && world.playWork) { world.playWork(24); }
  openStationPanel();
}

/* Answer a challenge from the station panel. Kept apart from
   doService() because a challenge is a one-shot decision with its own
   success test, while a service is a repeatable-per-mission action. */
function answerChallenge(challengeId, optionIndex) {
  var result = resolveChallenge(challengeId, optionIndex);
  if (!result.ok) { return result; }

  /* Objectives and achievements are refreshed after the answer, so a
     challenge that just settled its objective shows immediately. */
  if (typeof refreshObjectives === 'function') { refreshObjectives(); }
  if (typeof updateAchievements === 'function') { updateAchievements(); }

  rememberValues();
  renderAll();

  var tone = result.outcome === 'success' ? 'good' :
             (result.outcome === 'fail' ? 'bad' : 'warn');
  var heading = result.outcome === 'success' ? 'Challenge settled' :
                (result.outcome === 'fail' ? 'Challenge failed' : 'Patched, not fixed');

  showResult({
    tone: tone,
    heading: heading,
    story: result.note,
    entries: game.dayLog.slice(),
    lesson: result.outcome === 'success'
      ? 'Fixing the cause rather than the symptom is what makes a problem stay fixed.'
      : (result.outcome === 'fail'
          ? 'Leaving a real problem alone does not make it smaller. It only makes it later.'
          : 'A patch buys time. It does not buy the mission.')
  });

  el('event-options').innerHTML = '';
  el('btn-next-day').hidden = false;
  el('btn-next-day').disabled = false;

  if (window.world) {
    world.bump(result.outcome === 'success' ? 3 : 5);
    world.playWork(46);
  }

  /* Settling the last primary objective ends the mission, exactly as
     answering an event would. */
  checkWin();
  return result;
}

/* Actually perform the station service action. Keyed by structure
   type, so a base with two depots services the depot type once. */
function doService(stationType) {
  if (game.finished || game.serviced[stationType]) { return; }

  var service = STATION_SERVICE[stationType];
  if (!service) { return; }

  game.serviced[stationType] = true;
  applyDeltas(service.deltas);
  applyMods(service.mods);

  /* Phase 3: servicing is also what puts the machine back to new. This
     is the reason a supply depot is worth building - the spares slow
     the daily wear, and the service visit reverses it completely. */
  if (typeof serviceSystem === 'function' && typeof SERVICE_SYSTEM === 'object') {
    var system = SERVICE_SYSTEM[stationType];
    if (system && serviceSystem(system)) {
      game.dayLog.push({
        key: 'day',
        amount: 0,
        note: (FAULT_NAMES[system] || 'This system') + ' back to full condition'
      });
    }
  }

  rememberValues();
  renderAll();

  showResult({
    tone: 'good',
    heading: stationType.charAt(0).toUpperCase() + stationType.slice(1) + ' Serviced',
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

  /* Phase 3: collecting is also the exploration task, so it counts
     towards the science objective as well as topping up a bar. */
  game.explored = game.pickupsCollected;
  if (typeof noteExploration === 'function') { noteExploration(); }

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
   ------------------------------------------------------------

   The score is still out of 100 and the five bands are unchanged:
   objectives 30, crew survival 25, health 15, supplies 20,
   efficiency 10.

   Phase 5 split the objective band in two so that optional work is
   visibly worth something without ever being required:

     primary objectives   24 points
     optional objectives   6 points

   Still 30 in total. Achievements add NOTHING - they are badges, and
   `sanitizeMission()` in mission.js re-checks that the score cannot
   leave 0-100 or survive a late arrival after either band has been
   added. */

var SCORE_BAND_OBJECTIVES = 30;
var SCORE_BAND_PRIMARY = 24;
var SCORE_BAND_OPTIONAL = 6;

function calculateScore() {
  /* Each band is scored as a proportion and rounded, so the two
     together can never come to more than the 30 they are worth. */
  var pTotal = primaryObjectivesTotal();
  var oTotal = optionalObjectivesTotal();

  var primaryPoints = (pTotal > 0)
    ? Math.round((SCORE_BAND_PRIMARY * primaryObjectivesDone()) / pTotal)
    : 0;
  var optionalPoints = (oTotal > 0)
    ? Math.round((SCORE_BAND_OPTIONAL * optionalObjectivesDone()) / oTotal)
    : 0;

  /* Belt and braces: the bands are declared to be worth 30, so the
     two together are clamped to that even if a future edit makes the
     arithmetic drift. */
  var objectivePoints = clamp(primaryPoints + optionalPoints, 0, SCORE_BAND_OBJECTIVES);

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
  return clamp(Math.round(total), 0, 100);
}

function endMission(success, reason) {
  if (game.finished) { return; }

  game.finished = true;
  game.success = success;
  game.failReason = reason;

  /* Phase 3 + Phase 5, and the ORDER MATTERS.

     sanitizeMission() runs FIRST. It is what turns a success that
     arrived after the 16 day limit back into a failure, and until it
     has run, `game.success` may still be lying.

     Only then are the end-of-mission objectives and badges judged, so
     no achievement can ever be handed out for a mission that was
     about to be downgraded to a failure. */
  if (typeof sanitizeMission === 'function') { sanitizeMission(); }

  /* Two objectives - finishing with every supply high, and finishing
     with the whole base serviced - are about the final state and are
     simply unknowable during play. completeObjective() and awardOnce()
     are both idempotent, so running this more than once is harmless. */
  if (typeof refreshObjectives === 'function') { refreshObjectives(); }
  if (typeof updateAchievements === 'function') { updateAchievements(); }

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
  el('r-objectives').textContent = objectivesDone() + ' of ' + objectivesTotal() +
    '  (primary ' + primaryObjectivesDone() + '/' + primaryObjectivesTotal() + ')';
  el('r-decisions').textContent = game.goodChoices + ' good / ' + game.badChoices + ' poor';

  /* ---- Phase 5: challenges handled ---- */
  var rChal = el('r-challenges');
  if (rChal) {
    var settled = challengesSettled();
    rChal.textContent = settled + ' settled / ' +
      (CHALLENGES.length - settled) + ' not settled';
  }

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

  /* ---- objectives, split into required and optional ---- */
  var objHtml = '';
  var shown = availableObjectives();
  for (var j = 0; j < shown.length; j++) {
    var obj = shown[j];
    var done = !!game.completed[obj.id];
    var label = obj.text;
    if (!isPrimary(obj)) { label += ' <em class="obj-optional">(optional)</em>'; }
    objHtml +=
      '<li class="' + (done ? 'done' : '') + (isPrimary(obj) ? ' is-primary' : ' is-optional') + '">' +
        '<span class="obj-icon" aria-hidden="true">' + (done ? '✔' : '✘') + '</span>' +
        '<span>' + label + '</span>' +
      '</li>';
  }

  /* Objectives that were on the table but are not any more, because
     the base or the site stopped supporting them. Saying so is better
     than silently dropping a line the player remembers seeing. */
  var all = allObjectives();
  for (var u = 0; u < all.length; u++) {
    var was = all[u];
    var present = false;
    for (var p2 = 0; p2 < shown.length; p2++) { if (shown[p2].id === was.id) { present = true; } }
    if (present) { continue; }
    objHtml +=
      '<li class="is-unavailable">' +
        '<span class="obj-icon" aria-hidden="true">&mdash;</span>' +
        '<span>' + was.text + ' <em class="obj-optional">(not available on this base or site)</em></span>' +
      '</li>';
  }
  el('result-objectives').innerHTML = objHtml;

  renderResultChallenges();
  renderResultAchievements();

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

  /* ---- Phase 3: what the base and the science tasks cost you ---- */
  if (typeof EXPLORE_TARGET === 'number' && game.explored < EXPLORE_TARGET) {
    tips.push('You only logged ' + game.explored + ' of ' + EXPLORE_TARGET +
      ' canisters. Walking the length of the base once is enough for the science task.');
  }
  var surveyedCount = Object.keys(game.surveyed || {}).length;
  var surveyNeed = (typeof missionSurveyTarget === 'function')
    ? missionSurveyTarget()
    : (typeof SURVEY_TARGET === 'number' ? SURVEY_TARGET : 4);
  if (surveyedCount < surveyNeed) {
    tips.push('You inspected ' + surveyedCount + ' structures. Reading ' + surveyNeed +
      ' different readouts signs off the survey, and it costs nothing but walking.' +
      (typeof iceConfirmedAt === 'function' && iceConfirmedAt(game.zoneId)
        ? ' At a crater where ice was actually measured, that target is lower.' : ''));
  }
  if (game.maint && typeof MAINT_SYSTEMS !== 'undefined') {
    var worstSystem = null;
    var worstCondition = 100;
    for (var mi = 0; mi < MAINT_SYSTEMS.length; mi++) {
      var ms = MAINT_SYSTEMS[mi];
      if (typeof game.maint[ms] === 'number' && game.maint[ms] < worstCondition) {
        worstCondition = game.maint[ms];
        worstSystem = ms;
      }
    }
    if (worstSystem && worstCondition < 70) {
      tips.push('The ' + (FAULT_NAMES[worstSystem] || worstSystem).toLowerCase() +
        ' finished at ' + Math.round(worstCondition) + '% condition. Servicing a ' +
        'structure puts it back to 100%, and a supply depot slows the wear in the first place.');
    }
  }
  if (game.storms > 0) {
    tips.push('This mission saw ' + game.storms + ' dust storm' + (game.storms > 1 ? 's' : '') +
      '. Dusty sites wear equipment faster and catch more storms.');
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

/* A short, plain explanation of why the mission ended the way it did.

   This is the single most useful sentence on the results screen, and
   it deliberately picks ONE decisive fact rather than listing
   everything: a player who reads one line should know what to do
   differently next time. */
function outcomeExplanation() {
  var pMissing = primaryObjectivesTotal() - primaryObjectivesDone();

  if (game.day > MISSION_LENGTH_DAYS) {
    return 'Why: you ran out of mission days with ' + pMissing +
      ' required objective(s) still open. The ' + MISSION_LENGTH_DAYS +
      '-day limit is absolute - a mission that runs past it is a ' +
      'failure however much else was achieved.';
  }
  if (game.health <= 0) {
    return 'Why: crew health reached zero. Health falls fastest when a ' +
      'supply runs out, so the vital bars were the thing to watch.';
  }
  if (game.oxygen <= 0) {
    return 'Why: the oxygen store ran out. Nothing on the Moon can replace ' +
      'air you already have - it has to come from the scrubber or the tanks.';
  }
  if (game.water <= 0) {
    return 'Why: the water store ran out. Recycling is what makes a lunar ' +
      'base possible at all; an unfiltered loop loses every drop.';
  }
  if (game.food <= 0) {
    return 'Why: the food store ran out. Stored rations come from Earth, ' +
      'and a crop that stops producing never starts again.';
  }
  if (game.success) {
    if (game.day <= 10) {
      return 'Why: you met every required objective and got the crew home ' +
        'in ' + game.day + ' days, well inside the ' + MISSION_LENGTH_DAYS +
        '-day limit. A faster mission scores the same on objectives but ' +
        'leaves more margin for the next one.';
    }
    return 'Why: you met every required objective and brought the crew home ' +
      'inside the ' + MISSION_LENGTH_DAYS + '-day limit.';
  }
  return 'Why: the mission ended with ' + pMissing + ' required objective(s) ' +
    'outstanding. Required objectives are what turn a mission into a ' +
    'successful one; optional ones only add points.';
}

/* The challenge list on the results screen: what came up, how it
   ended, and what it cost. Every challenge in the catalogue appears,
   including the ones that never arose, because "that never came up"
   is itself information. */
function renderResultChallenges() {
  var box = el('result-challenges');
  if (!box || typeof challengeHistory !== 'function') { return; }

  var history = challengeHistory();
  var html = '';

  for (var i = 0; i < history.length; i++) {
    var entry = history[i];
    var cls = 'ch-entry is-' + entry.status;
    html +=
      '<li class="' + cls + '">' +
        '<span class="ch-icon" aria-hidden="true">' + entry.def.icon + '</span>' +
        '<span class="ch-body">' +
          '<span class="ch-title">' + entry.def.title + '</span>' +
          '<span class="ch-outcome">' + challengeOutcomeText(entry) + '</span>' +
          (entry.note ? '<span class="ch-note">' + entry.note + '</span>' : '') +
        '</span>' +
      '</li>';
  }

  var repairs = (game.repairsMade || 0);
  var failed = (game.challengesFailed || 0);
  var handled = (game.emergenciesHandled || 0);
  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

  html +=
    '<li class="ch-summary">' +
      '<span class="ch-body">' +
        '<span class="ch-title">Totals</span>' +
        '<span class="ch-outcome">' + plural(repairs, 'repair') + ' made &middot; ' +
          plural(failed, 'failure') + ' &middot; ' +
          plural(handled, 'emergency') + ' handled</span>' +
        '<span class="ch-note">Deadlines and thresholds are ' +
          '<span class="tag tag-game">GAME ESTIMATE</span> values; the problems ' +
          'they describe are real.</span>' +
      '</span>' +
    '</li>';

  box.innerHTML = html;
}

/* Achievements on the results screen. Earned ones first and in full;
   locked ones are shown greyed with their condition, so the player can
   see what the game is asking for without it being a mystery. */
function renderResultAchievements() {
  var box = el('result-achievements');
  if (!box || typeof ACHIEVEMENTS === 'undefined') { return; }

  var html = '';
  var earned = 0;

  for (var i = 0; i < ACHIEVEMENTS.length; i++) {
    var a = ACHIEVEMENTS[i];
    var got = !!(game.unlocked && game.unlocked[a.id]);
    if (got) { earned++; }
    html +=
      '<div class="achievement' + (got ? ' is-earned' : ' is-locked') + '">' +
        '<span class="ach-icon" aria-hidden="true">' + a.icon + '</span>' +
        '<span class="ach-body">' +
          '<span class="ach-name">' + a.name + '</span>' +
          '<span class="ach-blurb">' + a.blurb + '</span>' +
        '</span>' +
        '<span class="ach-state">' + (got ? 'Earned day ' + game.unlocked[a.id] : 'Locked') + '</span>' +
      '</div>';
  }

  box.innerHTML =
    '<p class="ach-summary">' + earned + ' of ' + ACHIEVEMENTS.length + ' earned. ' +
    'These are badges - they are worth no points and change no outcome.</p>' +
    html;
}

function buildReport() {
  var done = objectivesDone();
  var alive = crewAlive();
  var parts = [];

  var zone = (typeof zoneById === 'function') ? zoneById(game.zoneId) : null;
  if (zone) {
    parts.push('You landed at ' + zone.name + ' (' + zone.coords + ').');
  }

  /* Phase 4: what the record actually says about this crater, so the
     choice can be checked against the evidence after the fact. */
  if (typeof lunarSiteSummary === 'function') {
    var lunarNote = lunarSiteSummary(game.zoneId);
    if (lunarNote) { parts.push(lunarNote); }
  }

  /* ---- Phase 5: the one-paragraph explanation of the outcome ----
     Placed first in the report so the player reads WHY before the
     detail. It names the decisive fact, not a formula. */
  parts.push(outcomeExplanation());

  if (game.success) {
    parts.push('Mission success. You completed all ' + primaryObjectivesTotal() +
      ' required objectives in ' + Math.min(game.day, MISSION_LENGTH_DAYS) +
      ' days, plus ' + optionalObjectivesDone() + ' of ' +
      optionalObjectivesTotal() + ' optional ones.');
  } else {
    parts.push('Mission failed. ' + game.failReason + ' You completed ' +
      primaryObjectivesDone() + ' of ' + primaryObjectivesTotal() +
      ' required objectives and ' + done + ' in total.');
  }

  /* ---- Phase 5: the challenges, in one sentence ---- */
  parts.push('You settled ' + challengesSettled() + ' of ' + CHALLENGES.length +
    ' mission challenges and made ' + (game.repairsMade || 0) +
    ' repair(s), with ' + (game.challengesFailed || 0) + ' failure(s).');
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

  /* ---- Phase 3: say what the base and the site actually did ---- */
  if (game.lastBalance) {
    parts.push('Your base averaged ' +
      signed1(game.lastBalance.power) + ' power, ' +
      signed1(game.lastBalance.oxygen) + ' oxygen, ' +
      signed1(game.lastBalance.water) + ' water and ' +
      signed1(game.lastBalance.food) + ' food a day on the last day. ' +
      'These are game values, not NASA mission figures.');
  }

  var surveyedTotal = Object.keys(game.surveyed || {}).length;
  parts.push('The crew logged ' + game.explored + ' canister(s) and inspected ' +
    surveyedTotal + ' structure type(s).');

  if (game.storms > 0) {
    parts.push('The mission saw ' + game.storms + ' dust storm' +
      (game.storms > 1 ? 's' : '') + '.');
  }

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

  /* If the panel is not on the page there is nothing to fill, and the
     mission must not depend on it. */
  if (!statusBox || !listBox) { return; }

  statusBox.className = 'nasa-status';
  statusBox.textContent = 'Loading NASA Open Data...';
  listBox.innerHTML = '';

  if (typeof fetch !== 'function') {
    statusBox.className = 'nasa-status error';
    statusBox.textContent = 'This browser cannot load live NASA data. The game works normally without it.';
    return;
  }

  NASA_QUERIES.forEach(function (query) {
    nasaFetch(nasaSearchUrl(query))
      .then(function (data) {
        var found = nasaFirstResult(data);
        /* A search that legitimately returns nothing is shown as an
           empty result, not dressed up as a network failure. */
        if (!found) { addNasaEmptyItem(query); return; }
        addNasaItem(found, query);
      })
      .catch(function (err) {
        addNasaErrorItem(query, err);
      });
  });
}

function addNasaItem(found, query) {
  var listBox = el('nasa-list');
  if (!listBox) { return; }

  var li = document.createElement('li');
  li.innerHTML = nasaItemHtml(found, query);
  listBox.appendChild(li);
  updateNasaStatus();
}

function addNasaEmptyItem(query) {
  var listBox = el('nasa-list');
  if (!listBox) { return; }
  var li = document.createElement('li');
  li.innerHTML =
    '<span class="n-title">No images for "' + cleanText(query) + '"</span>' +
    '<span class="n-note">NASA\'s library has nothing matching this search. ' +
    'Try a different term on images.nasa.gov.</span>';
  listBox.appendChild(li);
  updateNasaStatus();
}

function addNasaErrorItem(query, err) {
  var listBox = el('nasa-list');
  if (!listBox) { return; }
  var reason = (err && err.message) ? cleanText(err.message) : 'network error';
  var li = document.createElement('li');
  li.innerHTML =
    '<span class="n-title">Could not load "' + cleanText(query) + '"</span>' +
    '<span class="n-note">' + reason +
    ' The mission does not depend on this, and everything else still works.</span>';
  listBox.appendChild(li);
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

/* ============================================================
   16b. PHASE 4 - A REAL PHOTOGRAPH OF THE CRATER YOU PICKED
   ------------------------------------------------------------
   When a landing site is chosen, the map asks NASA's own library for
   a picture of that actual crater. The search term comes from
   lunar-data.js, which holds the IAU-approved name, so this searches
   for "Shackleton" and not "Shackleton crater surface mission" by
   accident.

   WHAT THIS IS NOT
   ----------------
   This is imagery and its catalogue metadata. It is NOT a scientific
   measurement. The library carries titles, descriptions and credits;
   it does not carry elevation, slope or illumination numbers, and
   nothing in this section treats it as though it did.

   NO SECRETS
   ---------
   This endpoint is public and needs no key, so there is nothing to
   hide and nothing to leak. Do not add one.
   ============================================================ */

/* How long to wait before giving up and telling the player why. A slow
   connection should end in an explanation, not a spinner that never
   stops. */
var NASA_TIMEOUT_MS = 12000;

/* The last site asked for, so a slow reply for an old site cannot
   overwrite the card for the one the player is actually looking at. */
var nasaSiteRequested = null;

function nasaSearchUrl(query) {
  return NASA_API + '?q=' + encodeURIComponent(query) +
         '&media_type=image&page_size=1';
}

/* One fetch, with a timeout. Resolves with the parsed JSON, or
   rejects with a short reason the UI can show. */
function nasaFetch(url, ms) {
  return new Promise(function (resolve, reject) {
    if (typeof fetch !== 'function') {
      reject(new Error('This browser cannot make network requests.'));
      return;
    }

    var settled = false;
    var controller = (typeof AbortController === 'function') ? new AbortController() : null;
    var timer = null;

    function finish(fn, arg) {
      if (settled) { return; }
      settled = true;
      if (timer) { clearTimeout(timer); }
      fn(arg);
    }

    if (controller) {
      timer = setTimeout(function () {
        try { controller.abort(); } catch (e) { /* older browsers */ }
        finish(reject, new Error('Timed out after ' + Math.round((ms || NASA_TIMEOUT_MS) / 1000) +
          ' seconds. The connection is too slow right now.'));
      }, ms || NASA_TIMEOUT_MS);
    }

    fetch(url, controller ? { signal: controller.signal } : undefined)
      .then(function (response) {
        if (!response.ok) {
          throw new Error('NASA returned HTTP ' + response.status + '.');
        }
        return response.json();
      })
      .then(function (data) { finish(resolve, data); })
      .catch(function (err) {
        if (err && err.name === 'AbortError') { return; }   /* already reported */
        finish(reject, new Error(err && err.message ? err.message : 'Could not reach NASA.'));
      });
  });
}

/* Pull the first usable image out of a search response, or null. */
function nasaFirstResult(data) {
  var items = data && data.collection && data.collection.items;
  if (!items || items.length === 0) { return null; }
  if (!items[0].data || !items[0].data[0]) { return null; }
  return {
    record: items[0].data[0],
    thumb: items[0].links && items[0].links[0] ? items[0].links[0].href : ''
  };
}

/* One result card. Shared by the general panel and the per-site panel
   so the attribution looks identical in both. */
/* A tiny local escaper for a URL we built ourselves. The only untrusted
   strings reaching the NASA panel come from NASA's own API, but a
   broken response should never be able to inject markup into the
   page, and every href has to be an http(s) URL and nothing else. */
function safeHttpUrl(url) {
  var s = String(url === undefined || url === null ? '' : url);
  if (!/^https?:\/\//i.test(s)) { return '#'; }
  return s.replace(/"/g, '%22').replace(/</g, '%3C').replace(/>/g, '%3E');
}

function nasaItemHtml(found, contextLabel, extraClass) {
  var record = found.record;
  var details = 'https://images.nasa.gov/details/' + encodeURIComponent(record.nasa_id);

  return '<li class="nasa-item' + (extraClass ? ' ' + extraClass : '') + '">' +
    '<span class="n-title">' + cleanText(record.title) + '</span>' +
    '<span class="n-note">' +
      'NASA ID ' + cleanText(record.nasa_id) +
      (record.center ? ' &middot; ' + cleanText(record.center) : '') +
      ' &middot; ' + formatDate(record.date_created) +
    '</span>' +
    (found.thumb
      ? '<img class="n-thumb" src="' + safeHttpUrl(found.thumb) + '" alt="" loading="lazy" ' +
        'onerror="this.style.display=\'none\'">'
      : '') +
    '<a class="n-link" href="' + safeHttpUrl(details) + '" target="_blank" rel="noopener">View on images.nasa.gov</a>' +
    '<span class="n-credit">Image: NASA Image and Video Library' +
      (record.center ? ' / ' + cleanText(record.center) : '') +
      ' &middot; NASA ID ' + cleanText(record.nasa_id) + '</span>' +
    (contextLabel ? '<span class="n-note">Search term: "' + cleanText(contextLabel) + '"</span>' : '') +
  '</li>';
}

function nasaSiteStatus(message, cls) {
  var box = el('site-images');
  if (!box) { return; }
  box.className = 'site-images';
  box.innerHTML = '<p class="site-images-status' + (cls ? ' ' + cls : '') + '">' + message + '</p>';
}

/* Fetch one real photograph of the selected crater. Called from the map
   after the site card is already on screen, so nothing here can make
   the map feel slow. */
function loadSiteImage(zone) {
  if (!zone) { return; }
  var box = el('site-images');
  if (!box) { return; }

  var name = (typeof lunarSearchName === 'function') ? lunarSearchName(zone) : zone.name;
  if (!name) { return; }

  nasaSiteRequested = zone.id;
  nasaSiteStatus('Looking for a NASA photograph of ' + cleanText(name) + '...', 'is-loading');

  /* The search term is the bare crater name. That was tested against
     the live API: "tycho" returns a real Tycho image, while
     "tycho moon" returns a generic picture of Earth and the Moon, and
     the polar craters return nothing at all under any phrasing. So
     the honest answer for most of this map is "the archive does not
     have one", which is what the panel below says. */
  nasaFetch(nasaSearchUrl(name))
    .then(function (data) {
      if (nasaSiteRequested !== zone.id) { return; }

      var found = nasaFirstResult(data);

      /* An empty result is not an error, and it is not the fault of
         this game: NASA's library really does not hold a photograph of
         this crater. Say so, and hand over a link so the player can
         keep looking. */
      if (!found) {
        var link = 'https://images.nasa.gov/search?q=' + encodeURIComponent(name);
        nasaSiteStatus(
          'NASA\'s Image and Video Library has no photograph of ' + cleanText(name) + '. ' +
          'That is a real gap in the archive - most of these polar craters have never been ' +
          'photographed from close range - not a fault in this game. ' +
          'Try <a href="' + safeHttpUrl(link) + '" target="_blank" rel="noopener">searching images.nasa.gov yourself</a>.',
          'is-empty');
        return;
      }

      box.className = 'site-images';
      box.innerHTML =
        '<h4 class="site-images-head">A real place <span class="tag tag-fact">NASA IMAGE</span></h4>' +
        '<ul class="nasa-list">' + nasaItemHtml(found, name, 'nasa-item-featured') + '</ul>';
    })
    .catch(function (err) {
      if (nasaSiteRequested !== zone.id) { return; }
      nasaSiteStatus(
        'Could not load the photograph: ' + cleanText(err && err.message ? err.message : 'network error') +
        ' The map and the game still work normally.',
        'is-error');
    });
}

/* ------------------------------------------------------------
   SECTION 17: BUTTONS AND KEYBOARD
   ------------------------------------------------------------ */

function goBackToWelcome() {
  showScreen('welcome');
}

/* The landing map owns its own buttons, but wiring them here keeps
   every listener in one place like the rest of the game. */
function wireUpMap() {
  if (typeof el !== 'function') { return; }

  var back = el('btn-map-back');
  if (back) { back.addEventListener('click', goBackToWelcome); }

  var confirm = el('btn-confirm-site');
  if (confirm) {
    confirm.addEventListener('click', function () {
      if (typeof confirmLandingSite === 'function') { confirmLandingSite(); }
    });
  }

  if (typeof setupMapInput === 'function') { setupMapInput(); }
  if (typeof setupBuilderInput === 'function') { setupBuilderInput(); }

  var backToMap = el('btn-build-back');
  if (backToMap) {
    backToMap.addEventListener('click', function () {
      if (typeof builderBackToMap === 'function') { builderBackToMap(); }
    });
  }
}

function wireUp() {
  /* Every "Start Mission" button now opens the landing map first,
     because choosing a site is the first step of a mission. */
  if (typeof openMap === 'function') {
    el('btn-start').addEventListener('click', openMap);
  } else {
    el('btn-start').addEventListener('click', startMission);
  }

  el('btn-howto').addEventListener('click', function () { showScreen('howto'); });
  el('btn-learn').addEventListener('click', function () { showScreen('learn'); });
  el('btn-learn-again').addEventListener('click', function () { showScreen('learn'); });
  el('btn-home').addEventListener('click', goBackToWelcome);

  var goStart = document.querySelectorAll('.js-go-start');
  for (var i = 0; i < goStart.length; i++) {
    goStart[i].addEventListener('click', function () {
      if (typeof openMap === 'function') { openMap(); } else { startMission(); }
    });
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

/* Phase 5 is optional, in the same way world.js and mission.js are.

   challenges.js adds challenges, badges and optional objectives. If it
   is ever missing, the six required objectives are still a complete
   mission - the player simply does not get the extras. Everything the
   rest of this file calls from that module is stubbed here, once, so
   there is exactly one place that has to know.

   Every stub returns the safe, empty answer. None of them can invent a
   challenge, a badge or an objective that is not really there. */
if (typeof challengesSettled !== 'function') {
  var CHALLENGES = [];
  function challengesSettled() { return 0; }
  function challengeHistory() { return []; }
  function challengeOutcomeText() { return ''; }
  function challengesAtHost() { return []; }
  function activeChallengeHost() { return null; }
  function achievementsUnlocked() { return []; }
}

game = createNewGame();

/* Phase 3 state is owned by mission.js. It is merged in rather than
   written here so the numbers that drive the simulation all live in
   one place, and so this file still works if that file is ever
   missing. */
function applyMissionState(state) {
  if (!state) { return; }
  game.maint = state.maint || {};
  game.faults = state.faults || {};
  game.pendingEmergency = state.pendingEmergency || null;
  game.explored = state.explored || 0;
  game.surveyed = state.surveyed || {};
  game.lastBalance = state.lastBalance || null;
  game.storms = state.storms || 0;
}

/* Phase 5 state, merged the same way. Reached only from startMission()
   and from the page-load bootstrap, so there is one place that decides
   what a fresh mission looks like. */
function applyChallengeState(state) {
  if (!state) { return; }
  game.challenges = state.challenges || {};
  game.awarded = state.awarded || {};
  game.unlocked = state.unlocked || {};
  game.repairsMade = state.repairsMade || 0;
  game.emergenciesHandled = state.emergenciesHandled || 0;
  game.challengesFailed = state.challengesFailed || 0;
  game.lowestSeen = state.lowestSeen || {};
}
applyMissionState((typeof missionNewState === 'function') ? missionNewState() : null);
applyChallengeState((typeof challengeNewState === 'function') ? challengeNewState() : null);

wireUp();
wireUpMap();
showScreen('welcome');
