/* ============================================================
   PHASE 5 - MISSION CHALLENGES AND ACHIEVEMENTS
   ------------------------------------------------------------
   Two things live here.

   1. CHALLENGES. Six survival problems that do not wait for a
      scripted day. They fire when the base actually gets into
      trouble - oxygen falling, power sagging, a recycler failing -
      and they have to be dealt with where the problem is: at the
      structure that is broken.

   2. ACHIEVEMENTS. Badges for things the mission did well. They are
      deliberately worth NO POINTS. See the note on scoring below.

   HONESTY
   -------
   The problems are real. The numbers are not.

     REAL SCIENCE   A leaking airlock really does lose cabin air. A
                    recycler filter really does clog with dust. Solar
                    panels really do lose output in low Sun and under
                    dust. A rover really does need power to drive.

     GAME ESTIMATE  Every threshold, every deadline, every reward
                    figure below. A real mission planner would have
                    flight rules; this is a teaching value.

   ACHIEVEMENTS AND THE SCORE
   --------------------------
   An achievement adds nothing to the score, and that is the whole
   design. The score is still the same five bands out of 100 that
   Phase 0 defined, and an achievement can never:
     - push the score above 100 or below 0
     - rescue a failed mission
     - excuse running past the 16 day limit

   `sanitizeMission()` re-checks all three every time the mission
   ends, so even a bug in this file cannot get around them.

   STATE SAFETY
   ------------
   Three rules this file never breaks:

     A challenge starts once. `startedDay` is written before anything
       else happens, so it can never be triggered twice in one day or
       re-triggered after being answered.

     A reward is paid once. Every award goes through `awardOnce()`,
       which records the id before it changes anything. Calling it
       twice for the same id is a no-op, not a second payment.

     A finished mission is finished. `activeChallenges()` returns
       nothing once the mission is over, so a late timer or a stray
       click cannot restart anything on the results screen.
   ============================================================ */

/* ------------------------------------------------------------
   1. THRESHOLDS - all GAME ESTIMATE
   ------------------------------------------------------------ */

/* When each problem becomes urgent enough to send a challenge. */
var CHALLENGE_TRIGGER = {
  airlock: 58,        /* oxygen below this and the airlock is leaking */
  brownout: 55,       /* power below this and the arrays cannot keep up */
  recycler: 48,       /* water below this and the loop is not returning  */
  rations: 45,        /* food below this and the stores are in trouble   */
  wear: 60            /* any system below this and it needs inspecting  */
};

/* What the resource has to reach for the fix to count as a real
   repair rather than a patch that slips again tomorrow. */
var CHALLENGE_SUCCESS_LEVEL = {
  oxygen: 66,
  power: 66,
  water: 56,
  food: 26
};

/* Conditions across every system that count as "looked after". */
var CHALLENGE_REPAIR_TARGET = 70;

/* ------------------------------------------------------------
   2. THE CHALLENGES
   ------------------------------------------------------------

   `host` is the STRUCTURE TYPE the player walks to. If the base does
   not have one, the challenge is recorded as unavailable rather than
   silently never appearing - the results screen says so.

   `deadlineDays` is how many days after it starts the player has.
   null means it has no deadline and is judged at the end instead.
   ------------------------------------------------------------ */

