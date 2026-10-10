# Junior Astronaut Mission Trainer

**Manage Your Moon Base. Protect Your Crew.**

An educational browser game where you command a small lunar outpost, keep three
astronauts alive, and complete six mission objectives in 16 days.

Built with plain HTML, CSS and JavaScript. No frameworks, no build step, no backend,
no API keys, no install. Double-click `index.html` and play.

---

## 1. How to run it

1. Open the `junior-astronaut-mission-trainer` folder.
2. Double-click **`index.html`**.
3. It opens in your default browser. Press **Start Mission**, then pick a landing site.

That is the whole install. You can also right-click `index.html` → *Open with* →
Chrome, Edge or Firefox.

> **Optional:** if you want the live NASA panel to load, you need an internet
> connection. Everything else in the game works completely offline.

---

## 2. Project files

| File | What it does |
|---|---|
| `index.html` | All six screens: welcome, how to play, learn, the landing map, the playable Moon Base, results |
| `style.css` | The dark space theme, resource cards, the CSS-drawn Moon base, every keyframe |
| `script.js` | All the **rules**: settings, events, resource maths, scoring, the station bridge, the NASA panel |
| `world.js` | All the **drawing and movement**: the structure catalogue, terrain, astronaut, physics, camera |
| `sprites.js` | Generated frame map — where each frame sits inside `assets/sprites.png` |
| `sites.js` | The landing site data: real coordinates, real facts, and the clearly separated game estimates |
| `map.js` | The landing map screen: draws the south pole, hit-testing, selection and comparison |
| `builder.js` | The base builder: palette, placement rules, cargo budget and the layout summary |
| `mission.js` | Phase 3: the pre-flight check, what the base and site provide, daily survival, maintenance and dust storms |
| `challenges.js` | Phase 5: the six survival challenges, the optional objectives, and the achievements |
| `lunar-data.js` | Phase 4: the cited lunar record — crater sizes, illumination, ice detections, and where each number came from |
| `fx.js` | Animations only — the canvas space background and all UI motion |
| `assets/sprites.png` | The one image file. Astronaut and structure artwork |
| `tools/make-sprites.html` | Draws the sprite sheet in a browser |
| `build-sprites.js` | Development tool: runs the above in headless Chrome and saves the PNG + `sprites.js` |
| `README.md` | This file |

**`fx.js` never touches the game.** It contains no rules, no numbers and no
scoring. If you delete it the game still plays perfectly, just without motion.

**`script.js` never draws and `world.js` never decides.** `world.js` reads the
mission state from `game` and calls back into `script.js` when the player
reaches a structure. Every change to oxygen, water, food, power or the score
still happens in `script.js` and nowhere else.

**`mission.js` loads before `script.js`.** It only calls into `script.js` at
runtime, never while the page is loading, but `script.js` reads the Phase 3
state it creates as the page boots — so the order is the other way round from
the other two.

The welcome screen is still drawn entirely with CSS, so it needs no image
files. The playable Moon Base does use one PNG, and if it is ever missing the
game falls back to drawing simple shapes instead — see `fallbackAstronaut()` and
`fallbackStation()` in `world.js`. Nothing breaks when you are offline.

### 2c. Sprites

Artwork lives in one place only. To change a sprite:

1. edit the drawing code in `tools/make-sprites.html`
2. run `node build-sprites.js`

That regenerates `assets/sprites.png` **and** `sprites.js` together, so the
frame numbers can never drift apart. `sprites.js` says *do not edit by hand*.

### 2d. Structures and the base layout

`world.js` keeps two separate things, and keeping them apart is what lets a
base be designed before the mission starts:

| | What it is | Where |
|---|---|---|
| `STATION_TYPES` | The catalogue. **What** a structure is: name, sprite, and `limit` — how many of it one base may hold | `world.js` |
| `baseLayout` | The player's base. **Where** the structures stand: one `{uid, type, x}` per placed structure | `world.js` |
| `STATIONS` | The two combined. Never edited by hand; rebuilt by `buildStations()` | `world.js` |

`STATIONS[i].id` is unique to that one placed structure, so a base may hold two
depots. `STATIONS[i].type` is what kind of structure it is, and that is what
`EVENT_STATION`, `STATION_SERVICE`, `STATION_STATUS` and `game.serviced` are
keyed by — so the mission marker appears on both depots, but the depot type can
only be serviced once per mission.

Critical life-support systems (`habitat`, `oxygen`, `water`, `food`, `console`)
have `limit: 1`, because a second oxygen plant would not give the crew anything
extra. Solar panels and supply depots have `limit: 3`.

`script.js` copies the planned base into the mission once, in `applyBase()`.
After that `game.layout` is the base and nothing looks back at the plan, so the
simulation cannot be changed halfway through by something upstream.

Rocks are generated clear of every placed structure (`clearOfStations()`), so a
structure can never be built on top of terrain the player cannot see.

---

## 2e. The landing map

**Start Mission opens the map first**, before the Moon Base. The player picks one of
six real sites on the lunar south pole, then lands.

| | File | Role |
|---|---|---|
| Data | `sites.js` | `ZONES[]` — coordinates, facts, game estimates. No DOM. |
| Screen | `map.js` | Projection, drawing, hit-testing, selection, comparison |

### The projection

A **polar stereographic** view centred on the south pole: the pole is at the centre and
distance from the centre grows with distance away from it. This is the kind of map NASA
uses for polar targets, and it is chosen over a globe view because sites between 81°S
and 90°S would otherwise bunch up along the edge.

Sites near the pole are genuinely only a few pixels apart on that projection, so
**dots stay at their true coordinates and labels sit on a ring**, in geographic order,
joined by leader lines. Both the dot and its label chip are click targets, and the
label is the roomy one — the polar dots are 16 to 23 px apart.

The site list in the side panel is always present and fully keyboard reachable, so the
map is never the only way to choose.

### The six sites

| Site | Coordinates | Difficulty | Cargo |
|---|---|---|---|
| Nobile Crater | 85.2°S, 30°E | ★ | 150 |
| Sylvester N | 81.7°S, 55°E | ★★ | 128 |
| Haworth Crater | 81.6°S, 90°W | ★★★ | 128 |
| Shackleton Rim | 89.9°S, 15°W | ★★★★ | 115 |
| Tycho Crater | 43.3°S, 11°W | ★★★★ | 115 |
| Cabeus B Floor | 85.6°S, 50°W | ★★★★★ | 108 |

Each site gives something and takes something away: Cabeus B has the best water-ice
prospect in the game and the worst sunlight; Shackleton has the best sunlight and a
rough landing; Tycho is the dustiest and has no ice at all.

### Fact versus estimate

This is the part that matters most for honesty, so it is enforced in code and in tests.

- **`facts[]` — REAL SCIENCE.** Published statements about a real place. Shackleton is
  about 21 km across and about 4 km deep; polar ridges can stay lit for more than 85% of
  the cycle; permanently shadowed areas fall below −170 °C; LCROSS deliberately impacted
  Cabeus B on 9 October 2009 and found water in the ejecta; Tycho is about 85 km wide.
  These are stated as fact.
- **Everything else — GAME ESTIMATE.** Every sunlight percentage, ice percentage, dust
  figure, difficulty rating and cargo budget was invented so the trade-offs teach
  cleanly. They are **not** NASA measurements, not mission-planning figures, and not
  claims about what a real base would find. Each one is tagged `GAME ESTIMATE` where it
  is shown, and the screen carries a standing disclaimer.

`lat` and `lon` are real and are what places the marker. A test asserts that no site's
own invented percentages ever appear inside its `facts[]`, so a game estimate cannot
quietly end up under a `REAL SCIENCE` label.

---

## 2f. The base builder

Confirming a site opens the builder, and the mission starts from whatever is built.

