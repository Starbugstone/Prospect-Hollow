# Airport visual refresh

The airport retains the town's muted cream, teal, coral and blue-glass palette,
soft edges and compact architectural proportions. A faceted barrel roof with
flat end walls replaces the inflated elliptical hangar. Framed terminal windows,
an integrated control tower, a sheltered entrance, grass verges and a restrained
forecourt replace the disconnected blocks and continuous paved slab.

The airport's completed modernization era selects its architecture. The town
entering an era does not replace an airport that has not yet been modernized.
Each style has three stages: the terminal/tower/hangar, passenger lounge, then
landscaping, apron lights and windsock. Later styles also gain a departures board.

| Era                      | Architecture                                                             | Triangles at stages 1 / 2 / 3 |
| ------------------------ | ------------------------------------------------------------------------ | ----------------------------- |
| Aviation & Radio, 1958   | Low cream terminal, teal roof, framed control cabin                      | 3,108 / 3,380 / 3,860         |
| Music & Television, 1986 | Stepped departure hall, dark roof, coral fascia and upper window ribbon  | 3,408 / 3,680 / 4,292         |
| Connected City, 2005     | Glass terminal, slim vertical fins, light roof cap and glazed rooflights | 3,568 / 3,840 / 4,452         |

These are indexed runtime mesh counts for the airport, including its site and
completed additions, excluding the separately animated aircraft and text sign.
They are not a frame-time performance claim. The runway, site coordinates,
flight path, construction costs, rewards and unlimited puzzle moves are unchanged.

`airportStyle` in the era catalog selects a definition in
`src/data/airportStyles.json`. Blender authoring, Three.js and the SVG fallback
share that definition; unsupported styles fall back to the regional airport.
See [the era architecture guide](era-architecture.md) for extension rules.

Rebuild through Blender with
`--background --python scripts/create-future-assets.py -- /absolute/repository/path`.
The editable scene, GLB and actual source-mesh review sheet are in `art/future/`;
the game uses `src/assets/future-meshes.json`.

The screenshots below use the actual game renderer at 1440 × 900 on a disposable
local save, with a fixed camera and a 1.5 drawing-buffer pixel ratio. All nine
era/stage combinations and rear views were inspected. Browser checks reported
no application errors; headless Chromium reported screenshot readback warnings.
Regression checks cover stage selection, distinct geometry, footprint bounds,
aircraft wing clearance, future-era inheritance and unsupported style fallback.
The full suite passes 1,281 tests across 73 files, and the production build passes
with the existing large-chunk advisory.

## 1958

![1958 airport](images/airport-aviation-2026-09.png)

## 1986

![1986 airport](images/airport-broadcast-2026-09.png)

## 2005

![2005 airport](images/airport-contemporary-2026-09.png)