var CHALLENGES = [
  {
    id: 'airlock-leak',
    title: 'Seal the airlock leak',
    host: 'oxygen',
    icon: '🫧',
    brief: 'Oxygen is falling faster than the scrubber can put it back. ' +
           'Something is leaking. Get the store back above ' +
           CHALLENGE_SUCCESS_LEVEL.oxygen + ' within two days.',
    science: 'A cracked airlock seal does not empty a habitat quickly - it ' +
             'leaks slowly, which is worse in a way, because the crew can ' +
             'feel fine while the store quietly drops. Real crews seal the ' +
             'affected compartment and repressurise it from the tanks.',
    trigger: function (g) { return g.oxygen < CHALLENGE_TRIGGER.airlock; },
    triggerNote: 'Oxygen has dropped below ' + CHALLENGE_TRIGGER.airlock,
    deadlineDays: 2,
    successLevel: CHALLENGE_SUCCESS_LEVEL.oxygen,
    successKey: 'oxygen',
    options: [
      {
        label: 'Seal the damaged hatch and repressurise from the tanks',
        hint: 'Costs power and stored air, but it is an actual repair.',
        deltas: [
          { key: 'oxygen', amount: 16, note: 'Repressurised from the tanks' },
          { key: 'power', amount: -6, note: 'Pumps ran for hours' }
        ],
        restores: 'oxygen',
        outcome: 'success',
        note: 'The seal was reseated and the lock topped back up. The store ' +
              'climbed and, more importantly, stopped falling.'
      },
      {
        label: 'Patch it from the outside with a suit crew',
        hint: 'Cheap, and the patch may not hold.',
        deltas: [
          { key: 'oxygen', amount: 4, note: 'Temporary patch' },
          { key: 'health', amount: -5, note: 'Crew worked outside in a suit' }
        ],
        restores: 'oxygen',
        outcome: 'partial',
        note: 'The patch went on quickly and bought some air back. The seal ' +
              'is not sound, so this is a repair in name only.'
      },
      {
        label: 'Leave it. The crew are safe in the habitat',
        hint: 'Costs nothing today, and everything tomorrow.',
        deltas: [
          { key: 'oxygen', amount: -6, note: 'Leak left running' },
          { key: 'health', amount: -6, note: 'Crew breathing hard' }
        ],
        outcome: 'fail',
        note: 'Nobody is in danger, which is exactly why this looks safe. ' +
              'The store keeps falling anyway.'
      }
    ],
    failNote: 'The leak was never sealed and the oxygen store ran down.'
  },

  {
    id: 'brownout',
    title: 'Get the power back above the line',
    host: 'solar',
    icon: '⚡',
    brief: 'The arrays are not making enough to run the base. Bring ' +
           'electricity back above ' + CHALLENGE_SUCCESS_LEVEL.power +
           ' within two days.',
    science: 'Low Sun and a dusty array are the two things that take polar ' +
             'solar power away. Dust is electrostatic and clings to everything, ' +
             'so a panel that is never cleaned keeps losing output. Real crews ' +
             'also hold batteries in reserve for exactly this reason.',
    trigger: function (g) { return g.power < CHALLENGE_TRIGGER.brownout; },
    triggerNote: 'Electricity has dropped below ' + CHALLENGE_TRIGGER.brownout,
    deadlineDays: 2,
    successLevel: CHALLENGE_SUCCESS_LEVEL.power,
    successKey: 'power',
    options: [
      {
        label: 'Strip, clean and realign the arrays',
        hint: 'Uses power to get power back, and costs water for the solvent.',
        deltas: [
          { key: 'power', amount: 18, note: 'Arrays cleaned and realigned' },
          { key: 'water', amount: -5, note: 'Cleaning solvent' }
        ],
        restores: 'solar',
        outcome: 'success',
        note: 'Dust that had been building for days came off in strips. ' +
              'Output came straight back up.'
      },
      {
        label: 'Run the base off the batteries and leave the panels',
        hint: 'No repair today. The batteries are a finite store.',
        deltas: [
          { key: 'power', amount: 6, note: 'Panels parked, batteries eased' }
        ],
        restores: 'solar',
        outcome: 'partial',
        note: 'The base is out of immediate danger on stored charge. The ' +
              'arrays are still dirty, so nothing was actually fixed.'
      },
      {
        label: 'Cut the heating to protect the batteries',
        hint: 'Saves power now and costs the crew their warmth.',
        deltas: [
          { key: 'power', amount: 2, note: 'Heating cut back' },
          { key: 'health', amount: -8, note: 'Crew working in a cold base' },
          { key: 'food', amount: -6, note: 'Crops got less heat and light' }
        ],
        outcome: 'fail',
        note: 'The base stayed just above the line by making everyone colder ' +
              'and the crops worse. That is not a repair.'
      }
    ],
    failNote: 'Power generation was never restored.'
  },

  {
    id: 'recycler-failure',
    title: 'Restart the water recycler',
    host: 'water',
    icon: '💧',
    brief: 'The recycling loop is down and water is now leaving the store ' +
           'faster than it comes back. Get it above ' +
           CHALLENGE_SUCCESS_LEVEL.water + ' within two days.',
    science: 'A water recycler passes everything through filters, and lunar ' +
             'dust gets into filters. Once the loop stops, every drop used is ' +
             'a drop lost - which is why recycling, not storage, is what makes ' +
             'a lunar base survivable at all.',
    trigger: function (g) {
      return g.water < CHALLENGE_TRIGGER.recycler ||
             (typeof systemFailed === 'function' && systemFailed('water'));
    },
    triggerNote: 'Water has dropped below ' + CHALLENGE_TRIGGER.recycler +
                 ' or the recycler has failed',
    deadlineDays: 2,
    successLevel: CHALLENGE_SUCCESS_LEVEL.water,
    successKey: 'water',
    options: [
      {
        label: 'Strip and rebuild the filter',
        hint: 'Uses power and water, and the loop comes back.',
        deltas: [
          { key: 'water', amount: 16, note: 'Filter rebuilt' },
          { key: 'power', amount: -6, note: 'Pumps ran' }
        ],
        restores: 'water',
        outcome: 'success',
        note: 'The filter was stripped, cleared and put back. From today the ' +
              'base cleans its water instead of losing it.'
      },
      {
        label: 'Send the rover out for ice',
        hint: 'The most water possible, at the price of the batteries.',
        deltas: [
          { key: 'water', amount: 26, note: 'Ice collected by the rover' },
          { key: 'power', amount: -18, note: 'Rover drilling used power' }
        ],
        restores: 'water',
        outcome: 'partial',
        note: 'The rover came back loaded, which is a real gain. The loop is ' +
              'still down, so tomorrow costs exactly as much as today.'
      },
      {
        label: 'Cut the crops and drink what is in store',
        hint: 'Keeps the crew watered and ends food production.',
        deltas: [
          { key: 'water', amount: 12, note: 'Emergency water drawn' },
          { key: 'food', amount: -12, note: 'Hydroponics drained' }
        ],
        outcome: 'fail',
        note: 'Nobody went thirsty and the food store took the damage instead. ' +
              'Every base has a chain, and this cut the wrong link.'
      }
    ],
    failNote: 'The water recycler was never restarted.'
  },

  {
    id: 'rations',
    title: 'Keep the food store above the line',
    host: 'food',
    icon: '🥗',
    brief: 'The stores are low and the crops are not keeping up. Keep food ' +
           'above ' + CHALLENGE_SUCCESS_LEVEL.food + ' for the rest of the ' +
           'mission. This one has no deadline - it is judged at the end.',
    science: 'Stored rations come from Earth and every kilogram costs a launch. ' +
             'Growing food on the Moon is the whole point, but a crop needs ' +
             'light, water and power continuously, and there is no spare seed ' +
             'if it fails.',
    trigger: function (g) { return g.food < CHALLENGE_TRIGGER.rations; },
    triggerNote: 'Food has dropped below ' + CHALLENGE_TRIGGER.rations,
    deadlineDays: null,
    /* Judged continuously rather than at a deadline. */
    continuous: true,
    successLevel: CHALLENGE_SUCCESS_LEVEL.food,
    successKey: 'food',
    options: [
      {
        label: 'Rebuild the grow lights and replant the trays',
        hint: 'Costs power today. Production comes back tomorrow.',
        deltas: [
          { key: 'food', amount: 8, note: 'Grow lights rebuilt' },
          { key: 'power', amount: -9, note: 'Lighting and pumps' }
        ],
        restores: 'food',
        outcome: 'success',
        note: 'The lights were rebuilt and fresh seedlings went in. The base ' +
              'is eating from itself again.'
      },
      {
        label: 'Open a depot crate and live off the stores',
        hint: 'Feeds everyone today and nothing at all tomorrow.',
        deltas: [
          { key: 'food', amount: 18, note: 'Depot crate opened' }
        ],
        restores: 'food',
        outcome: 'partial',
        note: 'Everyone ate well. The stores are emptier and nothing is growing.'
      },
      {
        label: 'Halve every ration to make the stores last',
        hint: 'Stretch the food, and pay for it in crew health.',
        deltas: [
          { key: 'food', amount: 10, note: 'Rations halved' },
          { key: 'health', amount: -7, note: 'Everyone eating less' }
        ],
        outcome: 'partial',
        note: 'The stores will hold. A crew on short rations works more slowly ' +
              'and makes more mistakes, and neither shows on a bar.'
      }
    ],
    failNote: 'The food store fell below ' + CHALLENGE_SUCCESS_LEVEL.food + '.'
  },

  {
    id: 'equipment-inspection',
    title: 'Inspect and service the whole base',
    host: 'console',
    icon: '🔧',
    brief: 'Something on this base is worn out. Get every system above ' +
           CHALLENGE_REPAIR_TARGET + '% condition within three days.',
    science: 'Lunar dust is jagged and electrostatically charged, so it gets ' +
             'into seals, scratches glass and jams filters. No base can just ' +
             'ignore it. Preventive maintenance is far cheaper than emergency ' +
             'maintenance, which is the single most repeated lesson of real ' +
             'spaceflight operations.',
    trigger: function (g) {
      if (typeof conditionOf !== 'function' || !g.maint) { return false; }
      for (var i = 0; i < MAINT_SYSTEMS.length; i++) {
        if (conditionOf(MAINT_SYSTEMS[i]) < CHALLENGE_TRIGGER.wear) { return true; }
      }
      return false;
    },
    triggerNote: 'A system has worn below ' + CHALLENGE_TRIGGER.wear + '% condition',
    deadlineDays: 3,
    /* Judged on every system, not on one bar. */
    allSystems: true,
    options: [
      {
        label: 'Run a full service on every system',
        hint: 'Costs a day of supplies and puts the whole base back to new.',
        deltas: [
          { key: 'power', amount: -8, note: 'Full service day' },
          { key: 'water', amount: -6, note: 'Cleaning and coolant' },
          { key: 'food', amount: -4, note: 'Long day without meals' }
        ],
        allSystemsRestored: true,
        outcome: 'success',
        note: 'Everything was stripped, cleaned and put back. The whole base ' +
              'is at full condition.'
      },
      {
        label: 'Service only the two worst systems',
        hint: 'Half the job, half the cost.',
        deltas: [
          { key: 'power', amount: -4, note: 'Partial service' },
          { key: 'water', amount: -3, note: 'Cleaning solvent' }
        ],
        restoreWorstTwo: true,
        outcome: 'partial',
        note: 'The worst of it was cleaned up. The rest is still wearing down.'
      },
      {
        label: 'Keep working. The base has coped so far',
        hint: 'Costs nothing today, and it will not cope much longer.',
        deltas: [
          { key: 'health', amount: -4, note: 'Crew carrying the slack' }
        ],
        outcome: 'fail',
        note: 'Nothing was serviced and the crew absorbed it. Condition kept ' +
              'falling on every system at once.'
      }
    ],
    failNote: 'The base was never properly serviced.'
  },

  {
    id: 'rover-expedition',
    title: 'Drive the rover on an ice expedition',
    host: 'depot',
    icon: '🛞',
    brief: 'Take the rover out to a shadowed crater and bring back ice. It ' +
           'has to be done before day 14, and the rover drinks electricity.',
    science: 'A rover is the only way to move material across the surface at ' +
             'the south pole, and the permanently shadowed craters are where ' +
             'the ice is. Driving there costs power the whole way, and the ' +
             'dust degrades the wheels and the solar panels on the rover too.',
    /* Starts on a day rather than on a resource level. */
    startOnDay: 7,
    triggerNote: 'The rover is available from day 7',
    deadlineDay: 14,
    /* There is no bar to check here: the expedition either happened or
       it did not, so the answer itself is the success test. */
    metByOutcome: true,
    options: [
      {
        label: 'Send the rover to the shadowed crater and drill for ice',
        hint: 'Costs a lot of power, and the crew gets its water back.',
        deltas: [
          { key: 'water', amount: 30, note: 'Ice brought back by the rover' },
          { key: 'power', amount: -22, note: 'Rover drive and drilling' },
          { key: 'health', amount: -4, note: 'Long shift monitoring the drive' }
        ],
        restores: 'solar',
        outcome: 'success',
        note: 'The rover reached the shadowed floor, drilled and came home ' +
              'loaded. It is the most expensive thing anyone did all mission.'
      },
      {
        label: 'Short survey drive, stay near the base',
        hint: 'Cheap, and it finds very little.',
        deltas: [
          { key: 'water', amount: 8, note: 'Surface ice scraped up' },
          { key: 'power', amount: -6, note: 'Short drive' }
        ],
        outcome: 'partial',
        note: 'The rover came back with a little surface ice from nearby ' +
              'ground. Useful, but not the expedition.'
      },
      {
        label: 'Leave it parked and protect the batteries',
        hint: 'Saves everything now, and the expedition never happens.',
        deltas: [
          { key: 'food', amount: -5, note: 'Supplies carried by hand instead' }
        ],
        outcome: 'fail',
        note: 'The rover stayed put and the crew carried what they could. ' +
              'No ice was collected.'
      }
    ],
    failNote: 'The rover expedition was not completed.'
  }
];