**The builder is a mode, not a screen.** It runs inside `#screen-game` on the same
canvas, with the same sprites, camera, terrain and astronaut code. `world.mode` is
`'play'` or `'build'`, and it defaults to `'play'`; while building, the astronaut is
frozen and the play HUD, touch pad and NASA panel step out of the way behind a single
`.is-building` class. That means there is no second renderer and no second copy of the
scene, so the arrangement you make is literally the base you walk around in.

### The eight structures

| Structure | Type | Cargo | Limit | Purpose |
|---|---|---|---|---|
| Astronaut habitat | `habitat` | 20 | 1 | Crew sleep; resting here recovers health |
| Oxygen and life support | `oxygen` | 18 | 1 | Scrubs carbon dioxide, holds the air supply |
| Water recycling station | `water` | 16 | 1 | Returns clean water every day |
| Food station | `food` | 14 | 1 | Hydroponics; food stops shrinking |
| Solar panels | `solar` | 8 | **3** | Makes the electricity everything else runs on |
| Supply depot | `depot` | 10 | **3** | Resupplies the crew and repairs equipment |
| Mission control | `console` | 12 | 1 | Tracks objectives and the mission clock |
| Landing pad and rover park | `pad` | 10 | 1 | Delivers supplies and takes the crew home |

A minimum base costs **108**. The landing site decides how much cargo is delivered
(108 at Cabeus B up to 150 at Nobile), so a hard site leaves no room for a second solar
array and an easy one does. That is the trade-off the zone choice and the layout choice
pull against each other.

Costs and limits are `GAME ESTIMATE` values and are tagged as such in the panel.

### Placement rules

| Rule | Why |
|---|---|
| Everything snaps to a 20 px grid | Nothing ends up half a pixel off |
| Two structures must be 140 px apart | A sprite is 96 px wide, so 140 leaves 44 clear px — they can never overlap |
| One structure of each type, except solar and depot which allow three | A second oxygen plant would give the crew nothing extra |
| Nothing off the ends of the landing area | Keeps the base on walkable ground |
| A structure may be built over a rock, which clears it | The rocks sit in the gaps between the shipped structures, so treating them as obstacles would leave almost nowhere to build |

Every refusal states its reason — *"Too close to the supply depot. Keep 140px apart"* —
rather than just refusing.

The grid and the gap are both tuned against the shipped base, whose structures stand
320 apart. A test asserts there are at least a dozen legal positions on the plot, so
these two numbers cannot be tightened by accident until the map is unbuildable.

### Controls

| | |
|---|---|
| Click a palette entry | Arms that structure |
| Move the pointer | A ghost follows, green if legal, red with a reason if not |
| Click the ground | Place, or move the selected structure |
| Click a placed structure | Select it — also listed in the layout summary |
| `X`, `Delete` or **Remove** | Take it away and get the cargo back |
| `Esc` or right-click | Cancel |
| **Place in first free spot** | The keyboard route; finds a legal position by itself |
| `Enter` | Continue, once the base is complete |

### What it will not let you do

A base that is missing a structure the mission is going to ask for cannot be
continued, and the panel says which ones are still needed. Every placement, move and
removal is checked against the same rules, so a structure can never be left half
placed, overlapping, off the map, over its limit, or unaffordable.

### The one thing worth knowing about the code

`buildTerrain()` used to rebuild the floating canisters from scratch every time the
layout changed. In a mission, editing the layout would therefore have respawned all
eight of them — a free supply every time you moved a building. `buildTerrain()` now
carries the collected state across, and there is a test that relayouts five times and
asserts nothing came back.

### What it does not do yet

Phase 2 on its own changes no simulation number. The layout is handed over once, by
`builderLayout()` → `currentPlan()` → `applyBase()`. Phase 3 is what makes that layout
change anything — see below.

---

## 2g. Mission preparation and survival simulation (Phase 3)

This is the phase where the two decisions the player made — **where to land** and
**what to build** — finally start to matter.

### The pre-flight check

The builder's launch button is now **Start Mission**, and it will not let the
mission begin until the base passes a checklist. The checklist is shown in full,
always, and every line states its reason:

| Group | What it checks | Blocks the launch? |
|---|---|---|
| Structures the crew needs | All eight types are built | Yes |
| Supplies at launch | Each store is above its minimum | Yes |
| Will it last the whole mission? | Projected daily balance for each vital resource | Only if it cannot last 16 days |

The balance figures are a **projection**, not a promise: they come out of the same
`projectedDailyDeltas()` function that runs the real daily cycle, evaluated against
the site that is about to be chosen. So the number you are shown before launch is the
number you actually get.

A negative balance that still outlasts the mission is shown as a warning, not a
refusal — sometimes that is a deliberate, interesting choice. It just has to be an
informed one.

### What each structure actually does

This is the table that connects the builder to the simulation. Without a structure,
that part of the base simply does not exist:

| Structure | Per day, at full condition |
|---|---|
| Solar Panels | Generates electricity. One array is worth 22; each extra one adds half as much again, because past the first the base is already covered |
| Oxygen System | Scrubs 4 oxygen back into the cabin |
| Water Recycler | Returns 4 clean water, **plus** whatever the site's ice is worth |
| Food Station | Grows 3 food |
| Habitat | The crew recover 3 health. Without one they lose 4 a day and sleep in shift bags |
| Supply Depot | Holds spares, so everything else wears down more slowly |
| Mission Console | Planning credit, worth 1 health a day not working blind |
| Landing Pad | Deliveries and departure. Without one, no depot deliveries either |

### How the landing site changes the numbers

Every one of these is a GAME ESTIMATE read from `sites.js`:

| Site factor | What it does |
|---|---|
| Sunlight and power bonus | Scale how much electricity the arrays make |
| Heat | Warm ground costs less power for heating (Cabeus B is nearly warm, Shackleton is cold) |
| Ice | Ice-rich ground gives the water recycler better raw material |
| Dust | Costs solar output, and makes equipment wear down faster |

The minimum base at each site, measured from the automated tests:

| Site | Solar made | Daily power | Heating |
|---|---|---|---|
| Shackleton Rim | 21.7 | **+6.0** | 1.2 |
| Sylvester N | 19.2 | +3.3 | 1.4 |
| Nobile Crater | 18.3 | +2.2 | 1.6 |
| Tycho Crater | 17.1 | +1.8 | 0.8 |
| Haworth Crater | 16.2 | +0.7 | 1.0 |
| Cabeus B Floor | 9.6 | **−5.1** | 0.2 |

Cabeus B is the point of the map. The Sun never reaches that crater floor, so the
base runs on a single array that barely covers the daily draw — and 108 cargo is
exactly the cost of the eight structures, so there is nothing left to spend on a
second array. It is survivable for about twenty days on power and nothing more. A
test asserts that **every** site is survivable over the 16 day limit, so the hardest
site is hard rather than impossible.

### Equipment maintenance

Every critical system has a **condition** from 100 down to 0, and output is scaled by
it. Wear per day is `(3 + 6 × dust) / (1 + 0.6 × depots)`, so a dusty site grinds the
base down and a supply depot slows it. Below 35% a system is **failed**: it still
runs, but at half its already-reduced output, and the crew takes damage.

Servicing a structure puts that system straight back to 100%. That is the reason a
supply depot is worth building.

### Emergency events

The five emergencies are not on the schedule. They only happen when a system has
actually worn past the point of no return, and they are hosted by the structure that
broke — so a failed life-support system appears at the oxygen system, not in a
popup. One is queued at a time, and it takes priority over whatever was scheduled,
because a dead air scrubber outranks a routine resupply run.

A base that is serviced never sees one. A test runs the same 16 day mission twice,
once repairing everything and once repairing nothing at the dustiest site:

