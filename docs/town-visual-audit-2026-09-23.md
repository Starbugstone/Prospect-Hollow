# Town visual audit — 23 September 2026

Scope: the 3D village only. That covers building identity across the eight eras and their three upgrade stages, era transitions, villagers, animals, vehicles, aircraft and village events. The mine puzzle is out of scope; it is covered separately by `mine-audit-2026-09-23.md`.

The original audit was made against commit `26ba7e6` (`develop`). The regression suite passes (1,304 tests), so none of the findings below is caught by an automated test.

## How the evidence was gathered

- **Building gallery.** Every building, era and stage was reviewed in `docs/images/era-upgrades/`. These captures come from the production renderers. They were last regenerated in `c9c8976`, and no building renderer has changed since. Gallery captures hide facade signs.
- **Live game.** Profiles from `npm run demo:eras` (`output/era-demo/`) were loaded into a headless Chromium session. It used software WebGL and a virtual `requestAnimationFrame` clock, so cinematics and events could be sampled at exact timestamps.
- **Measured overlaps and speeds.** Actor overlaps and speeds were computed from live world positions over 65 s of game time. Values are in world units (u) per second; normal villager walking speed is 0.55 u/s.

Severity:

- **High**: breaks building or era identity across the whole town.
- **Medium**: a visible defect on specific buildings or actors.
- **Low**: polish.

Each suggested fix follows `AGENTS.md`: capabilities go in the era profile or data catalogs, and shared renderers are preferred over era-name conditionals.

---

## A. Building identity across eras

### A1 · City eras collapse about 45 buildings into 12 shared models — High

**Where**

- `src/data/city.js:12-59` (`CITY_FAMILIES`)
- `src/game/town/buildings/city.js:19-91` (`renderCityBuilding`)

**What happens.** From Post-war (1920) through Connected City (2005), each building maps to a generic family, and the family model is what gets drawn:

- Bank, city hall, doctor, school, sheriff and post office are one "civic" block.
- Armory, blacksmith, fire station, light mill, stables and garage are one garage-door "depot" block.
- Every home, the hotel, row houses, garden court and apartments are one "residence" block.
- Saloon, shop, market, diner and supermarket are one "retail" model.
- Well, well II, power house and water plant are one "water" model.
- Railway station, bus station and transit hub are one "station" model.
- Museum and freight warehouse are both "culture".
- In 2005, the museum, warehouse and library use `digital-culture`. The apartments, city homes and boarding house use the same skyscraper as the Business Tower landmark.
- The `marker-*` meshes for the doctor, sheriff, bank and blacksmith are too small to tell apart at the normal camera distance.

Compare `docs/images/era-upgrades/post-war/*/stage-3.png` and `.../contemporary/*/stage-3.png` side by side.

**Suggested fix**

- Give each building kind (or a small group of genuinely similar kinds) its own `cityStyles.json` entry and Blender family. The key identity cues should survive every era:
  - farm: fields and silo
  - stable and garage: vehicle bay
  - fire station: engine doors and tower
  - school: bell or clock
  - bank: columns
  - saloon and diner: terrace
  - station: platform canopy
  - museum: display gable
  - hotel: balconies and entrance canopy
- Keep the family as a fallback only, and make `renderCityBuilding` look up `cityAppearance(era, kind)` first.
- Never map a residential or civic building to a landmark asset (`skyline`). Keep the landmark unique.
- Add a gallery test that fails when two different kinds in the same era produce the same mesh signature, unless they are explicitly allow-listed (for example `home2`–`home4`).

### A2 · Motor Age (1932) reverts modern buildings to 1908 brick — High

**Where**

- `src/game/town/buildings/motorAge.js:116-139` (`renderMotorLandmark`)

**What happens.** For frontier and river-rail kinds, the Motor Age landmark is built on `renderIndustrialLandmark` with the sign stubbed out, plus a cream frontage. Buildings modernized in Post-war (1920) are drawn as modern stucco city blocks. Once the player pays for their Motor Age upgrade, they turn back into 1908 brick buildings with pitched roofs. In Aviation (1958) they become modern again.