/* ------------------------------------------------------------
   3. CHALLENGE STATE
   ------------------------------------------------------------ */

var CHALLENGE_INDEX = {};
for (var ci = 0; ci < CHALLENGES.length; ci++) {
  CHALLENGE_INDEX[CHALLENGES[ci].id] = CHALLENGES[ci];
}

function challengeById(id) {
  return (id && CHALLENGE_INDEX[id]) ? CHALLENGE_INDEX[id] : null;
}

/* The per-mission state this file owns. Merged into `game` by
   applyChallengeState() the same way Phase 3 merged its own. */
function challengeNewState() {
  return {
    challenges: {},     /* id -> { status, startedDay, deadlineDay, outcome } */
    awarded: {},        /* anything that has already paid out, by id */
    unlocked: {},       /* achievement id -> day it was earned */
    repairsMade: 0,
    emergenciesHandled: 0,
    challengesFailed: 0,
    lowestSeen: {}      /* resource -> lowest value seen so far */
  };
}

/* ------------------------------------------------------------
   4. STARTING A CHALLENGE
   ------------------------------------------------------------ */

function challengeAvailable(def) {
  /* A challenge needs the structure it is hosted at. A base with no
     water recycler cannot be challenged to repair one. */
  if (typeof countOfType === 'function' && def.host) {
    return countOfType(def.host) > 0;
  }
  return true;
}