| | Repaired | Neglected at Tycho |
|---|---|---|
| Lowest condition reached | 52% | 18% |
| Systems that failed | none | all five |
| Emergencies | none | fires on day 13 |
| Crew health at the end | 100 | 44 |

### Dust storms

Sites above the dust threshold meet a storm on day 10; the dustiest site gets a
second, earlier one on day 5. A storm cuts solar output for two or three days and is
announced in the day's report when it starts, never discovered afterwards.

### Exploration tasks

Two of the optional objectives are science tasks, and they are not decided by picking an
option in a panel. They are earned by walking the base:

- **Collect 6 supply canisters** from the surface — the floating canisters that were
  already in the world.
- **Inspect 4 different structures** — reading any structure's readout counts, and the
  mission console shows the running totals.

### The 16 day limit

`MISSION_LENGTH_DAYS` is still 16, and it is now enforced from three directions, so
it cannot be talked around:

1. `beginDay()` refuses to start a day past the limit.
2. `checkWin()` will not declare a victory on day 17 or later, even with every
   objective done.
3. `sanitizeMission()` runs inside `endMission()` and turns any late success back into
   a failure, whatever the caller believed.

There is a test for each. The departure scenario also **slides**: if the crew is still
holding objectives on day 12, the launch moves to a later day instead of ending the
mission with work unfinished, right up to day 16. That is what makes the limit bite.

### Scoring is unchanged

The score is still out of 100 with the same five bands — objectives 30, crew survival
25, health 15, supplies 20, efficiency 10. Adding two objectives meant the
per-objective points had to be scaled (`SCORE_BAND_OBJECTIVES / OBJECTIVES.length`)
so the objective band is still worth exactly 30. A test asserts a perfect mission
scores exactly 100, a failed one exactly 60, and a wiped-out one exactly 0.

### Keeping the state honest

`mission.js` is the only file that may touch the mission state directly, and
`sanitizeMission()` is the single place the rules are enforced. It pulls every
resource into 0–100, replaces anything that is not a real number with a real number,
clamps every condition, discards objective keys that are not real objectives, and
re-votes any late victory. It runs after the daily cycle and again inside
`endMission()`.

A test corrupts the state on purpose — negative oxygen, 999 water, `NaN` food, a
string where power should be, a negative day, a made-up objective key, 4000% condition
— and asserts every one of them is repaired. A second test runs 40 unattended days
and asserts nothing ever leaves its range.

### What stays the same

The Phase 1 landing map, the Phase 2 builder and placement rules, astronaut movement
and physics, every animation, the live NASA panel, and the `facts[]` / GAME ESTIMATE
separation in `sites.js` are all untouched. A test asserts the 2D play scene is still
**byte-for-byte identical** to the previous commit at four camera positions. No Phase 3
number appears inside any `facts[]` array, and a test checks that too.

---

## 2h. NASA lunar data (Phase 4)

Before Phase 4 the game carried a handful of hand-written sentences about the Moon,
a row of invented percentages, and no sources. Some of those sentences turned out to
be **wrong**. Phase 4 replaces guesswork with a small cited dataset.

### Three things that were wrong, and are now right

Checked against the IAU and USGS Gazetteer of Planetary Nomenclature:

| Site | Was | Actually is |
|---|---|---|
| **Nobile** | 85.2°S, 30°E, "about 50 km across" | **85.28°S, 53.27°E, 79.27 km** (IAU feature 4321) |
| **Sylvester N** | 81.7°S, 55°E | There is no southern crater by that name. "Sylvester N" is a feature at **82.4°N** in the north, so it can never have been a south polar landing site. Replaced with the real southern **Sylvester**: **82.65°S, 81.22°W, 59.28 km** (IAU feature 5791) |
| **Shackleton** | 89.9°S, 15°W | **89.67°S, 129.78°E, 20.92 km** (IAU feature 5450). The old value put it effectively on top of the pole |
| **Tycho** | 43.3°S, 11.4°W | **43.30°S, 11.22°W, 85.29 km** (IAU feature 6163) |

### The three tiers, and the line between them

`lunar-data.js` tags every entry. The game shows the tag, and the tiers never mix.

| Tier | What it is | Example |
|---|---|---|
| **VERIFIED** | A published measurement, with the source that reported it | Cabeus is 100.58 km across (IAU Gazetteer) |
| **INTERPRETATION** | A conclusion drawn from verified values, not itself measured | "Tycho is at 43°S and every ice detection was within 20° of a pole, so ice is not expected here" |
| **NOT BUNDLED** | A measurement that genuinely exists but is not in this game, with a link | Elevation and slope, from the LOLA DEMs |

### Where the numbers come from