This is visible for the home, farm, stables, saloon, wells, railway station, power house, fire station, row houses and light mill. Buildings introduced in Post-war use the post-war city model instead, so a Motor Age town mixes 1908 and 1920 architecture.

**Suggested fix**

- Build Motor Age landmarks on the Post-war city model for every kind, as `renderMotorLandmark` already does for Post-war buildings, then add the Motor Age frontage on top.
- Alternatively, reorder the era chronology so Motor Age follows Industrial directly.
- Either way, add a test that an era's landmark never resolves to an older era's base style than the building's previous era.

### A3 · Shared era add-ons provide the only identity — Medium

**Where**

- `src/game/town/buildings/city.js:56-57` (`profile.detailAsset`)

**What happens.** Every building in an era gets the same add-on:

- 1958: a radio aerial and an orange awning
- 1986: a TV aerial and a striped billboard
- 2005: a street kiosk and a solar roof panel

So a whole town reads as one repeated building. The 1986 add-on sits where the stage-2 wing goes and disappears inside it. The 2005 kiosk stands in front of the entrance at every stage.

**Suggested fix**

- Keep the era add-ons but choose them per family or kind from data. For example, antennas only on civic and broadcast buildings, billboards only on retail.
- Offset them from the stage-2 wing footprint.

### A4 · The mine barely evolves after 1920 — Medium

**Where**

- `src/data/mineEvolution.js` (`STYLES`)
- `src/game/town/TownMineWorks.js`

**What happens.** From Post-war to Connected City (85 years), the mine is the same steel headframe and hut with a new palette and an antenna. The Motor Age hut shows two stacked roof slabs.

**Suggested fix**

- Add era-specific surface equipment to the `STYLES` entries and `addMineWorks`, keyed by the existing `machine` capability:
  - `motor`: a truck loading bay
  - `radio`: a mast and control booth
  - `control`: a glazed control room
  - `digital`: an automated conveyor and a screen wall
- Reuse the staged `buildPhase` sections so the cinematic still assembles them.

### A5 · Other identity losses — Medium

- **Museum.** From Industrial on, the frontier museum loses its gem display cases and clock tower. It ends up sharing a model with the freight warehouse and the internet café.
- **Garden court.** The Motor Age version grows from one to three distinct houses. From 1958 it becomes a single generic residence with a smaller footprint.
- **Bus station and garage.** They lose their vehicles in the city eras.
- **Saloon and diner.** They lose their terraces and become retail blocks.

**Suggested fix.** This is covered by A1. Keep each kind's signature silhouette and props in its per-kind city entry.

---

## B. Upgrade stages that barely change

### B1 · Frontier stages 1 → 2 → 3 are too similar for several buildings — Medium

**Where**

- `src/game/town/TownDiorama.js:420` excludes the fisherman, blacksmith, school and doctor from `addImprovements`.
- `src/game/town/buildings/civic.js` adds only tiny stage details.

**What happens.** The blacksmith, fisherman's hut and schoolhouse look almost identical at stages 1, 2 and 3. The farm, stables and armory barely change from stage 1 to 2 (see `docs/images/era-upgrades/frontier/`).

**Suggested fix.** Give each kind at least one silhouette-changing addition per stage, not just small props. For example:

- blacksmith: a lean-to at stage 2, a second forge and chimney at stage 3
- fisherman: a longer jetty and boat at stage 2, a smokehouse at stage 3
- school: a bell tower at stage 2, a classroom wing at stage 3
- stables: a paddock fence at stage 2, a hay barn at stage 3

### B2 · Frontier stage 3 jumps straight to service level 5, with one shared add-on — Medium

**Where**

- `src/data/buildingProgression.js:23`
- `src/game/town/TownImprovements.js:105-124`

**What happens.** "Supporting" buildings reach service level 5 at stage 3, so the generic stage-4 planters and stage-5 entrance pergola are added to all of them. The finished armory, stable, farm, well, home and museum all share the same planters, trellis panels and pergola. On the well, the 3.65 u pergola is far wider than the 2.1 u well.

**Suggested fix**

- Separate the visual stage from the service level for short-progression buildings, so the renderer receives `stage` (1–3).
- Drive per-kind stage-3 additions from data, in the same way as `HERITAGE_UPGRADES`.
- Scale or omit the pergola by plot footprint.