/* Start a challenge, if it is allowed to start right now.

   The state entry is written FIRST and marked 'active', which is what
   stops a second trigger on the same day from starting it twice. */
function startChallenge(id) {
  var def = challengeById(id);
  if (!def || !game || game.finished) { return false; }
  if (game.challenges[id]) { return false; }              /* already seen, in any form */
  if (!challengeAvailable(def)) { return false; }

  var deadline = def.deadlineDays !== null && def.deadlineDays !== undefined
    ? game.day + def.deadlineDays
    : (def.deadlineDay !== undefined ? def.deadlineDay : null);

  game.challenges[id] = {
    status: 'active',
    outcome: '',
    startedDay: game.day,
    deadlineDay: deadline,
    note: ''
  };
  return true;
}

/* ------------------------------------------------------------
   5. THE DAILY PASS
   Called once per day, from beginDay, after the resource cycle has
   run. Starts what should start and closes what has expired.
   ------------------------------------------------------------ */

function updateChallenges() {
  if (!game || game.finished) { return; }

  /* remember the lowest each resource has ever been, for the
     "comeback" achievement and the results screen */
  var keys = ['oxygen', 'water', 'food', 'power'];
  for (var k = 0; k < keys.length; k++) {
    var key = keys[k];
    if (typeof game.lowestSeen[key] !== 'number' || game[key] < game.lowestSeen[key]) {
      game.lowestSeen[key] = game[key];
    }
  }

  for (var i = 0; i < CHALLENGES.length; i++) {
    var def = CHALLENGES[i];
    var state = game.challenges[def.id];

    if (!state) {
      /* ---- start it? ---- */
      var due = false;
      if (def.startOnDay !== undefined) {
        due = (game.day >= def.startOnDay);
      } else if (typeof def.trigger === 'function') {
        due = def.trigger(game) === true;
      }
      if (due) { startChallenge(def.id); }
      continue;                 /* a freshly started challenge is not expired yet */
    }

    if (state.status !== 'active') { continue; }

    /* ---- continuous challenges are judged on the resource right now ---- */
    if (def.continuous) {
      if (game[def.successKey] < def.successLevel) {
        state.status = 'failed';
        state.outcome = 'fail';
        state.note = def.failNote;
        game.challengesFailed++;
      }
      continue;
    }

    /* ---- deadline ---- */
    if (state.deadlineDay !== null && game.day > state.deadlineDay) {
      /* Only a deadline failure if the success condition was not met.
         A partial answer still counts as answered - the deadline is
         about getting to the station, not about getting it perfect. */
      state.status = 'expired';
      state.outcome = 'expired';
      state.note = 'Too late: the deadline was day ' + state.deadlineDay + '.';
      game.challengesFailed++;
    }
  }
}

