# Review for tomorrow: develop, current release A, and proposed future events

Prepared for review on 15 September 2026 after the work on 14 September
(Europe/Paris). The comparison baseline is remote `main` at
`6823bdf34b4076917cfe9b4a6b859dbe63818b2c`. The release is on lowercase `develop`;
this is not a merge or deployment to `main`.

This report covers the combined release developed over several days, including
the earlier leisure, economy, city and performance work. Those earlier commits
are expected parts of the release, not unexplained changes. **Performance is a
major release deliverable:** retained scenery and construction buffers, cached
incident shots, cheaper actor updates and a sleeping hidden mine reduce rendering
and main-thread work. Section 5 gives the measured results and their limits.
Package A is implemented. Package B is a documented
future proposal in [issue #42](https://github.com/Starbugstone/Prospect-Hollow/issues/42),
with concept art on a separate design branch.

## 1. What the player gets on develop compared with main

| Area                       | Main baseline                                                          | Develop release                                                                                                   |
| -------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Playable eras              | Four: Frontier, River & Rail, Industrial/Electric, Motor Age           | Eight dated eras, including 1920 rebuilding, 1958 aviation/radio, 1986 music/TV and 2005 Connected City           |
| Unique puzzles             | 144 in 24 chapters                                                     | 324 in 54 chapters: 96 added by the earlier city expansion, then 84 by release A                                  |
| Town plots, excluding mine | 37                                                                     | 53: two leisure plots, four rebuilding plots, five aviation/broadcast plots and five Connected City plots         |
| Late puzzle variety        | Existing ice, stone, chains, seals, relic deliveries and board bonuses | Those mechanics continue; levels 241–324 add ore orders, lanterns and ordered survey trails                       |
| Town guidance              | Existing suggested next building and plot directory                    | Optional named projects show grouped construction milestones from Frontier onward                                 |
| Horse/dog content          | No dedicated horse-field/park plots                                    | Buildable horse field and dog-walking park with ambient animation; their special cinematic events are future work |
| Landmark investment        | No playable airport or city towers                                     | Airport, business tower and residential city towers have the agreed 25% premium and two-puzzle first construction |
| Puzzle failure budgets     | Unlimited moves                                                        | Still unlimited; permanent contributor rule and explicit regression coverage                                      |
| One-off story cinematics   | Existing era/incident presentation                                     | Existing scenes improved; the new seven-story cinematic package and global director are proposed, not shipped     |

The first 144 puzzles are retained from the earlier campaign. The latest extension
also preserves all 240 pre-extension gameplay configurations, checked with a
digest over layouts, seeds, objectives, tips and reward targets. The digest omits
only ephemeral gem IDs and the new empty ore-order field. The tested cowboy
opening has not been rebalanced by this release.

### The actual era journey

| Era/date                  | New content and visible progression                                                                                                                                                                                                                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontier, c. 1865–1880    | Familiar opening and services. Projects appear only after the first home is complete; no compulsory new tutorial or cost.                                                                                                                                                                                         |
| River & Rail, 1884        | Existing bridge, river trade and railway growth. Projects group river trade, railway arrival and market street.                                                                                                                                                                                                   |
| Industrial/Electric, 1908 | Existing utility/industrial district, plus the buildable horse field from earlier develop work. Electricity, motor response and correct field clearance are maintained.                                                                                                                                           |
| Post-war Rebuilding, 1920 | After World War I, before Motor Age. City hall, courtyard apartments, food hall and water plant. Existing services retain their previous facades until their own modernization completes. Motor traffic no longer regresses to ordinary stable horses; passenger railcars and sound reflect transport generation. |
| Motor Age, 1932           | Existing cars, buses, garage, diner and gardens; the added public park has playground growth and dog/owner activity. The waterfront keeps its physical pier.                                                                                                                                                      |
| Aviation & Radio, 1958    | Large western regional airport and radio station. Three airport stages develop terminal/tower/hangar/lounge/apron details. Twin-turboprop activity uses a clear runway and flight corridor.                                                                                                                       |
| Music & Television, 1986  | Concert hall, television studios and business tower. Broadcast signs, aerials, taller facades and the new skyline bridge the historical gap.                                                                                                                                                                      |
| Connected City, 2005      | Internet café, technology campus, city towers, transit interchange and river promenade; computers, server displays and digital-service details make the period recognizable. The saved `contemporary`, `library` and `crystalLab` identifiers are retained for compatibility.                                     |

New buildings remain unavailable before their introduction era. Existing buildings
continue through later modernization stages; advancing the calendar does not
instantly replace every facade or grant its benefits twice. Town completion still
depends on the actual era building requirements. Projects are guidance and do
not replace or add to that gate.

The new capacity buildings are functional, not decorative purchases: rebuilding
apartments add up to 24 resident places, food and water facilities add up to 54
places each, and city towers add up to 18 resident places. Happiness additions
remain bounded by the existing cap. The horse field contributes 2/4/6 happiness
across its stages; the park contributes 3/6/9. Those are totals, not cumulative
grants every time a scene appears. These benefits predate tonight's package A.

### What was fixed from issue #41

- Power poles are placed clear of active roads, junctions and the mine forecourt;
  shared placement also feeds the accessible map.
- Horse-field construction barriers sit outside the fence. Animated horses stay
  in clear pasture, away from the shelter, trough and seating.
- Surrounding hills are reduced to 24% of their previous height. The western
  airfield/corridor is flattened while river and railway features remain.
- The airport occupies a 20 × 40 world-unit site at the far west. Its north–south
  runway is perpendicular to the east–west railway; takeoff proceeds south through
  open airspace instead of toward a mountain.
- The pier survives industrial, automobile and later waterfront modernization.
- Rebuilding preserves the appropriate motor transport rather than reverting
  the town's transport generation.
- Incidents are shorter: Frontier raids 24 seconds instead of 48, civic incidents
  16 instead of 26. Motor responders dismount near the action.
- The incident camera eases from the player's view, follows the action and restores
  the saved pose; phase changes no longer keep reframing the whole settlement.
  Reduced motion and interrupted presentation retain control-restoration checks.
- Missing historical steps are supplied by 1958 and 1986. The generic 2005 identity
  becomes the computer/internet city described above.

The city, leisure and future-era art packs include Blender sources, GLB interchange
exports, review renders and reproducible authoring scripts under `art/` and
`scripts/`. The browser consumes indexed exported meshes; Blender is not a runtime
dependency. New landmarks also have selectable SVG representations for the
accessible/non-WebGL town. This is actual runtime art, separate from issue #42's
aspirational concept PNGs.

### Construction duration and prices: exact scope

| Purchase                                                                      | Duration in completed normal puzzles                                    |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Airport, business tower (`skyline`), city towers (`cityHomes`): initial build | 2                                                                       |
| Those three buildings: functional upgrades                                    | 1 each                                                                  |
| Those three buildings: later-era modernization                                | 1 each                                                                  |
| Ordinary existing-building modernization                                      | 2 for entering the new era, then 1 and 1                                |
| Other new city buildings                                                      | 1 per stage                                                             |
| Earlier non-city construction                                                 | Existing authored durations retained; for example leisure remains 1/2/2 |
| Eligible builder hammer action                                                | Existing free instant completion                                        |

The premium landmarks cost 15,000 / 18,750 / 22,500 coins for their three original
stages, compared with ordinary late city buildings at 12,000 / 15,000 / 18,000.
Their later city modernization quotes also carry 25%. Already-funded legacy work
keeps its paid terms and completed progress. No extra charge is introduced on
reload. These construction puzzle counts are never move limits inside a puzzle.

## 2. Package A: projects and clearer intermediate goals, implemented now

There are 23 named projects: two in Frontier and three in every subsequent era.
Each groups actual existing buildings and offers three milestones: **Open the
doors**, **Make room to grow**, **Complete the project**. A milestone means all
featured buildings have reached stage one, two or three in the current era.

For example, **Open Prospect Airport** includes airport and radio tower. A player
can see each building's current stage, price, requirements, active construction
and readiness, then open its normal construction dialog. The panel counts work
already completed, including hammer builds; the player need not select the
project before making progress. The chosen focus persists through reload and
save export/import. Building elsewhere remains available.

| Era            | Project groups                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| Frontier       | Well/farm/home; stable/shop/school                                                                      |
| River & Rail   | Bridge/river port/warehouse; rail depot/post/hotel; market/shop/square                                  |
| Industrial     | Power house/mill/rail depot; fire station/doctor/row houses; blacksmith/warehouse/market                |
| Rebuilding     | City hall/school/square; apartments/food hall/water plant; bridge/river port/hotel                      |
| Motor Age      | Garage/bus depot/diner; garden court/park/row houses; bridge/rail depot/post                            |
| Aviation       | Airport/radio station; hotel/bus depot/diner; apartments/school/park                                    |
| Broadcast      | TV studios/concert hall/business tower; museum/square/park; airport/radio station/bus depot             |
| Connected City | Transit/technology campus/promenade; city towers/apartments/water plant; internet café/museum/city hall |

The purpose is to turn a long list of upgrades into understandable local goals
with frequent visible completion. The panel is available in embedded and
fullscreen town views, fits narrow screens and is translated into French.

Package A has no new project payout, separate project currency, event countdown,
side-quest obligations or premium finale movie. It uses the existing building
visuals and construction presentation. The richer permanent cosmetics and
high-quality character cinematics belong to package B. This distinction matters
when reviewing the promised emotional payoff: A supplies structure now, while B
still needs production to supply the more ambitious spectacle.

## 3. New gem-puzzle mechanics: what changes and why

All 84 new puzzles use 7 × 9 boards with five gem colors. Existing matching,
cascades, board bonuses, ice, stone, chains, color seals and relic-delivery rules
continue to work. The additions are objectives and floor interactions, not
purchased gadgets or a new inventory currency.

### Ore orders, introduced at level 241

The HUD shows a requested gem color and collection count. Match that color to
fill the order; cascades and powers also count. Later orders can request two
colors. The authored targets are 12 per color in introductory/breather puzzles
and 18 in the other phases. Requested colors always occur in that level's
replenishing palette, so a finite initial supply cannot make the goal impossible.

This changes the choice between clearing a convenient patch of ice and pursuing
a needed color. It gives normal cascades a second useful purpose without adding
another resource to manage. Counters stop at the target, reset on replay, and are
included in normal victory checks. Fusion clears have a separate objective
receipt so counting ore does not accidentally increase the mining payout.

The inspiration is the familiar color-order interaction in matching games,
adapted to mining freight and supplies. It is deliberately easy to understand
after hundreds of levels and works with the board's existing bonus vocabulary.

### Lanterns, introduced at level 247

A lantern is a fixed floor marker. Match on its cell or an orthogonally adjacent
cell to light it; blasts and inventory powers can also activate it. Gems keep
falling through the cell normally. Lit lanterns become visually subdued, letting
the player see which targets remain. Introductory/breather layouts use fewer
markers, with other layouts generally using up to four.

This gives the player a reason to make a useful match near a location rather
than only maximizing the number of cleared gems. The adjacency rule prevents
the marker from relying on one exact gem alignment. Because it neither anchors
a gem nor blocks gravity, it fits the existing narrow chambers and delivery lanes.

The interaction borrows the readable nearby-match activation seen in light-bulb
and firefly objectives, using the mine's own lantern imagery and board rules.

### Survey trails, introduced at level 259

Numbered floor markers must be activated in sequence. Match on or beside marker
1, then 2, then 3; more demanding layouts include a fourth. The active next number
is the only survey marker that responds in one resolution step. A later cascade
may light the next marker, but one simultaneous blast cannot skip the entire
trail. Completed markers show a check.

This adds a small planning sequence: a powerful clear is still useful, but its
timing and location matter. It provides room for skilled cascade setup without
requiring fast fingers or adding a move cap. Survey markers share the proven
lantern contact rule and remain passable floor cells, so the mechanic does not
introduce a new kind of blocked board.

Hints now recognize remaining ore and signal objectives. Their previews remain
deterministic; asking for a hint does not roll future refills or consume gameplay
randomness. Board animation, HUD counters, mobile layout and French instructions
were extended alongside the engine, rather than leaving goals invisible to players.

### Where the new mechanics appear

| Levels  | Chapter             | Main interaction                           |
| ------- | ------------------- | ------------------------------------------ |
| 241–246 | Freight crossings   | Ore orders and freight routes              |
| 247–252 | Foundry arches      | Lanterns around stone arches               |
| 253–258 | Reservoir links     | Two-color orders and channels              |
| 259–264 | Courtyard passages  | Ordered survey trail                       |
| 265–270 | Switchyard seams    | Lanterns; selected levels also have orders |
| 271–276 | Terminal galleries  | Orders and deliveries                      |
| 277–282 | Airfield vaults     | Survey beside delivery lanes               |
| 283–288 | Radio relays        | Lanterns and color seals                   |
| 289–294 | Studio crossroads   | Survey; selected levels also have orders   |
| 295–300 | Skyline foundations | Lanterns around foundation shelves         |
| 301–306 | Promenade routes    | Survey and river deliveries                |
| 307–312 | Network vaults      | Lanterns; selected levels also have orders |
| 313–318 | Heritage loop       | Alternating lantern and survey puzzles     |
| 319–324 | Hollow homecoming   | Survey finale and selected orders          |

Each six-level chapter follows introduction, practice, delivery, stretch,
recovery and finale. Authored shelf arrangements differ; interior delivery lanes
and the lowest two rows avoid the worst last-row ice cleanup. Ice is at most two
layers. Chapters declare their mechanics in one plan, avoiding scattered chapter
number checks when more content is added.

The same three mechanics are recombined across 14 chapters; there are not 14
entirely different gadgets. Whether that variation feels sufficiently fresh over
84 puzzles still needs human review. Likewise, the new mechanics begin after
level 240, not automatically upon reaching a particular town era: puzzle progress
and town spending can proceed at different rates.

Unlimited moves are explicit in `AGENTS.md` and runtime behavior. A missed speed
bonus never prevents completion; free dead-board reshuffling remains. These
objectives must be completed to win their levels, but they do not impose a move
budget, hard puzzle timer, purchased-power requirement or campaign payment gate.

## 4. Does the campaign fund all eight eras?

The previous 240-level campaign did not reliably cover ordinary completion of
the expanded town. The latest measurements use actual payouts from the new
324-level campaign, then feed them through the campaign store, including coin
purchases, construction, chapter gifts, chests, inventory eligibility, hammers,
incidents and era advancement. This supersedes the older report that extrapolated
by replaying level 240.

| Strategy, five seeds each                        | Final completion median | Range   | Meaning                                                                     |
| ------------------------------------------------ | ----------------------- | ------- | --------------------------------------------------------------------------- |
| Ordinary, one chest                              | 293 puzzles             | 290–297 | All sampled towns finish within 324; 27–34 unique puzzles remain            |
| Prioritize hammers/coins, one chest              | 263                     | 261–268 | Successful targeted roulette plus valuable hammer spending                  |
| Prioritize hammers/coins, two chests             | 219                     | 218–222 | Favourable skilled-reward scenario; 102–106 unique puzzles remain           |
| Ordinary with only 75% of measured mining payout | 329                     | 328–333 | Stress simulation needs 4–9 replays; the game payout itself was not reduced |

| Era complete, cumulative puzzles | Ordinary | Targeted, one chest | Targeted, two chests |
| -------------------------------- | -------: | ------------------: | -------------------: |
| River & Rail                     |       53 |                  44 |                   34 |
| Industrial / Steam               |       81 |                  67 |                   55 |
| Rebuilding                       |      116 |                  99 |                   81 |
| Motor Age                        |      158 |                 138 |                  114 |
| Aviation                         |      198 |                 174 |                  146 |
| Broadcast                        |      241 |                 216 |                  180 |
| Connected City                   |      293 |                 263 |                  219 |

The ordinary final era takes 50–54 puzzles, median 52, funding approximately 3.06
construction stages per puzzle. All 943 required construction/upgrade stages
complete. The sampled workflow never reaches a town visit with neither
construction activity nor an active project.

These are active builders who return after each puzzle, finish ready work and
start all affordable suggested construction in parallel. They are not players
who buy only one item and immediately leave. The simulation omits passive saloon
income, purchased items and spent inventory powers. Targeted play assumes the
player successfully selects hammers/coins; two-chest play assumes both optional
qualifications every time. This is not proof of a mathematically optimal strategy
or a human completion-time estimate.

**What this means for durability:** ordinary sampled play has enough content and
keeps making purchases, but the full-city modernization workload remains large.
Projects organize it without reducing it. Very skilled reward targeting can finish
the town before the new mechanics even begin. Lower earners can still need a few
replays. Those are concrete remaining tuning questions, not grounds for secretly
changing money gains.

### Economy evolution across the combined release

Tonight's release A and abstraction work do not alter money gains or bonus
formulas. However, earlier `develop` commit `2dcbd0a`, already present before the
current work, changed chest coin scaling compared with `main`:

- Main: 500 coins multiplied by the chapter number.
- Current develop: chapters 1–3 remain 500/1,000/1,500; each later chapter adds
  250, capped at 4,000 from chapter 13.
- Example: level 144's coin chest is 4,000 on develop versus 12,000 on main.
- Versioned pending legacy receipts retain their earned terms; claimed coins
  are not retroactively reduced.

Earlier develop also raised Industrial stage prices to 1,400/1,850/2,300, Motor
modernization to 3,500/4,400/5,300, and new Motor construction to
6,480/9,000/11,880. Those are inherited changes, not changes made by package A.
Mining depth still follows the existing formula; new deeper chapters naturally
earn more through that unchanged formula. A blanket statement that develop's
economy equals main would therefore be incorrect.

## 5. Performance and maintainability: a major part of this release

The era refactor centralizes shared behavior in validated era profiles: building
style, modernization and new-building prices, service capacities, transport,
electricity, incident type, road appearance, asset aliases and drawing details.
One modernization-offer factory applies the common contract. Appearance and
rendering providers preserve each style's distinct art. Three.js and accessible
Vue drawings now consume the same relevant capabilities.

Adding an era that reuses a supported style no longer requires duplicating these
lists and branches across consumers. A genuinely new style still needs its
renderer, accessible art and content. JSDoc interfaces document these contracts
without adding an unnecessary class hierarchy. Profiles are built once, not
allocated during animation frames. Invalid authored profiles fail early; unknown
save-era keys safely fall back. Asset resolution handles overlapping era names.

The permanent `AGENTS.md` rules cover unlimited moves, preservation of normal
rewards, shared configuration, interfaces/factories where duplication warrants
them, and reusable progression/event/presentation lifecycles. The architecture
guide explains how to extend the system and what is intentionally still content
specific. The future event director is documented separately; it is not being
smuggled into this release under the refactor.

Across the broader develop review, duplicate bonus resolution and run cleanup
were consolidated, unused declarations/exports and obsolete raid overview logic
removed, and Blender packs share primitive/material/joint/export tooling. Tests
were updated from fixed old-era lists and duplicated renderer selection to the
actual shared contracts. Meaningful extension tests add unseen era IDs and compare
their geometry with the base style. All 32 pre/post-refactor town snapshots match,
covering eight eras at four states and their offers, capacities, transport,
electricity, road colors, incidents, variants and gates.

Performance changes retain unchanged plot geometry, roads, mine infrastructure,
static batches and scenery buffers across construction changes. They avoid
repeated framebuffer-status queries, compile route distances/headings once, cache
aircraft joints, avoid updating invisible aircraft, and store actor colors without
per-frame RGB-string creation. Adaptive resolution now reacts to sustained very
slow frames. The hidden mine renderer sleeps behind chests/results.

Measured examples from the review, not hardware FPS promises:

- A stationary incident previously invalidated scenery on 240/240 sampled frames;
  afterward it invalidated 0/240 in the controlled sample.
- A completed Connected City refresh submitted 192 draw calls / 389,628 triangles;
  a cached frame submitted 77 / 45,430. That is roughly 88% fewer submitted
  triangles in that scenario, not an 88% frame-rate increase.
- Earlier construction-update samples fell from approximately 43–164 ms to
  10–19 ms across the first four era fixtures when unchanged scenery was retained.
- A jackpot sample reduced browser main-thread work from 650 ms to 54 ms over
  roughly 1.24 seconds by sleeping the hidden mine; visible frame rate was not
  demonstrated to improve by the same percentage.
- Repeated later-era town/mine returns retained stable counts of 210 geometries
  and 58 textures in the reported fixture.

Large production JavaScript chunks remain. Initial download, parse and cold scene
creation still cost time. Browser checks here use software WebGL; named physical
mobile devices, Safari, Firefox and native Capacitor builds have not received this
full pass. Fluid hardware play is a remaining validation goal.

## 6. Verification and practical limits

Final integrated `npm run verify` passed formatting, **1,236 tests in 65 files**
and the production build. The final renderer/extension pair also passed after
the last consumer changes. New regressions include completion at move 10,001
after the optional speed target, once-only rewards, ore/fusion accounting,
survey ordering, all inventory-power routes, project persistence, construction
receipts and legacy saves.

All 84 new levels completed across ten refill seeds: **840/840**, median 20 moves,
P90 35, maximum 84, with one free reshuffle and no inventory powers. The 84-move
case waited for a final relic drop; it is a useful human-review candidate.
These are legal hint-driven engine runs, not an exhaustive proof for all possible
random boards or a manual playthrough.

Real Chromium checks exercised desktop 1440×900 and mobile 390×844, English and
French, project discovery/focus/reload, fullscreen and embedded access, and live
legal-swap victories at levels 241, 247 and 259 in 16/16/20 moves. Objectives were
not edited to force those wins. The airport used an actual 15,000-coin UI purchase,
saved 0/2 and 1/2 progress, a ready claim and a one-puzzle next upgrade. For that
construction check the puzzle receipts were simulated through the campaign action;
it is separate from the actual puzzle victories.

Earlier issue #41 verification exercised all later-era visuals, the new era
transition buttons, pier, horses, airport flight clearance, fire/bandit camera
restoration and SVG fallback. Final production smoke after the abstraction build
is recorded in the release handoff below. No guarantee of literally zero bugs
is implied by passing automated and browser checks.

## 7. Future package B: issue #42

[Issue #42](https://github.com/Starbugstone/Prospect-Hollow/issues/42) is published
with two concept sheets and a versioned specification at design commit
`31c621a3afd0d83cbe55c3065b847379669399dc` on `design/landmark-side-quests`.
It contains documentation/art only and has not been merged into this release.
The following describes proposed future gameplay, not available buttons or movies.

### Confirmed design decisions

- All seven proposed building activities are optional side quests. Ignoring them never blocks an era, puzzle, ordinary construction, service or campaign completion. Money gains and existing bonuses stay unchanged.
- Introduce the interaction in Frontier through the existing `stable`. Do not move the `horseField` or `park` earlier: they first appear in Industrial and Motor Age respectively.
- Each event stage and its final cinematic happen **once per playthrough**. There is no event replay, encore, repeat edition or retry. Starting a new game is the intended way to experience it again. Skipping consumes the presentation; earned permanent town changes remain.
- Events start only after explicit acceptance. Several can be accepted concurrently; one may be pinned in the HUD. Eligibility alone starts nothing.
- Accepted B quests have **two preparation limits: completed normal puzzles OR real elapsed time, whichever comes first**. The real-time deadline continues while away and persists through reloads.
- These are event deadlines, never limits on moves or time inside a puzzle. A player can finish the active puzzle normally even if preparation expires, receiving its normal rewards and construction credit.
- When several events resolve while away, queue their one-off cinematics and connect them with dynamic transitions when viewed safely in town. Never play or consume them offscreen.
- The transition system must support **all future event types**, not only these seven scenes. Existing era/incident integration belongs to a future adapter step, not the current release.

### The seven first-adopter events and their exact proposed stages

`L1/L2/L3` means a building's **original functional construction stage**. `I1/I2/I3` means its **Industrial modernization tier**. Higher stages satisfy lower ones. Already completed work counts, including work done with hammers; nothing must be rebuilt or downgraded. Historical eligibility remains valid in later eras. The detailed stage mapping below is a **proposed content plan**, not a tested or individually approved balance specification.

| Event / earliest era                     | Stage 1                                                                     | Stage 2                                                                                                 | Stage 3 and main cinematic reward                                                                                                                                                                                                                     |
| ---------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A welcome at Dusty Spur — Frontier**   | `stable` L1: Kit introduces the horse; permanent welcome sign               | `stable` L2: grooming/leading scene; decorative grooming rail                                           | `stable` L3: carriage-yard welcome; horseshoe plaque. Horse reacts to Kit, accepts brushing, takes weighted steps and joins the welcome scene.                                                                                                        |
| **Willow horse field show — Industrial** | `horseField` L1: groom one horse; decorated rail and ribbon                 | `horseField` L2: two-horse walk/trot presentation; low practice pole and rosette board                  | `horseField` L3: three-horse presentation and low-pole demonstration; champion ribbon and show-rail dressing. Finale follows natural trot, pole step, settled reaction and handler's ribbon presentation.                                             |
| **Railway exhibition — Industrial**      | `railDepot` I1: arrival rehearsal; platform pennants                        | `railDepot` I2 + `warehouse` I1: freight demonstration; railway clock                                   | `railDepot` I3 + `warehouse` I2 + `mill` L1: exhibition opening; locomotive display plaque. Wheel-level arrival, braking/platform welcome and crane reveal connect the three buildings.                                                               |
| **Park dog day — Motor Age**             | `park` L1: owner/dog meeting by bench; dressed flowerbeds and bench sign    | `park` L2: fetch practice; low cones and ball basket                                                    | `park` L3: fetch/run/low-hop/return sequence; paw-print plaque and garden dressing. Dog anticipates the throw, retrieves the ball, returns to the owner and receives a pet.                                                                           |
| **Prospect air festival — Aviation**     | `airport` L1: terminal welcome; safe apron/terminal bunting                 | `airport` L2 + `radioTower` L1: taxi/radio-check presentation; vintage aircraft display and route board | `airport` L3 + `radioTower` L2: inaugural departure/flypast; selectable period aircraft livery and terminal dressing. Takeoff roll, rotation, climb/bank and aircraft hero shot.                                                                      |
| **Prospect live premiere — Broadcast**   | `concertHall` L1: rehearsal; concert poster frame                           | `concertHall` L2 + `television` L1: broadcast rehearsal; studio plaque                                  | `concertHall` L3 + `television` L2 + `skyline` L1: full concert premiere; coordinated marquee appearance. Musicians perform a synchronized phrase, bow to the crowd and reveal the studio/business-tower skyline.                                     |
| **Riverlight opening — Connected City**  | `transitHub` L1 + `riverPark` L1: first promenade arrival; district banners | `transitHub` L2 + `riverPark` L2 + `crystalLab` L1: campus open house; decorative sculpture             | `transitHub` L3 + `riverPark` L3 + `crystalLab` L2 + `cityHomes` L1: riverfront celebration; selectable warm-window appearance and river plaque. Tram stops, residents arrive, family walks toward river and a crane shot reveals illuminated towers. |

Each stage also includes a **free cosmetic preparation choice** with a real 3D preview: sign/rail/arrival arrangement at the stable; ribbon palette/pole route/show formation for horses; flowerbeds/cone route/fetch presentation for the park; pennants/display/platform arrangement for rail; bunting/exhibition/flight presentation for aviation; poster/lighting/performance arrangement for Broadcast; banners/sculpture/window pattern for Connected City. These choices do not create a second currency or bill.

Every stage must visibly change the actual plot, not merely a counter or menu picture. Later decorations build on earlier ones, stay inside the existing footprint and keep paths clear. There is no longer a proposed “win 4/8/12 puzzles to reveal each stage” rule: completed puzzles now count **down** the preparation window. Building stages and explicit preparation choices determine base readiness.

### Optional mastery and the single finale

Mastery is **preparation before the one finale**, not an additional event afterward. It observes bonuses the player naturally creates on the board during qualifying settled normal puzzles; no inventory spending is required and no extra gameplay bonuses are granted.

| Event           | Proposed cumulative mastery target | Enhanced performance instead of standard finale                           |
| --------------- | ---------------------------------- | ------------------------------------------------------------------------- |
| Frontier stable | None                               | Keep the teaching event simple                                            |
| Horse field     | 12 naturally created board bonuses | Extended turn/pole-step/settled handler presentation; distinct 3D rosette |
| Park dog        | 16                                 | Fuller agility/fetch loop and distinctive memento                         |
| Railway         | 20                                 | Railway salute with coordinated crew/station reactions                    |
| Airport         | 20                                 | Three-aircraft formation                                                  |
| Broadcast       | 24                                 | Richer synchronized concert finale                                        |
| Connected City  | 24                                 | Coordinated tram/boat riverfront procession                               |

These counts and exact choreography are **unmeasured proposals**. A puzzle with zero qualifying combinations does not fail or erase progress. Mastery cannot block base readiness or the main game. Once base-ready, the player may hold the standard event immediately. If mastery was earned before preparation closes, choose and lock one enhanced variant; never offer a second performance.

### Proposed preparation budgets — not approved values

| Event           | Completed-puzzle budget | Real elapsed time from acceptance | First deadline closes preparation |
| --------------- | ----------------------- | --------------------------------- | --------------------------------- |
| Frontier stable | 6                       | 72 hours / 3 days                 | Yes                               |
| Horse field     | 8                       | 96 hours / 4 days                 | Yes                               |
| Park dog        | 8                       | 96 hours / 4 days                 | Yes                               |
| Railway         | 14                      | 120 hours / 5 days                | Yes                               |
| Airport         | 16                      | 168 hours / 7 days                | Yes                               |
| Broadcast       | 18                      | 168 hours / 7 days                | Yes                               |
| Connected City  | 20                      | 192 hours / 8 days                | Yes                               |

Only the **dual mechanism and real time including absence** are confirmed. Every number above still requires simulation, playtesting and review. An accepted normal-puzzle completion consumes one turn in every applicable accepted event; it does not split or multiply ordinary rewards. Duplicate receipts, abandoned games, menus and continuous/arcade play consume none.

Proposed fair boundary handling: when the final allowed puzzle settles before the UTC deadline, first settle its normal money/chest/hammer/construction results and offer a final town preparation/finish-claim opportunity. Resolve when the player holds the event or starts the next normal puzzle. The UTC deadline still wins if it arrives during that window. If UTC expires mid-puzzle, that puzzle remains playable/rewarded, but preparation actions settled after the deadline no longer count.

**Incomplete preparation is still an open design decision.** The issue proposes retaining all earned decorations/buildings and offering a shorter modest gathering instead of the grand-finale cosmetics when base preparation is incomplete. That fallback and its exact rewards are not approved. There is no approved wallet loss, building loss, campaign penalty, paid extension, retry or consolation-money scheme.

### Cinematic quality and queued transitions

Proposed direction targets: 2–4 seconds for each key-stage reveal, about 8 seconds for the Frontier introduction finale, 10–14 seconds for standard major finales and 12–16 seconds for a mastery variant. These durations are not verified production budgets.

The payoff should come from anticipation, readable motion, character reaction, lighting, audio and a composed reward hold. Horses need natural gait, grounded hooves, weight and collision-free pole routes. The dog needs anticipation, acceleration, landing, ball pickup/carry/release, owner contact and a wagging finish. Vehicles follow real clear routes. No slideshows, placeholder motion, foot sliding, teleports or excessive particle effects substituting for acting.

The two published concept sheets cover horses/dog and Steam/Aviation/Broadcast/Connected City. They are **aspirational concept art**, more detailed than the runtime, not approved production models or implemented cinematic frames. Actual assets require Blender sources/rigs/clips, rendered storyboard/key-pose review and browser/device validation.

On reconnect, resolve due outcomes and permanent rewards first, then queue their unconsumed scenes. After one brief introduction, chain the scenes without intermediate popups or camera resets. The shared director computes roughly 1–2 second eased transitions from the outgoing live camera pose to the next scene's entry anchor, choosing safe travel, a wide/crane establishing view or restrained cross-dissolve. Bridge audio smoothly. Those durations and exact transition strategies are proposed production targets.

Controls: Next scene consumes only the current clip; Skip all consumes the remaining batch; Return to town leaves unfinished entries pending. Interrupted in-progress scenes resume at a saved checkpoint instead of restarting. Already consumed scenes never play again. Cinematics do not run while away. Mute/reduced motion persist, camera/input ownership is exclusive, and the original town camera returns only when the batch exits.

### Reusable architecture being proposed

1. **EventDefinition registry:** versioned IDs, participants, eligibility/triggers, objectives, optional deadline policy, outcomes and scene IDs.
2. **EventRuntime:** independent lifecycle, preparation observations, immutable accepted budgets, deadline evaluation and exactly-once outcome settlement.
3. **Global PresentationQueue:** durable scene ordering, dependencies, priorities and pending/playing/consumed checkpoints for all future event types.
4. **SceneDefinition registry:** unique authored camera/actor/audio/FX timelines, entry/exit anchors, bounds, era compatibility, assets and fallback/reduced-motion alternatives.
5. **One CinematicDirector:** generic geometry-aware transitions, camera/input/audio ownership and bounded active/next-scene asset loading.

No N×N table of horse-to-dog, dog-to-airport and other bespoke transition pairs. A new event using existing capabilities should need only its definition, scene/assets, translations and tests. New capabilities belong in reusable handlers. Deadlines are event-specific policies; future construction/story moments need not be timed. Existing raid/era scenes would join through future adapters preserving their current outcomes and consumed state.

### Decisions and validation still outstanding

- Approve/tune the exact stage combinations, free visual choices, preparation budgets and mastery targets.
- Decide what insufficient preparation produces, including exactly which cosmetic rewards are retained or withheld from the final event.
- Approve final art direction, each storyboard/key pose, animation complexity and audio assets. Concept images are not approval or finished assets.
- Choose historical presentation versus present-day heritage treatment when an old unstarted event is accepted in a later era.
- Specify save migration and clock/rollback/multi-device trust handling before claiming deadlines are tamper-resistant.
- Validate actual device performance, especially chained transitions and asset overlap. 60 FPS is a target, not a measured promise for these future cinematics.
- Demonstrate extensibility with a dummy unknown event registered entirely through the contract; test both ordering directions, missing assets, skips, disconnects, reduced motion and no duplicated outcomes or locked input.
- Implement framework-first with one early vertical slice, then horses/dog as quality benchmarks, then later landmarks. None of those implementations belongs to the current release.

## 8. Remaining goals and review decisions

1. **Review the current play feel.** Start in Steam, then inspect rebuilding,
   Aviation, Broadcast and Connected City. Confirm that roughly 50–54 final-era
   puzzles and many parallel upgrades feel deliberate rather than repetitive.
   Compare ordinary building habits with the simulation's active purchasing.
2. **Review the three new mechanics.** In particular, ordered survey feedback,
   color-order visibility, mixed goals and the rare long relic cleanup deserve
   direct play. Decide whether the very late introduction is sufficient: the
   favorable optimized town finishes before level 241. Moving mechanics earlier
   would be a new change to existing content and has not been done silently.
3. **Decide how much safety margin lower earners need.** The 75% stress case still
   needs 4–9 replays. More varied optional content or changes to later obligations
   could be discussed without changing gains; no such extra balance adjustment
   has been made.
4. **Assess balance as one combined release.** The earlier chest taper is an
   expected part of develop's evolution over the last few days. The complete
   campaign measurements use that current economy; tonight's work adds no further
   change to gains or bonuses. Review the resulting play feel rather than treating
   the existence of earlier commits as a problem.
5. **Approve B's unresolved design values.** Exact dual deadlines, incomplete
   preparation outcomes, mastery targets/cosmetics, and historical versus present-day
   staging for late acceptance remain proposals. The no-replay, no-puzzle-cap,
   real-offline-time and non-interference principles are fixed requirements.
6. **Build B's common foundation first.** Schemas, versioned runtime, durable queue,
   one director and generic transitions; prove an unknown event can be registered
   without modifying existing events. Then make a complete early-stable example
   and the horse-field animation-quality benchmark before expanding all seven.
7. **Produce and review the actual cinematic art.** Blender rigs, grounded horse
   and dog motion, camera blocking, sound and permanent stage models are still
   needed. Concept sheets and current ambient loops do not meet that acceptance.
8. **Profile real hardware.** Record frame-time distributions, draw calls, memory,
   cold/warm loading and chained-scene overlap on named supported devices. Aim
   for fluid 60 FPS but do not claim it from software-WebGL screenshots.
9. **Validate the commercial hypothesis.** No retention or revenue improvement
   has been demonstrated. Observe voluntary project/event engagement, stage
   completion, later-era abandonment, time between satisfying build finishes and
   device responsiveness before treating the design as proven marketing balance.
   No ads, paid extensions, passes, new currencies or monetization systems have
   been added by this work.

## 9. Review material and source of truth

- [Release A mechanics, economy, reproduction commands and browser evidence](release-a-progression-2026-09-14.md)
- [Shared era architecture and extension instructions](era-architecture.md)
- [Issue #41 visual fixes and screenshots](issue41-era-visuals.md)
- [Performance/dead-code review](develop-review-2026-09-14.md)
- [Earlier construction/cache review](develop-review-2026-09-13.md)
- [Exact landmark rule and the older 240-level analysis](late-era-balance-2026-09-14.md)
- [Earlier leisure and chest-economy work in the combined release](leisure-and-economy.md)
- [Permanent contributor rules](../AGENTS.md)
- [Future event framework, stage proposals and concept art](https://github.com/Starbugstone/Prospect-Hollow/issues/42)

Older reports intentionally record their historical test counts, durations and
content totals. Use this recap and the release A report for the current 324-level
state; the earlier six-era and 240-level reports are not the final release totals.

## Release handoff

Runtime release commit: [`0ef83ed6a1b4cd442a6f1ea79988f0cb5cbbe63e`](https://github.com/Starbugstone/Prospect-Hollow/commit/0ef83ed6a1b4cd442a6f1ea79988f0cb5cbbe63e), pushed to lowercase `develop`.
Both GitHub Quality checks for that runtime commit completed successfully:
[run 34899346088](https://github.com/Starbugstone/Prospect-Hollow/actions/runs/34899346088)
and [run 34899341991](https://github.com/Starbugstone/Prospect-Hollow/actions/runs/34899341991).
The final production smoke covered Industrial, Aviation and Connected City,
their completed projects, and entry into level 260. It recorded zero application
errors and zero failed HTTP resources. The last French mobile overlap between
project and progress controls was fixed and visually rechecked before this commit.

This recap and selected browser screenshots are a subsequent documentation-only
handoff. The runtime checks above apply to the runtime commit; the handoff makes
no gameplay changes. Main remains at the comparison baseline.

Selected current-release browser captures:

- [Ore orders at level 241, desktop](images/release-a/ore-orders-desktop.png)
- [Lanterns at level 247, desktop](images/release-a/lanterns-desktop.png)
- [Survey trail at level 259, French mobile](images/release-a/survey-french-mobile.png)
- [Completed Connected City projects, French mobile](images/release-a/projects-french-mobile.png)

The scene screenshots use review saves where appropriate. They are evidence of
the rendered UI/content, not evidence that every town stage was manually played.
