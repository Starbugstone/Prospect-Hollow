# Town visual coherence review

This change follows a 15-era inspection of 804 building/era sheets, 2,382
stage render requests and 4,764 front/reverse views against production `823e971`.
Requests include repeated retained Twin Hollows finishes; they are not all
distinct purchasable upgrades.
The normalized inventory contains 39 root-cause families from 44 source findings.

The full local review, including every finding, matched actual-renderer images,
tier and handover strips, navigation overlays and performance evidence, is at
`/home/stone/dev/town-visual-audit-2026-10-21/report.html`. Its `findings.json`,
`findings.md`, `validation.json`, `performance.json` and
`mature-module-budget.json` are the machine-readable and text evidence. Scratch
concepts in `proposals/` are superseded; `implemented/` contains real renderer
comparisons. No account or personal information is used in the fixtures.

Completed structures and one mature purpose module survive modernization. New
finish grades refit the same module rather than adding rooms indefinitely.
`buildingStages()` and `heritageUpgrade()` are shared by WebGL and SVG.
Purpose structures keep the same reserved parcel envelope across paid finishes;
physical signs use supported mounts and visible lettering. Road setbacks, clear
entrance approaches, station/rail/bridge clearance and regenerated footprints
are acceptance gates. See [the era architecture guide](era-architecture.md).

The footprint generation/check pipeline also owns numeric mature setback
envelopes. Shipped plots use those numbers directly; missing definitions keep
the memoized safe probe fallback. Animal roaming preparation caches exact point
answers only while navigation and geometry remain unchanged, and rejects far
roads by conservative bounds before the existing exact distance check. These
optimizations preserve collision solids and the reviewed visual geometry.
Physical sign mounts are generated in that same pass and payload. Runtime input
validation preserves the exact authored mount and falls back to the existing
surface/visibility resolver for custom or missing definitions; shipped plots
avoid that repeated raycasting during cold loads and construction swaps.

Moon entrance spokes use shared authored hatch/stair anchors, join the existing
ring and reserve their corridors from craters. Moon walkers and rovers continue
to use their existing decorative ring circulation.

Retained residents, workers, transport VIPs and live visitors are revalidated
once after navigation is rebuilt, before the first render. Only positions inside
new solids move, to a nearby safe point on the same street side; identities and
visit/work state survive. Actor positions are runtime state, not serialized save
fields. Regression fixtures use the old geometry's clear positions.

The aircraft work is coordinated on Claude's separate branch. This change keeps
its imported model exports, palette keys and airport hangar opening unchanged.
It does not change puzzle rules, rewards or unlimited moves.

Deferred art direction remains explicit in the original inventory: sparse side/rear
facades, larger open-site finish steps and broader city shell variety. The future
watermill roof follow-up is recorded below. Tall-building stage readability is only partly
improved. The Aviation home's final balcony furniture remains subtle at
overview scale; this is an accepted low-severity residual. A real-phone check
is still recommended for the existing mobile town stutter issue #54.

Other low, nonblocking residuals are explicit in the report. Deliberately hovering
orbit rings are accepted unchanged. The
short Windsong side link lacks an upper hatch, inherited homestead porches use
stylized dimensions rather than a strict 1.8-metre door metric, and generic
scaffolding does not yet isolate the new purpose module. Ground approaches remain
required. The scaffolding note is source-only; this audit has no construction
screenshot and does not claim one.

## Watermill roof follow-up, 24 October 2026

The future watermill now shares the town's roof kits: Skysail's supported
sailcloth, Stargazer's slit dome, and Moonward's solar gable with gold seams.
The Twin palette uses the same homestead roof; actual retained finishes still
come from the building's saved finish era. The working mill body, animated
wheel, native loading expansion and entrance remain in place. Earlier eras keep
their existing geometry.

`watermillAppearance()` supplies the future style and palette to both renderers.
`TownFutureRoof.vue` is extracted from the existing future-building drawing and
reused by the watermill. Explicit component props preserve its template bindings
in the browser and server rendering; matched Skysail, Stargazer and Moonward
home SVG controls remain byte-for-byte identical after extraction.

The additional roofs use cached geometry, static batching and no new animation
or lights. Both roofs together stay below 900 triangles and 20 meshes. The
mature plot adds 776 / 852 / 376 triangles in Skysail / Stargazer / Moonward,
less than 0.5% of each measured town's static building triangles, with the same
number of static building batches. This is geometry accounting, not a phone-FPS
claim.