/* ------------------------------------------------------------
   6. ANSWERING A CHALLENGE
   ------------------------------------------------------------ */

/* The success test, which is different for every challenge. */
function challengeMetCondition(def) {
  /* A challenge with no bar to check is judged on the answer alone -
     the rover expedition either happened or it did not. */
  if (def.metByOutcome === true) { return true; }
  if (def.allSystems) {
    for (var i = 0; i < MAINT_SYSTEMS.length; i++) {
      if (conditionOf(MAINT_SYSTEMS[i]) < CHALLENGE_REPAIR_TARGET) { return false; }
    }
    return true;
  }
  return game[def.successKey] >= def.successLevel;
}

/* Apply one answer and close the challenge out. */
function resolveChallenge(id, optionIndex) {
  var def = challengeById(id);
  var state = game && game.challenges ? game.challenges[id] : null;

  if (!def || !state || state.status !== 'active' || game.finished) {
    return { ok: false, reason: 'That challenge is not open.' };
  }
  var option = def.options[optionIndex];
  if (!option) { return { ok: false, reason: 'No such option.' }; }

  applyDeltas(option.deltas);
  applyMods(option.mods);

  if (option.restores && typeof serviceSystem === 'function') {
    serviceSystem(option.restores);
  }
  if (option.allSystemsRestored && typeof serviceSystem === 'function') {
    for (var s = 0; s < MAINT_SYSTEMS.length; s++) { serviceSystem(MAINT_SYSTEMS[s]); }
  }
  if (option.restoreWorstTwo && typeof serviceSystem === 'function') {
    serviceSystem(worstSystem());
    serviceSystem(worstSystem());
  }

  /* The outcome is what the option says AND what the numbers now
     show. An option can promise a repair the store did not actually
     recover, and the store wins that argument. */
  var met = challengeMetCondition(def);
  var outcome = option.outcome;
  if (outcome === 'success' && !met) { outcome = 'partial'; }

  state.status = (outcome === 'success') ? 'done' :
                 (outcome === 'fail' ? 'failed' : 'partial');
  state.outcome = outcome;
  state.note = option.note;
  state.answeredDay = game.day;

  if (outcome === 'fail') {
    game.challengesFailed++;
  } else {
    game.emergenciesHandled++;
    game.repairsMade++;
  }

  return { ok: true, outcome: outcome, note: option.note, def: def };
}

function worstSystem() {
  var worst = null;
  var lowest = Infinity;
  for (var i = 0; i < MAINT_SYSTEMS.length; i++) {
    var s = MAINT_SYSTEMS[i];
    var c = conditionOf(s);
    if (c < lowest) { lowest = c; worst = s; }
  }
  return worst;
}

/* ------------------------------------------------------------
   7. ONE-TIME REWARDS
   The only function in this file allowed to change the mission for a
   reason other than a resource. It records the id FIRST, so a second
   call for the same id does nothing at all.
   ------------------------------------------------------------ */

