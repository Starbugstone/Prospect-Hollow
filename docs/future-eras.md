# Skysail, Stargazer and Moonward eras

Three eras follow Riverlight. Together they tell one story: the town takes to the
sky, discovers the Moon, then sends its own prospectors to a new frontier, as the
founders did in 1865. The tone stays warm: neighbors, gardens and homecomings.
The Willowkin stay part of every chapter. They tend the floating orchards, know
every star by name and ride the ribbon as seedlings to plant the first Moon
gardens. The garden neighbor's street walks continue into the new Skyward quarter.

| Era         | Year | Saved id    | Architecture  | Story beat                                                            |
| ----------- | ---- | ----------- | ------------- | --------------------------------------------------------------------- |
| Skysail Age | 2185 | `skysail`   | `sail`        | Riverlight glass is light enough to fly; sails and floating orchards. |
| Stargazer   | 2230 | `stargazer` | `observatory` | Domes and a great telescope find crystal glints on the Moon.          |
| Moonward    | 2270 | `moonward`  | `homestead`   | A space elevator beside the mine supplies Moon homesteads.            |

A fourth era, Twin Hollows (looking after the town and the Moon settlement), is
planned separately. It needs a second settlement map and a save format change.

## Looks that evolve

Each era keeps every building's purpose and massing but gives it a new silhouette:

- **Skysail** — stilted timber decks, sailcloth saddles stretched between masts,
  saffron pennants, kites and little garden islands floating on tethers. Cream,
  saffron and teal. Boardwalk streets and a wind-spiral fountain.
- **Stargazer** — night-blue ceramic walls, copper cornices, starlit arched
  windows and white observatory domes split by a viewing slit; telescopes and
  violet orbit rings crown the finished buildings. Star-path streets and an orrery.
- **Moonward** — the frontier gables return in moon-white ceramic with gold trim,
  navy solar shingles, barn-red porches and round airlock doors; landing beacons
  and dishes crown the finished buildings. Heritage brick streets and the very
  first well, restored under a moon-glass cap.

The renderer is shared. `src/data/futureArchitecture.js` holds the three palettes
(the cozy colour roles, so paint, watermill and SVG consumers read the same keys),
the family → archetype table and the nine landmark forms. `buildings/future.js`
composes the archetypes (homes, hall, shop, workshop, water, station, culture,
research, farm, landing, garden, mast, concert, studio, tower, square) from the
era's kit in `buildings/future/{sail,observatory,homestead}.js`. A kit supplies
`block`, `roof`, `round`, `cap`, `door`, `wing` (level 2), `crown` (level 3) and
`prop`. A later era can reuse a kit or add one without new archetype code. The
unit shapes (gable, tensile saddle, dome, octagon, peak, pennant) are created once
per diorama in `futureShapes.js`. `TownFutureBuilding.vue` draws the same pieces
for the SVG fallback. The city renderer registry dispatches the building, airport
lounge, airport grounds and bridge hooks by architecture.

## New buildings and the Skyward quarter

The garden lane (x = 72) now crosses the railway into the Skyward quarter, two
rows of large lots behind the tracks. The space elevator stands on its own lot
west of the mine hill, reached by a new road between the radio tower and the park
that crosses the railway beside the station.

| Era       | Building           | Effects                    |
| --------- | ------------------ | -------------------------- |
| Skysail   | Sky harbour        | 4 visitors, 2 comfort      |
| Skysail   | Cloud orchard      | 4 food, 4 water, 1 comfort |
| Skysail   | Windsong lofts     | 4 homes, 1 comfort         |
| Stargazer | Great telescope    | 4 visitors, 2 comfort      |
| Stargazer | Dewlight gardens   | 4 food, 4 water, 1 comfort |
| Stargazer | Starlight terraces | 4 homes, 1 comfort         |
| Moonward  | Space elevator     | 6 visitors, 3 comfort      |
| Moonward  | Moonpost           | 2 visitors, 2 comfort      |
| Moonward  | Mission homesteads | 4 homes, 1 comfort         |

Effects scale with each building's level, as for every city building. Prices
continue the Riverlight steps (modernization 13.6k–22k, new buildings 15.5k–24.5k),
and the space elevator carries the major-landmark premium and a two-puzzle first
stage. Town needs tests confirm every finished era houses everyone.

## The Moon

The default camera looks down at the town, so a moon in the 3D sky would never be
on screen. New Hollow is therefore a small Moon chip beside water, food and
happiness. `moonSettlement(town)` in `src/data/moonSettlement.js` counts two
homesteads per elevator level plus one for every four modernization levels in a
supply era (the `moonSettlement` capability), up to 24. Each homestead is a gold
light that twinkles out of step; reduced motion keeps them still. Tapping the chip
opens the space elevator. In the 3D town the elevator's climbers ride the ribbon
up and down with supplies (a moving part like the watermill wheel, outside animal
collision). The settlement is presentation only: no coins, timers or failure.

## Rules kept

- No move limits, timers or puzzle changes; mine levels for these eras are a
  separate pass.
- Honours: the three eras join `NON_MILESTONE_ERAS`. A Through the Ages diamond
  rank ("Two Towns, One Sky") is reserved for the Twin Hollows era.
- The mine surface keeps Riverlight's lantern-lit works; each era adds its own portal
  crown (`sail-arch`, `dome-arch`, `homestead-arch` in `MineFutureArchitecture.js`),
  so every era transition visibly rebuilds the mine.

## Gallery

Completed towns from the `<era>-complete` demo fixtures (`npm run demo:eras`),
rendered in headless Chromium with SwiftShader at 1440 × 900.

The same old-town view, from Riverlight to Moonward:

![Riverlight old town](images/future-eras/00-riverlight-town.png)
![Skysail old town](images/future-eras/skysail-town.png)
![Stargazer old town](images/future-eras/stargazer-town.png)
![Moonward old town](images/future-eras/moonward-town.png)

The Skyward quarter beyond the railway:

![Skysail quarter](images/future-eras/skysail-quarter.png)
![Stargazer quarter](images/future-eras/stargazer-quarter.png)
![Moonward quarter](images/future-eras/moonward-quarter.png)

Each era crowns the mine portal in its own style:

![Skysail mine](images/future-eras/skysail-mine.png)
![Stargazer mine](images/future-eras/stargazer-mine.png)
![Moonward mine](images/future-eras/moonward-mine.png)

The space elevator beside the mine, and each finished town:

![Space elevator](images/future-eras/moonward-elevator.png)
![Skysail overview](images/future-eras/skysail-overview.png)
![Stargazer overview](images/future-eras/stargazer-overview.png)
![Moonward overview](images/future-eras/moonward-overview.png)