### B3 · City-era stage 3 adds only lamp posts — Medium

**Where**

- `src/game/town/buildings/city.js:58-65`
- `src/data/eraDefinitions.js:83`

**What happens.** In 1920, 1958 and 1986, the change from stage 2 to 3 is one or two lamp posts. The upgrade text promises "roof garden and civic lighting", but no roof garden appears before 2005. The radio station, business tower, airport and bridge stages are also hard to tell apart at the default zoom.

**Suggested fix**

- Author a real `-finish` stage per family: a roof garden or rooftop terrace, a planted forecourt and a canopy.
- Alternatively, change the copy so it matches what is built.
- For landmarks, make stage 2 and 3 additions at least 25% of the landmark's footprint, or a height change.

### B4 · Upgrade copy contradicts the visuals — Low

**Where**

- `src/data/eraDefinitions.js:39`: River & Rail level 3 says "clock tower and ornamental roof".

**What happens.** The visuals now use purpose-specific heritage extensions (veranda, hayloft, dispatch rooms…), and `docs/era-architecture.md` explicitly forbids a universal clock tower.

**Suggested fix**

- Generate the stage-3 description from `HERITAGE_UPGRADES`, for example "Add a veranda", "Add a hayloft".
- Update `fr.json` to match.

### B5 · The Motor Age horse field never changes — Medium

**Where**

- `src/game/town/buildings/motorAge.js:116-128`

**What happens.** `renderLeisureBuilding` returns `true` first, so `addMotorModernization` never runs for `horseField`. Motor Age levels 1–3 look identical, although the offer promises "stone planters and seasonal flowers".

**Suggested fix.** Call `addMotorModernization(d, parent, kind, level)` after the leisure model for `horseField`, or add a dedicated planter frontage. Add a test that each paid modernization level changes the mesh signature.

---

## C. Wrong or conflicting geometry

### C1 · Buildings that borrow a shell show that shell's sign and props in River & Rail — Medium

**Where**

- `src/game/town/buildings/BuildingRenderer.js:61`
- `src/game/town/buildings/BuildingRenderer.js:210`

**What happens.** `renderRiverModernization` resolves the kind through the `kinds` aliases before choosing the sign text. Confirmed in the live game:

- The Telegraph & Post Office sign reads **"General store"**.
- The Riverside boarding house reads **"Town hotel & saloon"**.

Through the same code path:

- The railway station reads "Town museum".
- The warehouse reads "Supply depot".
- The east-bank market reads "General store".
- The steamboat landing reads "Commercial fishing dock".

The frontier shell also brings its props. The station shows the museum's gem display cases on its platform, and the post office shows the shop's goods.

**Suggested fix**

- Use the original kind's label (the plot's own name) for buildings introduced in River & Rail. Only use `RIVER_RAIL_VARIANTS` for kinds that exist in it.
- Give aliased kinds their own shells, or skip the borrowed kind's props.

### C2 · Facade signs read mirrored from behind — Low

**Where**

- `src/game/town/TownDiorama.js:246-264` (`sign`)

**What happens.** The text texture is applied to every face of a thin box. The camera can orbit freely, so from behind a building the sign reads backwards.

**Suggested fix.** Texture only the front face (a material array with a plain material elsewhere), or use a single-sided plane.

### C3 · Industrial and Motor Age stage-3 "plank" — Medium

**Where**

- `src/game/town/buildings/industrial.js:231`

**What happens.** The trim box (4.8 × 0.12 × 0.7 at z 2.3) lies across the front of the well, farm, square, fisherman and river port. It reads as a stray board covering crop rows and quays.

**Suggested fix.** Replace it with a footprint-aware paving edge or step, or remove it. The lamp post already marks stage 3.

### C4 · Industrial bridge truss cuts through the deck — Medium

**Where**

- `src/game/town/buildings/industrial.js:219-220`

**What happens.** The iron truss rods run from y 1.2 to 2.4 or 4 at fixed heights. They ignore `bridgeDeckHeight` and the stair approaches, so they cross diagonally through the steps and the deck.

**Suggested fix.** Anchor the truss to the deck profile from `TownRiver.bridgeDeckHeight(x)` and keep it above the walkway, or use side girders following the railing.