function awardOnce(id, fn) {
  if (!game || !game.awarded) { return false; }
  if (game.awarded[id]) { return false; }
  game.awarded[id] = game.day;
  if (typeof fn === 'function') { fn(); }
  return true;
}

/* Mark an objective done. Idempotent: the second call is a no-op, so
   an objective can never be counted - or paid - twice. */
function completeObjective(id) {
  if (!game || !isRealObjective(id)) { return false; }
  if (game.completed[id]) { return false; }
  game.completed[id] = true;
  if (typeof noteExploration === 'function') { noteExploration(); }
  return true;
}

function challengesSettled() {
  var n = 0;
  for (var i = 0; i < CHALLENGES.length; i++) {
    var s = game.challenges && game.challenges[CHALLENGES[i].id];
    if (s && s.status === 'done') { n++; }
  }
  return n;
}

/* ------------------------------------------------------------
   8. OBJECTIVES THAT DEPEND ON THE MISSION
   ------------------------------------------------------------

   Phase 5 adds four optional objectives. Unlike the primary six, they
   are only offered when the base and the site can actually support
   them - an ice sample is pointless at a crater where no ice was ever
   found, and "service the whole base" needs a habitat to service.

   `available()` is checked every day, so an objective that becomes
   possible later (because a depot was built) can still appear.
   ------------------------------------------------------------ */

var PHASE5_OBJECTIVES = [
  {
    id: 'obj-challenges',
    text: 'Settle 3 mission challenges without failing one',
    optional: true,
    progress: function () { return challengesSettled(); },
    target: 3,
    available: function () { return true; }
  },
  {
    id: 'obj-ice-sample',
    text: 'Bring an ice sample back from the shadowed floor',
    optional: true,
    /* Only meaningful where ice was actually found, or found nearby.
       This is the Phase 4 record driving a Phase 5 objective. */
    available: function () {
      return typeof iceConfirmedAt === 'function' &&
             (iceConfirmedAt(game.zoneId) || iceNearby(game.zoneId));
    },
    progress: function () { return game.challenges && game.challenges['rover-expedition'] &&
                                     game.challenges['rover-expedition'].status === 'done' ? 1 : 0; },
    target: 1
  },
  {
    id: 'obj-serviceable',
    text: 'Finish the mission with every system above 70% condition',
    optional: true,
    /* Needs a habitat to rest in and a depot to hold spares - servicing
       a base you never built is not on the table. */
    available: function () {
      return typeof countOfType === 'function' &&
             countOfType('habitat') > 0 && countOfType('depot') > 0;
    },
    progress: function () {
      /* Judged at the end, exactly like obj-thrifty. A brand new base
         is already above 70% on every system, so without this guard
         this objective would be handed out on day one for nothing. */
      if (!game.finished) { return 0; }
      var all = true;
      for (var i = 0; i < MAINT_SYSTEMS.length; i++) {
        if (conditionOf(MAINT_SYSTEMS[i]) < CHALLENGE_REPAIR_TARGET) { all = false; }
      }
      return all ? 1 : 0;
    },
    target: 1
  },
  {
    id: 'obj-thrifty',
    text: 'Finish the mission with every supply above 70',
    optional: true,
    available: function () { return true; },
    progress: function () {
      if (!game.finished) { return 0; }
      var keys = ['oxygen', 'water', 'food', 'power'];
      for (var i = 0; i < keys.length; i++) {
        if (game[keys[i]] < 70) { return 0; }
      }
      return 1;
    },
    target: 1
  }
];

/* ------------------------------------------------------------
   9. ACHIEVEMENTS
   ------------------------------------------------------------
   Badges only. None of these adds a single point to the score, and
   none of them can turn a failure into a success or excuse running
   past day 16. `awardOnce()` is the only thing that unlocks one.
   ------------------------------------------------------------ */