| Source | Used for |
|---|---|
| [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/) | Crater names, diameters and centre coordinates |
| [Mazarico et al. (2011), *Icarus* 211](https://doi.org/10.1016/j.icarus.2010.10.030) | Sunlight modelling from LOLA topography; 89.3% at a point on the Shackleton rim |
| [Li et al. (2018), *PNAS* 115](https://doi.org/10.1073/pnas.1802345115) | M3 detection of water ice at the surface; detections cluster near Haworth, Shoemaker, Sverdrup and Shackleton |
| [NASA LCROSS](https://science.nasa.gov/moon/moon-water-and-ices/) | The deliberate crash into Cabeus, and the water measured in the plume |
| [Tye et al. (2015), NASA technical report](https://ntrs.nasa.gov/citations/20150006822) | Shackleton 20.9 km, Haworth 51.4 km; ~1–2% ice by mass in the surface regolith |
| [NASA PGDA LOLA south pole DEMs](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/) | The real elevation and slope data — **not bundled** |

### Elevation and slope are deliberately absent

Real elevation and slope for every one of these sites exists: LRO's Laser Altimeter
produced 5 m/pixel elevation and slope maps of the lunar south pole. They are large
GeoTIFF products that a browser cannot query for a single point, and they are not
bundled with a game that has to run by double-clicking an HTML file.

So the game says so, names the dataset, and links to it. There is no invented height
anywhere. A test asserts every `elevation` and `slope` field is `null`.

### The water-ice record, as data

`ice.status` is one of four values, and only one site earns the top one:

| Site | Status | Why |
|---|---|---|
| Cabeus B | **detected** | LCROSS crashed there in 2009 and measured water in the plume |
| Shackleton, Haworth | **cluster** | M3 detections cluster near these craters — promising, not proven for the landing spot |
| Nobile, Sylvester | **not-detected** | Inside the polar band, looked for, not found |
| Tycho | **out-of-band** | At 43°S. No ice has ever been found below 70° latitude |

### How the site reaches the mission

Phase 4 changes exactly one thing in the simulation, and it follows from the record
rather than from taste:

**A crater where water ice was actually measured is a better place to do science**, so
the survey objective there needs 3 structure readouts instead of 4. Everywhere else
it stays at 4. The reasoning is stated on the site card, in the pre-flight panel, and
in the results report.

Nothing else moves. The scoring bands, the 16-day limit, the builder rules and the
survival model are untouched.

### The map, drawn to scale

The map is a true polar stereographic projection, and Phase 4 makes that visible:

- **Dashed rings at real size.** Each site's crater is drawn at its published
  diameter. At the default whole-hemisphere view Shackleton really is only a couple of
  pixels across and Cabeus is five times wider — which is the point.
- **Three zoom levels** (90°, 45°, 20° from the pole). Zooming is what makes the real
  data readable; at 20° the disc covers 613 km instead of 3,475 km.
- **A scale bar in real kilometres**, correct at every zoom level.
- **Rim chevrons** for any site outside the current view, so zooming in can never make
  a site unreachable. A test asserts all six are reachable at all three zooms.
- The whole hemisphere remains the default, and re-opening the map resets it.

### NASA photographs of the crater you picked

Selecting a site searches NASA's Image and Video Library for that actual crater, using
the IAU-approved name. This was tested against the live API:

- **Tycho** returns a real photograph — *"Ejecta in Tycho Crater"*, NASA ID PIA13694.
- **The five polar craters return nothing at all.** Most of these craters have never
  been photographed from close range, and the panel says exactly that and hands over a
  link to images.nasa.gov so the player can keep looking. That is a real gap in the
  archive, not a failure of the game.

Every image carries its NASA ID, the centre that published it, the date, and a link to
the record.

### Error handling

| Case | What happens |
|---|---|
| No `fetch` | The panel explains and the game carries on |
| Slow connection | `AbortController` times out after 12 s and says so |
| HTTP error | "NASA returned HTTP 503", with the game unaffected |
| Empty result | Shown as an empty archive, not as an error, with a search link |
| Image fails to load | `onerror` hides it; the text and credit stay |
| Reply arrives after you changed site | Discarded, so a slow reply cannot overwrite the current card |
| Markup in an API field | Stripped before it reaches the page |

**No secrets.** `images-api.nasa.gov` is public and needs no key, so there is nothing
to hide and nothing to leak. A test asserts no key, token or secret appears anywhere
in the configuration. No new dependencies were added.

---

## 2i. Challenges and achievements (Phase 5)

### Six survival challenges

They do not wait for a scripted day. Each fires when the base actually gets into
trouble, and each is answered **at the structure that is broken** — walk to the oxygen
system, press E, choose. That is the same interaction model Phase 3 already used, so
no new control was invented.

| Challenge | Fires when | Host | Deadline | Success |
|---|---|---|---|---|
| **Seal the airlock leak** | Oxygen below 58 | Oxygen System | 2 days | Oxygen back above 66 |
| **Get the power back above the line** | Electricity below 55 | Solar Panels | 2 days | Electricity above 66 |
| **Restart the water recycler** | Water below 48, or the recycler has failed | Water Recycler | 2 days | Water above 56 |
| **Keep the food store above the line** | Food below 45 | Food Station | none — judged at the end | Food never drops below 26 |
| **Inspect and service the whole base** | Any system below 60% condition | Mission Console | 3 days | Every system above 70% |
| **Drive the rover on an ice expedition** | Day 7 | Supply Depot | day 14 | The expedition is completed |

Every challenge gives three answers of the same shape — **fix the cause**, **buy
time**, or **cut something else to pay for it** — and each states what it costs before
you pick.

A challenge needs the structure it is hosted at. A base with no water recycler cannot
be challenged to repair one.

### Why these problems, and where the numbers come from

The **problems are real**:

- A cracked airlock seal leaks slowly, which is worse than a fast leak, because the
  crew feel fine while the store quietly drops.
- A water recycler passes everything through filters, and lunar dust gets into
  filters. Once the loop stops, every drop used is a drop lost.
- Lunar dust is jagged and electrostatically charged, so it gets into seals, scratches
  glass and jams filters. No base can ignore it.
- A rover is the only way to move material across the south pole, and driving to the
  shadowed craters costs power the whole way.

The **numbers are not**. Every threshold, deadline and reward figure is a
`GAME ESTIMATE`, tagged as such on the challenge card itself.

### Primary and optional objectives

Every objective now says whether it is **required** or **optional**.

| | Count | What it does |
|---|---|---|
| Required | 6 | The mission. All must be done to fly home. |
| Optional | 6 | Points only. Missing one costs score, not the crew. |

That means clearing the six repair-and-return objectives now wins even without the
science work — which is the honest design: optional work should never hold a crew
hostage.

Four new optional objectives depend on things that have to be true:

| Objective | Depends on |
|---|---|
| Settle 3 mission challenges without failing one | Always available |
| Bring an ice sample back from the shadowed floor | The Phase 4 record — only at a crater where ice was measured or clustered |
| Finish with every system above 70% condition | The base must hold a habitat and a depot |
| Finish with every supply above 70 | Always available |

An objective that cannot apply is shown on the results screen as *not available on
this base or site* rather than silently dropped, because a player remembers seeing a
line that then vanished.

### No objective can pay twice

Three separate guards, and each one is tested:

- `completeObjective()` returns `false` and changes nothing if the objective is already
  done.
- `awardOnce()` writes the id **before** it changes anything, so a second call is a
  no-op rather than a second payment.
- `refreshObjectives()` can run any number of times a day and pays nothing extra.

### Achievements are badges, and badges are worth nothing

Eleven achievements for repairs, conservation, exploration and getting home. **None of
them adds a point.**

That is deliberate, and it is enforced rather than promised:

- The score still comes from the same five bands as Phase 0.
- `sanitizeMission()` runs **before** any badge is judged, so a mission that is about to
  be downgraded from success never hands out an outcome badge.
- `Home Safe`, `Ahead of Schedule`, `Full Marks` and `Comeback` all require
  `game.finished && game.success`.
- A test sets every badge condition true, forces a day-20 "success", and asserts the
  mission is still a failure, still scored as one, and still handed no outcome badge.

Locked achievements are shown on the results screen with their condition written out,
so the player can always see what the game is asking for.

### The results screen

| Section | What it shows |
|---|---|
| Header | Success or failure, and the plain-English reason |
| Score ring | Out of 100 |
| Summary cards | Survival, days, objectives (required and optional), challenges, decisions |
| Resources | Every bar at the end |
| Objectives | Required and optional, ticked or not |
| **Challenges & Repairs** | All six, how each ended, and the totals |
| **Achievements** | 11 badges, earned ones highlighted with the day |
| Report | The full write-up, led by one sentence explaining the outcome |

`outcomeExplanation()` picks the single decisive fact — the day limit, a specific
resource, or a clean finish — rather than listing everything.

### What the HUD does

A challenge strip appears **only when something is open**, directly under the current
objective and above the full list, because an open challenge is something to do *now*
and a long objective list is not. It turns red when a deadline is a day away. The
structure hosting it gets the same glowing marker a scripted scenario gets.

No new animations were added. The strip appears and disappears; it does not slide,
pulse or bounce.

---

## 2b. Animation and visual effects

### Why there are no libraries

The game must run by double-clicking `index.html`, with no server and no internet.
GSAP, Three.js and Anime.js are each roughly 600 KB and would simply not load, so
the whole visual layer is built from things already inside the browser:

| Technique | Used for |
|---|---|
| **Canvas 2D** | 260 twinkling stars in three parallax depths, drifting colour clouds, the turning Moon with craters and day/night shading, occasional shooting stars, floating dust |
| **CSS keyframes** | The habitat bobbing, the solar panel sweep, pulsing windows, the blinking antenna beacon, the spinning orbital ring, the floating astronaut, the light travelling along each bar |
| **Web Animations API** (`element.animate`) | Screen transitions, staggered card entrances, button ripples, score count-up, confetti, screen flash, the failure shake |
| **IntersectionObserver + rAF** | Learn cards fading up as you scroll to them |
| **CSS only** | Everything on the welcome Moon base — no images |

### What it animates

- **Background** — three star layers drifting at different speeds and twinkling out of
  phase, three slow colour clouds, dust motes, and a shooting star every 5–14 seconds
- **The Moon** — genuinely turns (the craters rotate with it) while the day/night
  shading stays fixed, which is what makes it read as a sphere
- **Welcome screen** — title, subtitle, intro and buttons cascade in; the habitat,
  solar array and antenna shift gently with the pointer (parallax); the astronaut
  floats and its arms sway
- **Screen changes** — every switch fades, blurs and slides
- **Dashboard** — panels and cards stagger in; resource cards pop when values change;
  bars catch the light; the decision options cascade in as each event appears
- **End of mission** — success: cyan flash, ~80 confetti pieces, the score counting up
  from zero. Failure: red flash and a shake. Both clear themselves out of the DOM

### Performance

- **One** `requestAnimationFrame` loop drives the entire canvas. Many small loops are
  far more expensive than one shared one.
- It **pauses automatically** when the tab is hidden, so it costs nothing in the
  background.
- Fewer stars and dust motes on small screens.
- Device pixel ratio is capped at 2, so a 4K screen does not try to draw 4× the pixels.
- Animations only ever move `transform` and `opacity`, which the browser can do on the
  GPU without re-laying-out the page.
- Confetti and flash nodes remove themselves from the DOM when they finish.

### Accessibility

- `prefers-reduced-motion: reduce` is fully honoured: the animation loop never starts
  (one still frame of the sky is drawn instead), every CSS loop stops, screen
  transitions become instant, and the score appears at its final value.
- If a browser has **no Canvas 2D support at all**, `fx.js` skips the background and
  the game runs normally on a plain background.
- Controls stay fully usable while animations run — buttons are only animated, never
  gated behind an animation.

---

## 3. How the game works

### The goal

Keep all three astronauts healthy for **16 mission days** and finish all **6 required
objectives**. The optional ones are points, not conditions — missing one costs score,
not the crew.

### The daily cycle

Every mission day the base automatically:

1. **Makes** what its structures produce, scaled by their condition and by the site.
2. **Uses** electricity, oxygen, water and food.
3. **Wears** every system down a little, faster on a dusty site and slower with supply
   depots to hold spares.
4. **Hurts** crew health if oxygen drops below 25, water or food below 15, or power
   reaches zero.

Since Phase 3 the numbers come from the base and the site rather than from constants.
With the minimum base at Nobile Crater the base gains about +2.2 power, loses 4
oxygen, 0.6 water and 2 food a day. At Cabeus B it **loses 5.1 power a day**. The full
table is in section 2g.

The fewer astronauts are still healthy, the less the base consumes — but losing crew
members is heavily punished in the final score, so it is never worth doing on purpose.

### How you fail

| Cause | Result |
|---|---|
| Oxygen reaches 0 | Mission failed |
| Water reaches 0 | Mission failed |
| Food reaches 0 | Mission failed |
| Crew health reaches 0 | Mission failed, crew lost |
| Day 17 arrives with objectives unfinished | Mission failed, time expired |

There is no way to stall. The game always ends, and a mission that runs past day 16
can never be declared a success no matter how many objectives it met.

### How you win

Complete every **required** objective. The departure is scheduled for day 12, but it
**slides to a later day** if anything required is still outstanding, right up to day 16.
Win on day 17 and you have not won.

### The objectives

Six required:

1. Restore full solar power to the base
2. Restart the water recycling loop
3. Get the hydroponics bay producing again
4. Repair the CO2 scrubber
5. Ride out the lunar dust storm safely
6. Return the crew safely to Earth

Six optional:

1. Collect 6 supply canisters from across the surface
2. Inspect 4 different structures and log them at the console
3. Settle 3 mission challenges without failing one
4. Bring an ice sample back from the shadowed floor *(only at a site where ice was found)*
5. Finish the mission with every system above 70% condition *(needs a habitat and a depot)*
6. Finish the mission with every supply above 70

### The eleven scheduled events

| Day | Event | Objective? |
|---|---|---|
| 1 | Opening briefing (no event) | no |
| 2 | A Solar Panel Is Damaged | ✅ power |
| 3 | A Supply Ship Is Delayed | optional |
| 4 | The Water Supply Is Running Low | ✅ water |
| 5 | Radio Blackout | optional |
| 6 | The Hydroponics Bay Has Failed | ✅ food |
| 7 | A Small Airlock Leak | optional |
| 8 | The CO2 Scrubber Has Stopped | ✅ air |
| 9 | Everyone Is Exhausted | optional |
| 10 | A Dust Storm Is Hitting the Base | ✅ storm |
| 11 | The Rover Needs Work | optional |
| 12 | Departure Day (slides if objectives are outstanding) | ✅ return |

Plus **five emergency scenarios** that are not on the schedule at all. Each one only
happens when a system has worn past failing, and each is hosted by the structure that
broke, so it appears at that building rather than in a popup. See section 2g.

And **six survival challenges** that fire whenever the base actually gets into trouble —
an airlock leak, a brownout, a dead recycler, low food, worn equipment, or the rover
expedition. These are answered at the broken structure. See section 2i.

Every option in every event really does something. Choosing to *not* repair a
recycler does not just cost you points once — it costs you water **every single day
after that**, which is the main lesson the game tries to teach.

### Scoring (out of 100)

| Category | Points |
|---|---|
| Required objectives | 24 in total, shared equally |
| Optional objectives | 6 in total, shared equally |
| Astronaut survival | 25 for 3 alive, 17 for 2, 8 for 1 |
| Crew health | up to 15 |
| Resources remaining | up to 20 |
| Efficiency (nothing left critically low) | up to 10 |
| **Failed missions** | multiplied by **0.6** |

The bands have not changed since Phase 0. Splitting the objective band in two in
Phase 5 is what let optional work be worth something without ever being required.
**Achievements add nothing to the score at all** — they are badges, and no badge can
push the score out of range, rescue a failure or excuse a late arrival.

---

## 4. Game values vs real science

**This is important, so please read it.**

Every number in the resource bars — oxygen, water, food, electricity, health — is a
**simplified teaching value** invented for this game so the arithmetic stays easy to
follow on paper.

They are **not**:

- NASA operational data,
- NASA mission planning figures,
- real measurements of a real habitat,
- predictions of what a real lunar base would need.

Real life support engineering is far more complex: redundant systems, specific
consumption rates, pressure and partial-pressure models, radiation budgets, thermal
design and much more.

Since Phase 3 this applies to the whole simulation, not just the bars. The daily
consumption and production, the wear rates, the failure threshold, the cargo budget and
the pre-flight minimums in `mission.js` are **all GAME ESTIMATE values**. So are the
structure costs and limits added in Phase 2. None of them is a NASA figure.

What is real underneath them: that oxygen, water, food and power are the four things a
lunar base runs out of; that lunar dust genuinely destroys seals, panels and filters;
that a permanently shadowed crater floor never sees the Sun; that the polar Sun circles
the horizon giving roughly two weeks of light and two of dark; and that water ice in
those shadowed regions is a real and proven resource. The *problems* are real. The
*magnitudes* are invented so they can be taught on paper.

The rule the project follows is that the line never moves: a real, published statement
goes in a site's `facts[]` array and is labelled `REAL SCIENCE`; anything invented goes
under a GAME ESTIMATE tag or a `GAME ESTIMATE` comment.

Since Phase 4 there is a third column. `lunar-data.js` separates the record into
**verified** (published, with the source attached), **interpreted** (a conclusion drawn
from verified values), and **game** (invented). The site card renders all three as
separate, differently-tagged blocks, so a reader can always tell which is which —
including for the measurements that are deliberately absent. There are tests asserting
that no game figure is labelled verified, that no invented percentage reached a
`facts[]` array, and that elevation and slope were left empty rather than filled in.

The **Learn About Space** screen inside the game labels every fact as either
`REAL SCIENCE` (sourced from NASA) or `GAME RULE` (invented for teaching). The Phase 3
builder panel follows the same convention, tagging the pre-flight checklist
`GAME ESTIMATE` at the point of use. Please keep that distinction if you extend the
project.

### Sources for the real-science cards

- Moon environment, exosphere, temperature swing — NASA Science, *Moon Facts* /
  NASA lunar science mission pages
- Oxygen and spacesuit life support — NASA spacesuit and life-support documentation
- Water recycling and lunar water ice — NASA **LCROSS** mission results (2008) and
  NASA lunar exploration research
- Solar energy and the ~29.5-day lunar day/night cycle — NASA lunar science and
  mission pages
- Growing food — NASA **Advanced Plant Habitat ("Veggie")**, on the International
  Space Station since 2016
- Lunar dust, one-sixth gravity, light travel time — NASA lunar science and human
  exploration documentation

---

## 5. NASA open data

### 5.1 What is actually used in the app

**NASA Image and Video Library API**

- Endpoint used: `https://images-api.nasa.gov/search?q=<term>&media_type=image&page_size=1`
- Documentation: <https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf>
- Public web catalogue: <https://images.nasa.gov>
- **API key required:** none
- **CORS:** the server sends `Access-Control-Allow-Origin: *`, so a browser can read
  it directly, including from a page opened as a local `file://` document
- **Verified:** endpoint returns HTTP 200 with real records; fields used are
  `data[0].nasa_id`, `data[0].title`, `data[0].center`, `data[0].date_created`
  and `links[0].href` (thumbnail)

The **NASA Open Data** panel in the dashboard runs three live searches —
`lunar surface`, `spacesuit extravehicular` and `plant growth` — and shows the real
title, NASA ID, responsible centre, date, thumbnail and a link to the record on
images.nasa.gov.

**Why it helps the project:** the challenge asks students to feel the real trade-offs
of a lunar outpost. Real NASA photographs of an Apollo spacesuit, a plant growing on
the station, and an astronaut on the lunar surface ground that trade-offs in
something concrete, without inventing fake numbers.

**If it fails:** the panel prints a plain message and the game carries on untouched.
This is handled in `script.js` by `addNasaErrorItem()` inside a `fetch().catch()`.
No part of the game logic depends on this request.

### 5.2 What was researched but is NOT wired into the app

**NASA Open Data Portal CKAN API**

- Endpoint: `https://data.nasa.gov/api/3/action/package_search?q=<term>&rows=N`
- **Verified working:** returns HTTP 200 and real dataset metadata
- **Deliberately not used in the browser:** the server does **not** send an
  `Access-Control-Allow-Origin` header, so a browser blocks the request. Using it
  would mean shipping a proxy or a backend, which this project avoids on purpose.

Datasets examined and relevant to lunar outposts:

| Dataset | Landing page | Why it is relevant |
|---|---|---|
| LRO DLRE 5 Polar Resource Product | <https://data.nasa.gov/dataset/lro-dlre-5-polar-resource-product> | Diviner Lunar Radiometer Experiment polar products — the measurements behind the permanently shadowed craters where water ice survives. This is the scientific basis for the "dig the ice deposit" option in the water event. |
| Human Robotic Systems (HRS): Robotic ISRU Acquisition Element | <https://data.nasa.gov/dataset/human-robotic-systems-hrs-robotic-isru-acquisition-element> | In-situ resource utilisation — using local materials instead of shipping everything from Earth. |
| Extra-vehicular Activity (EVA) - US and Russia | <https://data.nasa.gov/dataset/extra-vehicular-activity-eva-us-and-russia> | EVA history, which is what an outside repair on the Moon actually involves. |
| Apollo Image Atlas | <https://data.nasa.gov/dataset/apollo-image-atlas> | ~25,000 Apollo lunar photographs from orbit and the surface. |

**If you want to use one of these in a future version:** put a tiny proxy in front
of the CKAN API, or link out to the dataset page instead of calling it from the page.

### 5.3 Attribution

This project is an independent educational project. It is **not** affiliated with,
endorsed by, or operated by NASA or by the International Space Administration.
NASA, the NASA Image and Video Library, and the Apollo programme are the property of
their respective owners. NASA open data is generally not copyrighted, and the
Image and Video Library items used here carry NASA media usage guidelines.

---

## 6. NASA Space Apps Challenge 2026

This project was built to answer the official 2026 challenge:

> **Build a Junior Astronaut Mission Trainer**
> *Design and build an interactive game or app that lets students run a lunar or
> Martian outpost, balancing competing demands like life support, radiation
> shielding, power, and food production, so they experience firsthand the decisions
> that determine whether a mission fails or succeeds.*
>
> — Subjects: Games, Planets & Moons, Software, Space Exploration
> — Difficulty: Intermediate / Beginner-Youth

Challenge page:
<https://www.spaceappschallenge.org/2026/challenges/build-a-junior-astronaut-mission-trainer/>

### Important dates (verified)

| Date | What happens |
|---|---|
| 17 September 2026 | Challenge summaries released |
| **28 October 2026** | **Full challenge statements released, including required data sets** |
| 14–15 November 2026 | Hack weekend |
| 16 November 2026 | Judging begins |

### Honest status — read this before submitting

- The **full** challenge statement, including any *required* dataset, is **not public
  yet** as of the last update of this README. It is released on **28 October 2026**.
- Only the published **challenge summary** was available, so the requirements above
  are the summary's requirements, not the final statement's.
- Because the required dataset is not yet published, **this project must not claim
  that it satisfies any specific "use dataset X" requirement.** Once the full
  statement is out, check it line by line against this project before submitting.
- Nothing here guarantees a win, a nomination, or even eligibility. Those decisions
  belong to the judges.
- Space Apps is a **48-hour team hackathon** built on NASA's free open data. Follow
  your local event's rules about when work may start and who may collaborate.

---

## 7. What was tested

Tested automatically in headless Chrome (over the DevTools Protocol, with real device
emulation) and in Node.js:

- `index.html` loads and all three script/style paths resolve
- **No JavaScript errors** and **no console warnings** on load, during play, and on
  the results screen
- Start Mission, How to Play, Learn About Space, Home and both Restart buttons
- All **11 events**, and **every one of the 32 options**, can be chosen without
  errors
- Winning: completing all six REQUIRED objectives ends the mission in success on day 12
- Losing: oxygen, water, food, health and the 16-day time limit all end the mission
- Doing nothing at all still ends the mission on day 17 — the game cannot stall
- Restart returns every resource, modifier, objective, score and the day counter to
  their starting values, and a second full mission can then be played
- Double-clicking an option or **Continue to Next Day** is ignored
- **No horizontal overflow** and **no clipped text** on all six screens at
  **390 × 844 (phone)**, **768 × 1024 (tablet)** and **1440 × 900 (desktop)**
- The live NASA panel loads three real records; the game also completes normally when
  that request is refused
- The animated screen transitions always complete and never leave a screen stuck hidden
- No dashboard panel or Learn card is ever left invisible by a reveal animation —
  including after jumping straight to the bottom of the page
- The score counter finishes on the real score, and a success confetti burst plays
- No leftover confetti or flash nodes are left in the DOM after a mission
- **`prefers-reduced-motion`** is detected, still draws the sky as one static frame,
  keeps all Learn cards visible, and the game still starts and plays
- **No Canvas 2D support** — the page loads and the game is still fully playable

### 7a. Phase 0 base-layout work

Re-tested after making the base layout-driven (47 automated checks, 0 failures,
no JavaScript errors):

- All 7 catalogue entries exist, with `limit: 1` on the five critical systems and
  `limit: 3` on solar panels and supply depots
- The 7 starting structures build at exactly the positions they used before, and
  all 6 rocks, 7 crates and 8 pickups are unchanged — the opening scene is identical
- A rock that would sit under a placed structure is removed, so a layout can never
  hide terrain behind a building
- Two depots and two solar arrays build together with no id collisions; the mission
  marker flags both depots, and the depot type can still only be serviced once
- `showScreen()` reads the screens from the page, so adding a `<section class="screen">`
  to `index.html` is enough for a new screen to appear — verified by injecting a
  test screen at runtime
- The astronaut still walks, jumps the full lunar arc and lands; physics constants
  in `CFG` are untouched
- The standing repair animation now actually plays, and keeps playing while the
  station panel freezes the astronaut (it was overwritten by the idle pose on the
  next frame before)
- Station panels resolve by unique id; day 2 still offers 3 options at the solar
  array; choosing one completes `obj-power` and disables the buttons
- A non-resource entry in the day log is skipped instead of throwing
- Restart resets the day, the serviced list, and the full 7-structure base
- **The rendered world is byte-for-byte identical to the previous version** at four
  different camera positions, compared by SHA-256 with the clock, particles, stars
  and pickups pinned

### 7a. Phase 1 landing map

Re-tested after adding the map (96 automated checks total, 0 failures, no JavaScript
errors). The Phase 0 checks still pass, now routed through the map.

- Six sites with unique ids, valid southern coordinates, and no gaps in the difficulty
  scale from ★ to ★★★★★
- Every site states at least two advantages **and** at least two disadvantages
- **Honesty checks:** no site carries a `GAME ESTIMATE` marker inside its `facts[]`, no
  site's own invented percentages appear in its own facts, and the standing disclaimer
  is present on screen
- `Land Here` stays hidden until a site is chosen; landing with nothing selected is
  refused; `Back` returns to the welcome screen
- Every site is reachable three ways: its dot, its label chip, and the keyboard-reachable
  list. Clicking empty sky selects nothing
- Comparison pins up to three sites, drops the oldest when a fourth is added, unpins
  correctly, and marks its rows as game values
- Re-opening the map clears the previous choice; leaving the map stops its render loop
- **The site changed nothing about the simulation through Phase 2:** day-one resources
  were identical with a site chosen and with none, which is what made Phase 3 the first
  place the site could affect play. Phase 3 changed this — see 7c
- The map screen has no horizontal overflow at **390 × 844**, **768 × 1024** or
  **1440 × 900**
- `script.js` still runs standalone with `world.js` absent, and the site is still carried
  through to the mission
- The 2D Moon Base is still **byte-for-byte identical** to before Phase 1

### 7b. Phase 2 base builder

Re-tested after adding the builder (162 automated checks total, 0 failures, no
JavaScript errors). The Phase 0 and Phase 1 checks still pass, now routed through the
builder.

- All eight structures exist, each with a cost and a role, and the pad has its own
  sprite frame, service and status readout
- **The eight together cost 108, which the easiest site can afford and the hardest
  cannot improve on** — so the zone choice really does squeeze the layout
- The builder starts from the shipped base, hides the play HUD and the NASA panel, and
  `world.mode` is `'build'`; leaving restores all of it exactly
- Placing snaps to the grid, deducts cargo, and is refused with a stated reason when
  too close, off the edge, over the limit or unaffordable
- **There are at least a dozen legal positions on the plot**, and two structures can
  never visually overlap. Both are asserted, because tightening the grid or the gap
  would silently make the map unbuildable
- Solar panels and supply depots allow three; habitat, oxygen, water, food, console and
  pad refuse a second
- Moving a structure works, is refused into an occupied spot without moving it, and does
  not double-charge the cargo; removing refunds it exactly
- A structure may be built over a rock and the rock is cleared
- **Collected canisters stay collected across five relayouts**, and editing the layout
  cannot farm supplies
- A base missing the pad cannot continue, and the panel names what is still needed
- A finished base launches a real mission that uses all eight structures; the pad is
  walkable to, has a panel, and can be serviced
- The astronaut still walks and jumps after building; the landing map still works
  afterwards; changing site keeps the base that was built
- No horizontal overflow at **390 × 844**, **768 × 1024** or **1440 × 900**
- `script.js` still runs standalone with `world.js` absent: the builder steps aside and
  the mission starts directly, exactly as it did before Phase 2
- The **play** scene is still **byte-for-byte identical** to the previous commit at four
  camera positions

### 7c. Phase 3 mission preparation and survival

Re-tested after adding the simulation (162 automated checks across the three suites,
0 failures, no JavaScript errors). The Phase 0, Phase 1 and Phase 2 checks all still
pass, and the 2D play scene is still **byte-for-byte identical** to the previous commit
at four camera positions.

**Pre-flight and the Start Mission button**

- The launch button reads **Start Mission**, and is disabled until the base passes
- The checklist lists 8 structures, 5 supply minimums and 4 balance projections — 17
  lines, each with a label and a stated reason
- An incomplete base is blocked and the panel names exactly what is missing
- Every line states a reason, and the block is tagged `GAME ESTIMATE`
- **Every `[hidden]` element is checked by computed style, not by the flag alone.** The
  `.build-bar` rule had a `display: grid` that beat the browser's `[hidden]` default,
  so the entire builder stayed on screen under the running mission. Found by taking a
  screenshot; now fixed and guarded
- The builder is genuinely gone after launch, the palette has zero height, and the play
  HUD is showing

**The site and the layout both change the numbers**

- All six sites produce a different projected power balance, and all six are still
  survivable over 16 days at the minimum base
- Shackleton beats Cabeus B by 11 power a day; Cabeus B generates barely a third of
  Nobile's solar; Cabeus B needs the least heating and Tycho loses the most to dust
- **Three solar arrays raise generation from 18.3 to 36.5** and turn the balance from
  +2.2 to +19.4; removing the only array turns it to −6.4
- Removing the habitat turns daily health from +3 to −4
- A full 12-day mission was sampled day by day: oxygen, water, food and condition all
  move in the right direction and nothing goes out of range

**The 16 day limit**

- Day 16 with every objective done **is** a victory; day 17 is not
- `endMission(true)` called directly on day 40 is still downgraded to a failure
- Departure never appears on a day past 16, and slides from day 12 when objectives are
  outstanding

**Objectives and exploration**

- All six required and six optional objectives exist; the original required six are untouched
- Exploration completes at exactly 6 canisters and not at 5; the survey completes at 4
  structure types and not at 3
- Two new emergency scenarios per system, five in total, each hosted by the structure
  that broke, each with three explained options and at least one real repair
- A worn system queues its emergency, the emergency replaces the scheduled scenario,
  and repairing it restores the condition and clears the fault

**Maintenance and storms**

- Tycho wears a solar array to 61% over 10 days where Nobile only reaches 78%
- Servicing restores a system to exactly 100; a system under 35% counts as failed and
  delivers at most a quarter of normal
- The four dustier sites get the day 10 storm, the two clean sites get none, and only
  the dustiest site gets the early day 5 one
- A storm cuts solar, is logged in the day's report, and is counted

**A whole mission, run twice**

- Unattended, taking the first option at every scenario: ends on day 16 with
  *"Mission time ran out"*, 6 of 8 objectives, score 49, **no emergencies**, and every
  value in range
- Unattended, never repairing anything, at the dustiest site: all five systems fail,
  power hits zero on day 11, a solar emergency fires on day 13, crew health ends at 44
  — so maintenance demonstrably changes the outcome

**State safety**

- Corrupting the state on purpose (negative oxygen, 999 water, `NaN` food, a string as
  power, a negative day, a made-up objective key, 4000% condition) is repaired on every
  one of those seven counts
- 40 unattended days produce no out-of-range value and no impossible state

**Preserved**

- A perfect mission still scores exactly **100**, a failed one exactly **60**, and a
  wiped-out one exactly **0**
- The astronaut still walks and jumps, animations still run, the landing map still
  works, the builder still works, and the NASA panel is still wired
- No Phase 3 number leaked into any `facts[]` array

**Layout**

- No horizontal overflow at **390 × 844**, **768 × 1024** or **1440 × 900**, with the
  checklist on screen, and no checklist element extends past the viewport

### 7d. Phase 4 NASA lunar data

Re-tested after adding the verified data (261 automated checks across four suites,
0 failures, no JavaScript errors). Phases 0, 1, 2 and 3 all still pass, and the 2D play
scene is still **byte-for-byte identical** to the previous commit at four camera
positions.

**The data itself**

- Six zones, no holes; every zone resolves and has a lunar record with a real diameter
- Every cited source exists and every source has an http(s) URL
- Ice status is one of the four known values, and only Cabeus is `detected`
- Each corrected figure was asserted against the source it came from: Tycho 85.29 km,
  Cabeus 100.58 km, Nobile 79.27 km, Sylvester 59.28 km, Shackleton 20.92 km, Haworth
  51.4 km, and the Shackleton illumination 89.3% / 3.0 days
- No zone is named "Sylvester N" any more, and the Sylvester site is genuinely in the
  southern hemisphere

**Nothing invented**

- Every `elevation` and `slope` field is `null` — asserted for all six sites
- The real LOLA elevation dataset is cited and named as an LRO instrument
- A site with no published illumination figure says *"Not published"* instead of
  inventing a percentage
- No game percentage leaked into any `facts[]` array
- No row labelled VERIFIED contains a game figure

**The map**

- Three zoom levels; the disc covers 3,475 km / 1,439 km / 613 km and the scale
  shrinks with it — 19.58, 8.11 and 3.45 km per pixel
- **Every site is reachable at every zoom level**, with rim chevrons carrying hit areas
- Shackleton is no longer plotted on the pole itself
- Re-opening the map resets the view to the whole hemisphere
- Hit testing still finds a site by its dot *and* by its label chip, as in Phase 1

**The site panel**

- Has VERIFIED DATA, INTERPRETATION and NOT BUNDLED blocks
- Every verified row carries a citation link, and no verified row is a game number
- Elevation and slope are always reported as missing
- Tycho explains its lack of ice as an *interpretation*, with the latitude that drives it
- Cabeus B reports the LCROSS measurement directly
- Game values are still labelled `GAME ESTIMATE`, and now sit *below* the verified data

**NASA images, against the live API**

- The endpoint is unchanged and keyless, and no key, token or secret appears anywhere
- Tycho returns a real photograph with attribution, a NASA ID and a details link
- The five polar craters return empty, and the panel explains the gap and links onward
- An empty response is distinguished from an error; a stale reply cannot overwrite the
  current card; markup in an API field cannot reach the page

**The site reaches the mission**

- A confirmed ice site lowers the survey target to 3; everywhere else it stays at 4
- Three structures complete the survey at Cabeus B and do *not* elsewhere
- The results report carries the ice summary line
- Scoring bands (24 + 6 = 30), the 16-day limit and the objective list are intact
- The world, animations, builder, pre-flight checklist (now with a fourth "published
  record" block) and survival simulation all still work

**Layout**

- No horizontal overflow at **390 × 844**, **768 × 1024** or **1440 × 900** with the
  site panel open, and none with the zoom controls on a phone

### 7e. Phase 5 challenges, objectives and achievements

Re-tested after adding Phase 5 (395 automated checks across five suites, 0 failures,
no JavaScript errors). Phases 0, 1, 2, 3 and 4 all still pass, and the 2D play scene is
still **byte-for-byte identical** to the previous commit.

**The catalogue**

- Six challenges, each with a title, a host structure, a brief of real length, a science
  explanation, three answers, and a failure consequence
- All six required subjects are covered — air, power, water, food, equipment, rover
- Every threshold is a plain number in range, and every challenge names a deadline or
  declares itself continuous

**Triggers and one-shot behaviour**

- Low oxygen, low power, low water, low food, a worn system and day 7 each start their
  own challenge, and a healthy base starts none
- **A challenge never starts twice**, even with three update passes in one day
- A base without the host structure cannot be challenged to repair it
- A settled challenge **cannot be answered again** — the second attempt is refused and
  changes no resource, and the challenge is counted as handled only once

**Success, failure and deadlines**

- The proper repair settles the challenge and really does raise the store
- A patch is recorded as **partial**, not as fixed
- Ignoring it **fails** the challenge and is counted
- The deadline is set from the day it started; unanswered, it expires and is counted
- Answered before the deadline, it does not expire
- A continuous challenge survives while the resource holds and fails when it falls
- All six can be started and settled properly in an end-to-end run
- The challenge card states the brief, the science, the deadline, the success condition
  and a `GAME ESTIMATE` tag

**Objectives**

- Six required and six optional, with the original six all still required and the two
  science objectives now optional
- `Bring an ice sample back` appears at Cabeus B and not at Tycho — the Phase 4 record
  driving a Phase 5 objective
- `Finish with every system above 70%` appears only with a habitat and a depot built
- Progress is reported (`3/6`), never exceeds its target, and is drawn in the HUD
- An objective that cannot apply is listed on the results screen as *not available*,
  not silently dropped

**No duplicate rewards**

- An objective pays out once; three calls in a row return `true, false, false`
- A made-up objective id is refused
- Ten daily sweeps in a row pay nothing extra
- `awardOnce()` pays exactly one time across three calls

**Achievements**

- Eleven, each with a readable condition and an icon
- `First Repair` unlocks on the first repair; `Every Canister` at eight
- An achievement cannot unlock twice
- `Home Safe` cannot be earned by a failed mission
- **The cheat attempt** — every badge condition set true, a forced day-20 "success" —
  still ends as a failure, still scores as one, and hands out **no outcome badge**

**The 16 day limit and scoring**

- Day 16 with everything done is a victory; day 17 never is
- Every *required* objective on day 17 is still a failure
- Optional objectives do not hold the launch up
- The objective band is still 30 in total: 24 required + 6 optional
- A perfect mission scores exactly **100**; a failed one exactly **60**; a wiped-out
  base exactly **0**; absurd state with every objective ticked still exactly **100**

**Restart**

- Every challenge, award, badge, repair count, canister count and survey count resets,
  and the clock goes back to day 1

**A whole mission**

Unattended, answering every challenge properly: 2 challenges settled, 0 failures, 5
badges, finished on day 12 as a success, score 68, and no value left its range at any
point. Power reached zero on day 12 — the tension is real.

**Preserved**

- The world, map, builder, pre-flight checklist, survival simulation, emergency
  scenarios and NASA panel all still work
- No horizontal overflow with the challenge HUD at 390 × 844, 768 × 1024 or 1440 × 900,
  or on the results screen

**Optional-file robustness** (new)

`challenges.js` is optional in the same way `world.js` and `mission.js` are. A page
with it deleted still runs a mission, still has all six required objectives, and still
renders the results screen — with no errors. A stub block in `script.js` covers the
seven functions the rest of the game calls from that module.

### Still worth checking by hand

- Screen-reader pass (NVDA, Narrator, VoiceOver)
- Colour contrast on your specific monitor
- Real touch scrolling on a physical phone
- Frame rate on a low-end phone — automated checks cannot measure this
- Firefox and Safari — automated tests ran in Chromium only

---

## 8. Keyboard support

| Key | Action |
|---|---|
| `Tab` / `Shift + Tab` | Move between buttons |
| `Enter` or `Space` | Activate the focused button |
| `1`, `2`, `3` | Pick that decision option during the game |

The page respects the operating system's **Reduce Motion** setting.

---

## 9. Ideas for extending it

The project is deliberately modular so it can grow:

1. **Radiation shielding** — the challenge summary names it explicitly, and the game
   currently does not model it. A solar particle event that raises dose while you are
   outside would fit the existing `mods` pattern.
2. **Difficulty levels** — change `MISSION_LENGTH_DAYS` and the constants in Section 1
   of `script.js`. A "Beginner" mode could start resources at 100 with half the daily
   use.
3. **More events** — add an entry to `EVENTS` and a day number to `SCHEDULE`.
4. **Crew names and skills** — three astronauts with different weaknesses would make
   the health penalties more interesting.
5. **Real mission mode** — swap the invented numbers for figures from a published
   NASA study, once you can cite exactly which one.
6. **More animation** — everything visual lives in `fx.js`, so new effects never risk
   the game rules. Try a comet passing on a longer loop, or a dust-devil effect during
   the storm event.

Add new events to the `EVENTS` object and a matching day to the `SCHEDULE` object.
Nothing else needs to change.