### C5 · Motor Age additions clip through older geometry — Medium

**Where**

- `src/game/town/buildings/motorAge.js:96-114` (`addMotorModernization`, applied on top of the Industrial landmark tier)

**What happens**

- The stage-3 stepped frontage (y 3.46–4.2) pokes through pitched roofs on the home, stables, station and row houses.
- The stage-2 wing (x −2.15) overlaps the Industrial stage-2 wing (x −2.45) and its heritage room.
- The water-tower legs run through the hut roof.

**Suggested fix.** This is resolved by A2 (use a single base model). Otherwise, offset the additions against the base building's real bounds rather than fixed coordinates.

### C6 · Town square clutter and clipping — Medium

**What happens**

- River & Rail adds four lamp posts (±2.3, ±2) on top of the Frontier stage-5 corner lamps, so two posts almost overlap. Its stage-3 green cones read as stray objects.
- The Industrial stage-2 annex (x −2.1) is placed on the bell frame and benches.
- The city-era pergola overlaps the bell.
- One city `-finish` lamp stands inside the fountain basin.

**Suggested fix**

- Author the square's era props against a shared layout of named anchor points (corners, bell, benches, fountain ring), so the eras replace props instead of stacking them.
- Keep the fountain ring clear.

### C7 · Overlapping water tanks and the oversized well — Low

**What happens**

- In River & Rail, the new metal tank overlaps the frontier wooden water tower.
- In Motor Age, a second tank is added next to the Industrial tank.

**Suggested fix.** Each era should replace the tank, not add another one.

### C8 · Stray rods under the 1986 and 2005 station and bus façades — Low

**What happens.** Short vertical rods hang below the front windows of the station-family models in 1986 and 2005.

**Suggested fix.** Check the `broadcast-station` and `contemporary-station` exports in `art/city/city.blend`.

### C9 · Heavy utility-pole clutter — Medium

**Where**

- `src/game/town/TownEvolution.js:24-112` (`powerGrid`, `addPowerGrid`)

**What happens.** From 1908 to 1986, every plot gets a 6.4 u pole run with sagging wires. Service drops go to the plot centre at 3.4 u, and long diagonal wires cross over roofs. In the overview the poles dominate the town.

**Suggested fix**

- Place poles on one side of each street only.
- Share one pole between neighbouring plots, and end service drops at the facade edge instead of the plot centre.
- Reduce the pole height in later eras, or phase the poles out from 1958 by setting `overheadPower: false`, as 2005 already does.

---

## D. Era transitions

### D1 · Only the mine changes when the era advances — High (design)

**Where**

- `src/game/town/TownMineEraConstruction.js`
- `src/components/town/TownEraCinematic.vue`

**What happens.** The cinematic is correct: it runs 22 s in real time, and the headframe assembles in staged sections with workers. But after "Explore the new era", every building looks exactly as before. Visual change only comes when the player buys each building's modernization. Only road colour and new empty plots signal the new era.

**Suggested fix**

- Add a town-wide era signal that costs nothing. Possible signals:
  - road surface and street furniture: lamps, benches, signs
  - era-appropriate traffic and villager outfits (see E5)
  - the newly available plots presented in the cinematic's final shot
- Consider a short town fly-over after the mine shot, previewing a few modernized landmarks.
- Keep the purchase-based modernization as is, since it is part of the economy.

### D2 · The new era's plots pop in mid-cinematic — Low

**What happens.** When the reveal fires, the town rebuilds, and new empty plot outlines appear while the camera is on the mine. This was seen in the Frontier → River & Rail transition.

**Suggested fix**

- Defer adding new plots until the cinematic finishes, or fade them in.
- Alternatively, show them on purpose in the final shot.

### D3 · Upgrade reveal re-drops the whole building — Medium

**Where**

- `src/game/town/TownConstruction.js:13-20`

**What happens.** When a stage or modernization completes, every mesh in the plot group drops back in from 1.3 u above, in about 1 s. Existing walls "rebuild" instead of the new wing or extension appearing.

**Suggested fix**

- Tag meshes created for the new stage, for example with `userData.addedAt = stage` (as `buildPhase` already does for the mine).
- Animate only those meshes. Lengthen the reveal slightly (1.5–2 s) with the hammer and dust at the new part.