var ACHIEVEMENTS = [
  {
    id: 'first-repair',
    name: 'First Repair',
    blurb: 'Settle your first mission challenge.',
    icon: '🔧',
    test: function () { return game.repairsMade >= 1; }
  },
  {
    id: 'clean-sweep',
    name: 'Clean Sweep',
    blurb: 'Settle three challenges and fail none.',
    icon: '✋',
    test: function () { return challengesSettled() >= 3 && game.challengesFailed === 0; }
  },
  {
    id: 'scratch-that',
    name: 'Nothing Broken',
    blurb: 'Finish with every system above 70% condition.',
    icon: '🛡',
    test: function () { return game.finished && allSystemsAbove(70); }
  },
  {
    id: 'thrifty',
    name: 'Thrift Shop',
    blurb: 'Finish with every supply above 70.',
    icon: '🪣',
    test: function () {
      if (!game.finished) { return false; }
      var keys = ['oxygen', 'water', 'food', 'power'];
      for (var i = 0; i < keys.length; i++) { if (game[keys[i]] < 70) { return false; } }
      return true;
    }
  },
  {
    id: 'pick-them-all',
    name: 'Every Canister',
    blurb: 'Collect all 8 supply canisters.',
    icon: '🫙',
    test: function () { return game.explored >= 8; }
  },
  {
    id: 'cartographer',
    name: 'Cartographer',
    blurb: 'Inspect all 8 kinds of structure.',
    icon: '🗺',
    test: function () { return Object.keys(game.surveyed || {}).length >= 8; }
  },
  {
    id: 'ice-hunter',
    name: 'Ice Hunter',
    blurb: 'Bring ice home on the rover.',
    icon: '🧊',
    test: function () {
      var s = game.challenges && game.challenges['rover-expedition'];
      return !!s && s.status === 'done';
    }
  },
  {
    id: 'comeback',
    name: 'Comeback',
    blurb: 'Win after a supply fell below 25 at some point.',
    icon: '↩',
    test: function () {
      if (!game.finished || !game.success) { return false; }
      var keys = ['oxygen', 'water', 'food', 'power'];
      for (var i = 0; i < keys.length; i++) {
        if (typeof game.lowestSeen[keys[i]] === 'number' && game.lowestSeen[keys[i]] < 25) {
          return true;
        }
      }
      return false;
    }
  },
  {
    id: 'quickness',
    name: 'Ahead of Schedule',
    blurb: 'Bring the crew home by day 10.',
    icon: '⏱',
    /* Requires a real, finished, successful mission. `game.success`
       alone is not enough: endMission() sets it before it has checked
       the 16 day limit, and a mission can still be downgraded after
       that. */
    test: function () { return game.finished && game.success && game.day <= 10; }
  },
  {
    id: 'untouched',
    name: 'Full Marks',
    blurb: 'Complete every required and every optional objective.',
    icon: '★',
    /* Needs a successful mission as well as a full objective sheet:
       ticking every box on a mission that still ran out of time is a
       failure, and "Full Marks" should not sit next to it. */
    test: function () {
      return game.finished && game.success && allObjectivesDone();
    }
  },
  {
    id: 'home-safe',
    name: 'Home Safe',
    blurb: 'Bring all three astronauts home.',
    icon: '🚀',
    /* Cannot be earned by a failed mission, whatever the resources. */
    test: function () {
      return game.finished && game.success && crewAlive() === STARTING_CREW;
    }
  }
];

function allSystemsAbove(level) {
  for (var i = 0; i < MAINT_SYSTEMS.length; i++) {
    if (conditionOf(MAINT_SYSTEMS[i]) < level) { return false; }
  }
  return true;
}

function allObjectivesDone() {
  var list = allObjectives();
  for (var i = 0; i < list.length; i++) {
    if (!game.completed[list[i].id]) { return false; }
  }
  return true;
}

/* Check every achievement and unlock the ones whose condition now
   holds. Safe to call as often as you like: awardOnce() makes a
   repeat unlock impossible, so this cannot spam the list.

   This runs at the END of a mission as well as during it, and that
   matters: the badges for coming home, finishing early and a clean
   sheet can only be earned once the outcome is known. Each test
   function checks for itself whether the mission has finished. */
function updateAchievements() {
  if (!game) { return; }
  for (var i = 0; i < ACHIEVEMENTS.length; i++) {
    var a = ACHIEVEMENTS[i];
    if (game.unlocked[a.id]) { continue; }
    var ok = false;
    try { ok = a.test() === true; } catch (e) { ok = false; }
    if (ok) {
      awardOnce('achievement-' + a.id, function () {
        game.unlocked[a.id] = game.day;
      });
    }
  }
}

function achievementsUnlocked() {
  var out = [];
  for (var i = 0; i < ACHIEVEMENTS.length; i++) {
    if (game.unlocked && game.unlocked[ACHIEVEMENTS[i].id]) {
      out.push(ACHIEVEMENTS[i]);
    }
  }
  return out;
}

/* ------------------------------------------------------------
   9b. THE CHALLENGE PANEL
   Rendered inside the station panel, at the structure that is
   broken. It states the instruction, the deadline and the science,
   then offers the three answers. A player who walks away without
   choosing does not get a free re-roll: the challenge stays open
   until its deadline runs out.
   ------------------------------------------------------------ */

function challengeDeadlineText(def, state) {
  if (def.continuous) { return 'No deadline - judged at the end of the mission'; }
  if (state.deadlineDay === null || state.deadlineDay === undefined) { return 'No deadline'; }
  var left = state.deadlineDay - game.day;
  if (left < 0) { return 'Deadline was day ' + state.deadlineDay; }
  if (left === 0) { return 'LAST DAY - today is the deadline'; }
  return left + (left === 1 ? ' day left' : ' days left') + ' (day ' + state.deadlineDay + ')';
}

