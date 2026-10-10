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
3. It opens in your default browser. Press **Start Mission**.

That is the whole install. You can also right-click `index.html` → *Open with* →
Chrome, Edge or Firefox.

> **Optional:** if you want the live NASA panel to load, you need an internet
> connection. Everything else in the game works completely offline.

---

## 2. Project files

| File | What it does |
|---|---|
| `index.html` | All five screens: welcome, how to play, learn, the playable Moon Base, results |
| `style.css` | The dark space theme, resource cards, the CSS-drawn Moon base, every keyframe |
| `script.js` | All the **rules**: settings, events, resource maths, scoring, the station bridge, the NASA panel |
| `world.js` | All the **drawing and movement**: the structure catalogue, terrain, astronaut, physics, camera |
| `sprites.js` | Generated frame map — where each frame sits inside `assets/sprites.png` |
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

Keep all three astronauts healthy for **16 mission days** and finish all **6 objectives**.

### The daily cycle

Every mission day the base automatically:

1. **Makes** electricity with the solar panels (+22 on a clear day).
2. **Uses** electricity (14), oxygen (8), water (6) and food (5).
3. **Hurts** crew health if oxygen drops below 25, water or food below 15, or power
   reaches zero.

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

There is no way to stall. The game always ends.

### How you win

Complete all six objectives. The mission ends immediately in success, on day 12 at
the latest.

### The six objectives

1. Restore full solar power to the base
2. Restart the water recycling loop
3. Get the hydroponics bay producing again
4. Repair the CO2 scrubber
5. Ride out the lunar dust storm safely
6. Return the crew safely to Earth

### The eleven events

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
| 12 | Departure Day | ✅ return |

Every option in every event really does something. Choosing to *not* repair a
recycler does not just cost you points once — it costs you water **every single day
after that**, which is the main lesson the game tries to teach.

### Scoring (out of 100)

| Category | Points |
|---|---|
| Objectives completed | 5 each (max 30) |
| Astronaut survival | 25 for 3 alive, 17 for 2, 8 for 1 |
| Crew health | up to 15 |
| Resources remaining | up to 20 |
| Efficiency (nothing left critically low) | up to 10 |
| **Failed missions** | multiplied by **0.6** |

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

The **Learn About Space** screen inside the game labels every fact as either
`REAL SCIENCE` (sourced from NASA) or `GAME RULE` (invented for teaching). Please
keep that distinction if you extend the project.

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
- Winning: completing all six objectives ends the mission in success on day 12
- Losing: oxygen, water, food, health and the 16-day time limit all end the mission
- Doing nothing at all still ends the mission on day 17 — the game cannot stall
- Restart returns every resource, modifier, objective, score and the day counter to
  their starting values, and a second full mission can then be played
- Double-clicking an option or **Continue to Next Day** is ignored
- **No horizontal overflow** and **no clipped text** on all five screens at
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