### D4 · Shadows update once per second in the mine cinematic — Low

**Where**

- `src/game/town/TownMineEraConstruction.js` (`shadowPhase: Math.floor(time)`)

**What happens.** The shadows of rising sections step once per second.

**Suggested fix.** Refresh the shadow map every frame during `buildStart`–`buildEnd` only.

---

## E. Villagers and animals

### E1 · Pedestrians, riders, cars and the bus pass through each other — High

**Where**

- `src/game/town/TownActivity.js:183-210` (riders and cars)
- `src/game/town/TownDiorama.js` (walker routes on `±LANE_X`)
- `src/game/town/TownMotorActivity.js`

**What happens.** Every actor follows the same lane centre lines (`x = ±3.5`). Measured over 65 s of game time:

- Frontier town:
  - The sheriff overlapped a horse rider 23 times.
  - A walker overlapped a rider 24 times.
  - Saloon visitors overlapped each other 5–10 times.
- Motor Age town:
  - A touring car overlapped one visitor 43 times.
  - The sheriff overlapped a car 29 times.
  - The bus overlapped walkers 5–13 times.

**Suggested fix**

- Give pedestrians sidewalk offsets (±0.6 u from the lane centre), and keep riders and vehicles on the carriageway with one lane per direction.
- Stagger saloon visitors on separate side offsets.
- Add a regression test that samples positions over one cycle and asserts minimum pedestrian–vehicle and pedestrian–pedestrian separation.

### E2 · Saloon visitors appear and vanish — Medium

**Where**

- `src/game/town/TownDiorama.js:875-886`

**What happens.** Visitors switch to `visible = false` for 7 s at the saloon entrance and reappear in the same spot, with no door or fade.

**Suggested fix**

- Walk them to the door, then fade or scale them out.
- Alternatively, let them sit on the saloon's terrace or porch bench.

### E3 · Idle villagers wave at nobody — Medium

**Where**

- `src/game/town/TownDiorama.js:903-910`
- `TownLife.js` (chatting neighbours)
- `TownEraActivity.js:36-47` (fisherman)

**What happens**

- Every walker waves for 4 s at the end of its route.
- The chatting neighbours and the fisherman wave forever.
- The fisherman's rod is attached to the root, so it floats beside him while he waves.

**Suggested fix**

- Give idle actors a small set of idle poses: looking around, hands on hips, talking gestures for pairs.
- Add a fishing pose, with the rod parented to the hand and a slow bob or cast cycle.

### E4 · Chimney smoke looks like solid rocks on rooftops — Medium

**Where**

- `src/game/town/TownLife.js:115-131`

**What happens**

- The puffs use the faceted `rock` geometry in near-white.
- They sit at fixed heights for the frontier home (3.38), saloon (3.33) and blacksmith (3.63).
- Once the home and saloon gain their upper floors, the puffs sit on the roof with no chimney beneath.
- In every later era they float over flat modern roofs, still present in 2005.
- A chimney box is added for the saloon even when the saloon model has changed.

**Suggested fix**

- Use a soft sphere or sprite with fading opacity.
- Place the emitter from a named `chimney` anchor exported by the building model.
- Emit nothing when the current model has no chimney. Also move the blacksmith smoke to the Industrial chimney at (−1.8, −0.7, 4.4).

### E5 · Villagers look the same in every era; the sheriff is oversized — Medium

**Where**

- `src/game/town/TownDiorama.js:762-838` (`person`)

**What happens**

- Only the hat changes by era (a cowboy hat until 1932, a cap after).
- Trousers and boots are identical for everyone.
- The sheriff is scaled 1.3× and stays a star-badge frontier sheriff in 1986 and 2005.
- Horse riders always use the frontier outfit (`era: 'frontier'`).

**Suggested fix**

- Add an era wardrobe capability to the era profile: silhouette, hat, coat length and palette.
- Turn the sheriff into a town patrol officer from Industrial on.
- Keep the scale at 1.0–1.1, and use the badge colour for readability instead of size.

### E6 · Animals — Low

**What happens**