function challengePanelHtml(def) {
  var state = game.challenges[def.id];
  if (!state || state.status !== 'active') { return ''; }

  var target;
  if (def.metByOutcome === true) {
    target = 'Success means completing the expedition, not raising a bar.';
  } else if (def.allSystems) {
    target = 'Get every system above ' + CHALLENGE_REPAIR_TARGET + '% condition.';
  } else {
    target = 'Success means ' + def.successKey + ' back above ' + def.successLevel + '.';
  }

  var options = '';
  for (var i = 0; i < def.options.length; i++) {
    options +=
      '<button class="btn-option challenge-option" type="button" ' +
        'data-challenge="' + def.id + '" data-challenge-option="' + i + '">' +
        '<span class="opt-label">' + (i + 1) + '. ' + def.options[i].label + '</span>' +
        '<span class="opt-hint">' + def.options[i].hint + '</span>' +
      '</button>';
  }

  return '<div class="challenge-card" role="group" aria-label="Mission challenge">' +
      '<p class="challenge-kind"><span class="challenge-icon" aria-hidden="true">' +
        def.icon + '</span> MISSION CHALLENGE' +
        '<span class="challenge-day">Started day ' + state.startedDay + '</span>' +
      '</p>' +
      '<h3 class="challenge-title">' + def.title + '</h3>' +
      '<p class="challenge-brief">' + def.brief + '</p>' +
      '<p class="challenge-goal">' + target + '</p>' +
      '<p class="challenge-deadline">' + challengeDeadlineText(def, state) + '</p>' +
      '<p class="challenge-science"><strong>Why this matters:</strong> ' + def.science + '</p>' +
      '<p class="challenge-note">Thresholds, deadlines and rewards are ' +
        '<span class="tag tag-game">GAME ESTIMATE</span> values.</p>' +
      options +
    '</div>';
}

function bindChallengeOptions() {
  var box = el('event-options');
  if (!box || typeof answerChallenge !== 'function') { return; }
  var nodes = box.querySelectorAll('.challenge-option');
  for (var i = 0; i < nodes.length; i++) {
    (function (node) {
      node.addEventListener('click', function () {
        if (game.decisionLocked || game.finished) { return; }
        game.decisionLocked = true;          /* one answer per challenge, ever */
        answerChallenge(node.getAttribute('data-challenge'),
                        Number(node.getAttribute('data-challenge-option')));
      });
    })(nodes[i]);
  }
}

/* The challenges waiting at one kind of structure. */
function challengesAtHost(type) {
  var out = [];
  if (!game || game.finished) { return out; }
  for (var i = 0; i < CHALLENGES.length; i++) {
    var def = CHALLENGES[i];
    if (def.host !== type) { continue; }
    var state = game.challenges[def.id];
    if (state && state.status === 'active') { out.push(def); }
  }
  return out;
}

/* The kind of structure that most needs walking to. Used to put a
   marker on the map in the 2D world so an open challenge can be
   found the same way a scenario can. */
function activeChallengeHost() {
  if (!game || game.finished) { return null; }
  for (var i = 0; i < CHALLENGES.length; i++) {
    var def = CHALLENGES[i];
    var state = game.challenges[def.id];
    if (state && state.status === 'active') { return def.host; }
  }
  return null;
}

/* Every challenge that has been started, in catalogue order, for the
   results screen. */
function challengeHistory() {
  var out = [];
  for (var i = 0; i < CHALLENGES.length; i++) {
    var def = CHALLENGES[i];
    var state = game && game.challenges ? game.challenges[def.id] : null;
    if (!state) {
      out.push({ def: def, status: 'unmet', label: 'Never arose on this mission' });
    } else {
      /* A challenge still open when the mission ended was never
         answered, and cannot be now. Calling it "Open" on a results
         screen would be telling the player to go and do something
         that is no longer possible. */
      var status = state.status;
      if (status === 'active' && game.finished) { status = 'missed'; }
      out.push({ def: def, status: status, startedDay: state.startedDay,
                 answeredDay: state.answeredDay, note: state.note });
    }
  }
  return out;
}

/* A short line for the results screen explaining how each ended. */
function challengeOutcomeText(entry) {
  switch (entry.status) {
    case 'done':    return 'Settled properly on day ' + (entry.answeredDay || '?');
    case 'partial': return 'Patched rather than fixed';
    case 'failed':  return 'Failed';
    case 'expired': return 'Ran out of time';
    case 'missed':  return 'Still open when the mission ended';
    case 'unmet':   return 'Never came up';
    case 'active':  return 'Open';
    default:        return 'Open';
  }
}

/* exposed for the HUD, the results screen and the tests */
if (typeof window !== 'undefined') {
  window.PHASE5 = {
    CHALLENGES: CHALLENGES,
    ACHIEVEMENTS: ACHIEVEMENTS,
    PHASE5_OBJECTIVES: PHASE5_OBJECTIVES,
    TRIGGER: CHALLENGE_TRIGGER,
    SUCCESS_LEVEL: CHALLENGE_SUCCESS_LEVEL,
    REPAIR_TARGET: CHALLENGE_REPAIR_TARGET
  };
}