A paired SwiftShader probe rendered 4,320 measured frames with production static
batching and wheel instancing. Baseline and candidate each used four draw calls;
both measured 0.10 ms median and 0.20 / 0.20 / 0.30 ms p95 in the three eras.
This isolates the mill's render cost and does not establish full-town or physical
mobile frame rates; the raw timings, including tail samples, are retained.

`testing/watermill-future-roofs.test.js` covers successor/fallback behavior,
retained wheel geometry, grounded sail supports, the loading stage, standing
clearance at the entrance, wheel rotation clearance, cache/budget limits and SVG
roof styles. All footprint families were regenerated and checked. Decoded
before/after catalogs keep every non-watermill shape, sign mount and setback
entry unchanged; real settlement public and final door routes also match the
baseline in all three eras.

Docker validation on the isolated follow-up passed `npm run verify`: 231 files /
4,294 tests, formatting, ESLint/knip, footprint drift checking, production build
and bundle budgets. Save rules and all 52 integrity fixtures match. Actual
renderer captures cover every tier from the front and reverse, including a
Riverlight control, plus complete settlements at desktop and narrow widths.
Disposable snapshots, paired render-cost measurements and the integration
handoff live under `output/watermill-review/` in the follow-up checkout.

## Upper-gallery follow-up, 24 October 2026

The business tower, apartments, hotel and city homes gain an attached upper
gallery through the shared cozy and future architecture kits. Gallery floors and
wall brackets stay through modernization. The second finish broadens the same
gallery's glazing and unfolds its shades; the third opens those shades further.
Existing window rows within the gallery band are replaced rather than drawn
through the new glazing. The storey spacing has one definition shared with the
actual wall renderers. Unsupported styles, incomplete structures and small annexes
skip the gallery safely; a synthetic successor inherits its architecture.

`towerRefinements.js` owns the four building definitions, storey alignment, palette
roles and finish recipe. The WebGL helper and `TownTowerGallery.vue` read that
contract. SVG apartment/hotel drawings now have their actual single tower; the
business tower has its three setback sections, with its crown on the upper roof.
Pod stacks and the radio mast retain their distinct structures and remain separate
follow-ups. This completes four kinds within FUT-06, not the whole tall-building
or façade backlog. The existing future renderer itself is unchanged.

Each gallery uses 120 triangles and 14 meshes from cached geometry, with existing
palette materials and no additional lights or animation. Separate face vertices
have explicit indices, preserving normals on both sides and compatibility with
the older primitive batching path. Regression coverage checks exact vertex bounds
and triangle counts after batching. All existing architecture budgets remain in
place. The complete-town static building comparison adds 216 / 216 / 72 / 456 /
408 triangles in Canopy / Riverlight / Skysail / Stargazer / Moonward respectively,
under 0.26% in every measured town; static building batch counts are unchanged.

The six affected footprint families are regenerated. Decoded non-target shapes,
physical sign mounts and setbacks match the preceding watermill batch. Twenty
production itineraries across five eras reach identical door anchors along the
same routes. The all-era animal-clearance suite checks both tested tiers against
real scenery, including the earlier batching path. Dedicated gallery coverage also
checks structural retention, roof-seat and ground clearance, bounded cached parts,
successor/fallback behavior and SVG stage/count parity.

Actual renderer captures cover all three finishes, both views and five eras, with
complete-settlement desktop and narrow captures. The final checks, raw render-cost
probes and integration artifacts are recorded separately under
`output/tower-review/`. A probe that begins before deferred town life settles is
not valid performance evidence; accepted samples require a fixed camera/population,
stable draw counts and the independently measured geometry delta. Software-GPU
measurements do not establish physical-phone frame rates.

The clean Docker `npm run verify` passed 232 files / 4,312 tests, formatting,
ESLint/knip, all-era footprint drift checks, the production build and bundle
budgets. The dedicated gallery suite has 18 tests; all 34 animal-clearance cases
pass. The first full attempt caught a batching index incompatibility, which is
fixed and covered by the exact-bounds/triangle regression. Its failed/stopped
log remains separate from the clean passing run.

The final settled Stargazer town probe used four balanced before/after pairs and
24 measured draws per sample (192 draws total), at 600×450 / DPR1 on SwiftShader.
It kept all 17 people, 35 animals and the camera fixed, refreshed the static cache
per draw and waited for GPU completion. Both versions used 170 draw calls; the
controlled triangle delta was exactly 456. Median cost was 4.8 → 4.9 ms and p95
was 6.5 ms in both. These are render-cost samples with simulation paused, not
physical-device FPS or construction/settling measurements.