- **Stable horses** stand still and only nod (`TownDiorama.js:915-944`).
- **Hens** slide without leg motion and walk through the stage-3 planters at the farm front.
- **The village dog** walks an ellipse through the stage-3 planters and pergola posts in front of the home (`TownLife.js:44-80`).
- **Field horses** each twitch a single leg.
- **The park dog-walkers** appear and vanish at the same spot and snap 180° at the far end (`TownLeisure.js:36-57`).

**Suggested fix**

- Put the hen and dog paths on a clear yard polygon taken from the building footprint.
- Animate hen legs, and add a tail swish and weight shifts to the stable horses.
- For the park walkers, use an entry and exit path from the street and an eased turn.

### E7 · Walking speed and stride don't match — Low

**Where**

- `src/game/town/TownDiorama.js:891-900`

**What happens.** The stride rate is fixed (`step = time * 6`). That suits 0.55 u/s, but the sheriff walks at 0.8 u/s and visitors walk at route-dependent speeds, so their feet slide.

**Suggested fix.** Drive the gait phase from the distance travelled (`phase = distance / strideLength`) rather than from time.

---

## F. Events, vehicles and aircraft

### F1 · The workshop fire has no convincing fire, and the fire engine is the bus — Medium

**Where**

- `src/game/town/TownEraIncident.js:44-66`

**What happens**

- The "fire" is five small orange and yellow rock blobs on the ground, 1.7 u in front of the building.
- The fire engine is `motorVehicle(..., bus = true)`, the town bus with a red box and two rods on top. In the city eras it is the city bus.
- The storm cleanup's "City service vehicle" is the same bus.

**Suggested fix**

- Place the flames and smoke on the target building: windows or roof, using its bounds.
- Author dedicated fire-engine and service-truck models per era family.

### F2 · Event actors move far too fast — Medium

**Where**

- `src/game/town/TownEraIncident.js:9` (`INCIDENT_SPEED = 26/16`), plus route-length-dependent travel

**What happens**

- Storm cleanup (2005): the service vehicle peaked at **22.6 u/s** and covered 188 u, about 40× walking pace.
- Cargo theft (River & Rail): the sheriff's men and the thieves moved at **about 13 u/s** while their legs kept a strolling cycle, so they skate.
- The workshop-fire vehicle (4.9 u/s) is acceptable.

**Suggested fix**

- Cap speeds: about 1.2 u/s on foot, about 3 u/s running, about 6 u/s for vehicles.
- For long routes, start responders closer or cut the camera, instead of speeding up time.
- Drive the gait from distance (see E7).

### F3 · Event framing and upgrade glow — Low

**What happens**

- In the workshop fire, the main camera often leaves about 60% of the frame as empty sand, with the subject at the edge.
- The inset sometimes shows the same subject as the main view.
- Every building that can be upgraded keeps its green `TownUpgradeGlow` during the event.

**Suggested fix**

- Frame the union of the responder and incident bounds, and use the inset only when the subjects are far apart.
- Hide the upgrade glow while an event camera is active.

### F4 · Vehicles — Low

**What happens**

- The steamboat's paddle wheel sits at +z, the direction of travel, so it is on the bow (`TownEraActivity.js:79`).
- Car and bus wheels never rotate (`TownVehicles.js`).
- The bus turns 180° on the spot at each end of its route (`TownMotorActivity.js:28-33`).

**Suggested fix**

- Move the paddle wheel to the stern.
- Rotate the wheels by distance travelled.
- Give the bus a turning loop or a reversing manoeuvre at the depot.

### F5 · Aircraft — Low

**Where**

- `src/game/town/TownAviation.js:60-74`, `:116-133`

**What happens**

- The plane becomes invisible about 37 u up, straight after take-off, and appears about 27 u up on approach, while both points are within the default camera view.
- The same propeller "regional" plane flies in 1958, 1986 and 2005.

**Suggested fix**

- Continue the climb and approach beyond the fog or view distance before toggling visibility, or fade the plane.
- Select the aircraft model through the existing `airportStyle` capability: a propliner, then a jet, then a regional jet.

---

## Suggested order of work

1. **A2**: have the Motor Age landmark build on the Post-war model. This is a small change with a large effect.
2. **C1, B5, C3, C4**: quick correctness fixes.
3. **E1, E7, F2**: separate lanes and base gait and speed on distance travelled. These remove most of the animation artefacts.
4. **A1, A3, B3**: per-kind city architecture. This is the largest art task; it needs Blender exports per kind plus the duplicate-signature test.
5. **D1, D3**: make the era change and each upgrade visibly transform the town.
6. **B1, B2**, then the remaining low-severity items.

Add regression coverage alongside each fix:

- a mesh-signature uniqueness test per era
- a test that each paid level changes the model
- an actor-separation sampling test
- a speed-cap test for incidents

## Review response — implemented changes

The findings above preserve the original evidence. The working-tree response is
tracked here; regenerated galleries show the revised production geometry.

| Findings                  | Resolution                                                                                                                                                                                                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1, A3, A5                | A shared per-kind catalog now exports distinct city shells, identity props and finishing stages. Residential buildings no longer use the business tower.                                                                                                                |
| A2, C5                    | Motor Age inherits the completed Post-war city shell and its paid stage; it no longer stacks the older industrial facade and extra tanks.                                                                                                                               |
| A4                        | Mine eras add a loading bay, radio/control facilities and later glazed/digital conveyor equipment through the shared construction model.                                                                                                                                |
| B1–B2                     | Frontier civic buildings and river facilities gain larger wings/towers/work areas. The renderer reads visual stages separately from service benefits.                                                                                                                   |
| B3–B5                     | Per-kind city finishing stages, an airport observation lounge, visible leisure additions and matching heritage copy replace generic final-stage decorations.                                                                                                            |
| C1–C2                     | Aliased buildings retain their own signs and omit borrowed props. Facade signs have a front face and an opaque backing.                                                                                                                                                 |
| C3–C4                     | Removed the loose industrial plank; bridge supports follow the deck profile.                                                                                                                                                                                            |
| C6–C8                     | Square furnishings share anchors, modern wells avoid duplicated tanks, and purpose-specific station meshes include complete cycle stands/canopies.                                                                                                                      |
| C9, D1                    | Shared, shorter utility poles give way to underground distribution in later profiles. Era streetscape lamps, furniture and kiosks change independently of paid buildings.                                                                                               |
| D2–D4                     | New plots remain hidden during era construction; upgrades reveal only changed meshes; mine-construction shadows update through worker activity.                                                                                                                         |
| E1–E3, E7                 | Sidewalk routes and local separation keep pedestrians clear of traffic. Visitors fade at entrances; idle/fishing poses replace perpetual waving, with held rods and distance-driven gait.                                                                               |
| E4–E6                     | Smoke uses real chimney anchors and fading transparent spheres; era wardrobes/patrol proportions vary; animal legs, tails, clear-yard routes and continuous park walks animate.                                                                                         |
| F1–F3                     | Dedicated response trucks, building-mounted flames/smoke, capped approach speeds, shared subject framing, conditional insets and suppressed upgrade glows improve incidents.                                                                                            |
| F4–F5                     | Wheels turn by distance, buses use curved turns, the paddle is at the stern, and airport profiles select fading propliner/jet silhouettes.                                                                                                                              |
| Additional: hammer        | The hammer handle passes through the palm and swings with the forearm during the mine upgrade.                                                                                                                                                                          |
| Additional: VIP visitors  | Male/female silhouettes, an editable honor roll, name-first draws, special outfits/badges, tap/hover names, synchronized passive arrival insets and transient visits are implemented.                                                                                   |
| Additional: NPC obstacles | All walking actor systems now use cached detours around authored pole, lamp and street-furniture footprints, including riders, responders, construction crews and the park dog-walker. Crowd separation respects those footprints too; no raycasts or physics are used. |

Validation includes mesh identity/stage checks, sampled actor separation, incident
speed limits, construction grip/reveal tests, uniform VIP selection and gender,
real train/boat/airplane arrival synchronization, and independent inset lifecycle
checks. Browser review covers the production town, hover/tap names, the passive
arrival inset and its name tag, plus the actor/hammer review scene. The era galleries
are regenerated from production renderers; geometry tests complement visual review
rather than replacing it. Puzzle move limits and earnings are unchanged.
